import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { canManageInventory } from '@/lib/inventory-access'
import {
  getInventorySessionContext,
  hasInventoryModuleAccess,
} from '@/lib/inventory/inventory-session'

/** GET — listado de tipos de servicio (catálogo contratos) */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const ctx = await getInventorySessionContext(session.user)
    if (!hasInventoryModuleAccess(ctx)) {
      return NextResponse.json({ error: 'Sin acceso al módulo de inventario' }, { status: 403 })
    }

    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'

    const types = await prisma.contract_service_types.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(types)
  } catch (error) {
    console.error('GET contract-service-types:', error)
    return NextResponse.json({ error: 'Error al obtener tipos de servicio' }, { status: 500 })
  }
}

/** POST — crear tipo de servicio */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    let code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''

    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    if (!code) {
      code = name
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_]/g, '')
        .slice(0, 50)
    }

    if (!code) {
      return NextResponse.json({ error: 'El código es obligatorio' }, { status: 400 })
    }

    const existing = await prisma.contract_service_types.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un tipo con ese código' }, { status: 409 })
    }

    const maxOrder = await prisma.contract_service_types.aggregate({ _max: { order: true } })
    const type = await prisma.contract_service_types.create({
      data: {
        id: randomUUID(),
        code,
        name,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        order: (maxOrder._max.order ?? -1) + 1,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json(type, { status: 201 })
  } catch (error) {
    console.error('POST contract-service-types:', error)
    return NextResponse.json({ error: 'Error al crear tipo de servicio' }, { status: 500 })
  }
}
