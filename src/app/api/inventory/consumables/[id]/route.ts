import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConsumableService } from '@/lib/services/consumable.service'
import { updateConsumableSchema } from '@/lib/validations/inventory/consumable'
import { ZodError } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'

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
    const consumable = await prisma.consumables.findUnique({
      where: { id },
      include: {
        consumableType: true,
        unitOfMeasure: true,
        assignedEquipment: { select: { id: true, code: true, brand: true, model: true, serialNumber: true } },
        supplier: { select: { id: true, name: true, taxId: true } },
        movements: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            assignedToUser: { select: { id: true, name: true, email: true } },
            assignedToEquipment: { select: { id: true, code: true, brand: true, model: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })
    if (!consumable) {
      return NextResponse.json({ error: 'Consumible no encontrado' }, { status: 404 })
    }

    const totalStockValue =
      consumable.costPerUnit != null && consumable.currentStock != null
        ? consumable.costPerUnit * consumable.currentStock
        : null

    return NextResponse.json({ ...consumable, totalStockValue })
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
    const { supplierId, ...rest } = body

    // Validar supplierId si se provee
    if (supplierId !== undefined && supplierId !== null) {
      const supplierExists = await prisma.suppliers.findUnique({ where: { id: supplierId }, select: { id: true } })
      if (!supplierExists) {
        return NextResponse.json({ error: 'El proveedor especificado no existe' }, { status: 400 })
      }
    }

    const validatedData = updateConsumableSchema.parse(rest)
    const updatePayload: any = { ...validatedData }
    if (supplierId !== undefined) {
      updatePayload.supplierId = supplierId
    }

    const consumable = await ConsumableService.updateConsumable(id, updatePayload, session.user.id)

    await AuditServiceComplete.log({
      action: AuditActionsComplete.CONSUMABLE_UPDATED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { updatedFields: Object.keys(updatePayload) },
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
