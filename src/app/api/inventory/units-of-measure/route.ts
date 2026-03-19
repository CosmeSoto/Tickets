import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
    const isAdmin = session.user.role === 'ADMIN'
    const where = isAdmin && includeInactive ? {} : { isActive: true }

    const units = await prisma.units_of_measure.findMany({
      where,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(units)
  } catch (error) {
    console.error('Error en GET /api/inventory/units-of-measure:', error)
    return NextResponse.json({ error: 'Error al obtener unidades de medida' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!await canManageInventory(session.user.id, session.user.role)) {
      return inventoryForbidden()
    }

    const { code, name, symbol, description, order } = await request.json()
    if (!code || !name || !symbol) {
      return NextResponse.json({ error: 'Código, nombre y símbolo son requeridos' }, { status: 400 })
    }

    const existing = await prisma.units_of_measure.findUnique({ where: { code: code.toUpperCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una unidad de medida con este código' }, { status: 400 })
    }

    const unit = await prisma.units_of_measure.create({
      data: { id: randomUUID(), code: code.toUpperCase(), name, symbol, description, order: order || 999, isActive: true },
    })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.UNIT_OF_MEASURE_CREATED,
      entityType: 'inventory',
      entityId: unit.id,
      userId: session.user.id,
      details: { code: unit.code, name: unit.name, symbol },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando creación de unidad de medida:', err))

    return NextResponse.json(unit, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/inventory/units-of-measure:', error)
    return NextResponse.json({ error: 'Error al crear unidad de medida' }, { status: 500 })
  }
}
