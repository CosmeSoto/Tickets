import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

/**
 * GET /api/inventory/license-types
 * Obtiene todos los tipos de licencia
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const isAdmin = session.user.role === 'ADMIN'

    const where = isAdmin && includeInactive ? {} : { isActive: true }

    const types = await prisma.license_types.findMany({
      where,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(types)
  } catch (error) {
    console.error('Error en GET /api/inventory/license-types:', error)
    return NextResponse.json({ error: 'Error al obtener tipos de licencia' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/license-types
 * Crea un nuevo tipo de licencia (ADMIN y TECHNICIAN)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { code, name, description, icon } = body

    if (!code || !name) {
      return NextResponse.json({ error: 'Código y nombre son requeridos' }, { status: 400 })
    }

    const existing = await prisma.license_types.findUnique({
      where: { code: code.toUpperCase() },
    })

    if (existing) {
      return NextResponse.json({ error: 'Ya existe un tipo de licencia con este código' }, { status: 400 })
    }

    const newType = await prisma.license_types.create({
      data: {
        id: randomUUID(),
        code: code.toUpperCase(),
        name,
        description,
        icon,
        isActive: true,
        order: 999,
      },
    })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.LICENSE_TYPE_CREATED,
      entityType: 'inventory',
      entityId: newType.id,
      userId: session.user.id,
      details: { code: newType.code, name: newType.name, description },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando creación de tipo de licencia:', err))

    return NextResponse.json(newType, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/inventory/license-types:', error)
    return NextResponse.json({ error: 'Error al crear tipo de licencia' }, { status: 500 })
  }
}
