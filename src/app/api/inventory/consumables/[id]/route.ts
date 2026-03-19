import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConsumableService } from '@/lib/services/consumable.service'
import { updateConsumableSchema } from '@/lib/validations/inventory/consumable'
import { ZodError } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

/**
 * GET /api/inventory/consumables/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const consumable = await ConsumableService.getConsumableById(id)
    if (!consumable) {
      return NextResponse.json({ error: 'Consumible no encontrado' }, { status: 404 })
    }

    return NextResponse.json(consumable)
  } catch (error) {
    console.error('Error en GET /api/inventory/consumables/[id]:', error)
    return NextResponse.json({ error: 'Error al obtener consumible' }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/consumables/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!await canManageInventory(session.user.id, session.user.role)) {
      return inventoryForbidden()
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateConsumableSchema.parse(body)
    const consumable = await ConsumableService.updateConsumable(id, validatedData, session.user.id)

    await AuditServiceComplete.log({
      action: AuditActionsComplete.CONSUMABLE_UPDATED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { updatedFields: Object.keys(validatedData) },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando actualización de consumible:', err))

    return NextResponse.json(consumable)
  } catch (error) {
    console.error('Error en PUT /api/inventory/consumables/[id]:', error)
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al actualizar consumible' }, { status: 500 })
  }
}

/**
 * DELETE /api/inventory/consumables/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo ADMIN puede eliminar consumibles' }, { status: 403 })
    }

    const { id } = await params
    const existing = await ConsumableService.getConsumableById(id)
    await ConsumableService.deleteConsumable(id, session.user.id)

    await AuditServiceComplete.log({
      action: AuditActionsComplete.CONSUMABLE_DELETED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { name: existing?.name, type: existing?.consumableType?.name },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando eliminación de consumible:', err))

    return NextResponse.json({ message: 'Consumible eliminado exitosamente' })
  } catch (error) {
    console.error('Error en DELETE /api/inventory/consumables/[id]:', error)
    return NextResponse.json({ error: 'Error al eliminar consumible' }, { status: 500 })
  }
}
