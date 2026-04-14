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
    const familyId = request.nextUrl.searchParams.get('familyId')
    const isAdmin = session.user.role === 'ADMIN'
    const where = isAdmin && includeInactive ? {} : { isActive: true }
    // Sin familia = global (visible para todas las familias)
    // Con familia = solo esa familia + los globales (familyId = null)
    const whereWithFamily = familyId
      ? { ...where, OR: [{ familyId }, { familyId: null }] }
      : where

    const types = await prisma.consumable_types.findMany({
      where: whereWithFamily,
      include: { family: { select: { id: true, name: true, icon: true, color: true } } },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(types)
  } catch (error) {
    console.error('Error en GET /api/inventory/consumable-types:', error)
    return NextResponse.json({ error: 'Error al obtener tipos de consumible' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!await canManageInventory(session.user.id, session.user.role)) {
      return inventoryForbidden()
    }

    const { code, name, description, icon, order, familyId } = await request.json()
    if (!code || !name) {
      return NextResponse.json({ error: 'Código y nombre son requeridos' }, { status: 400 })
    }

    const existing = await prisma.consumable_types.findUnique({ where: { code: code.toUpperCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un tipo de consumible con este código' }, { status: 400 })
    }

    const newType = await prisma.consumable_types.create({
      data: { id: randomUUID(), code: code.toUpperCase(), name, description, icon, order: order || 999, isActive: true, ...(familyId ? { familyId } : {}) },
    })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.CONSUMABLE_TYPE_CREATED,
      entityType: 'inventory',
      entityId: newType.id,
      userId: session.user.id,
      details: { code: newType.code, name: newType.name, description },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando creación de tipo de consumible:', err))

    return NextResponse.json(newType, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/inventory/consumable-types:', error)
    return NextResponse.json({ error: 'Error al crear tipo de consumible' }, { status: 500 })
  }
}
