import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConsumableService } from '@/lib/services/consumable.service'
import { updateConsumableSchema } from '@/lib/validations/inventory/consumable'
import { ZodError } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import prisma from '@/lib/prisma'
import {
  assertInventoryResourceManage,
  assertInventoryResourceRead,
  assertResourceTypeChangeAllowed,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'
import { getConsumableConsumptionSummary } from '@/lib/inventory/consumable-consumption'
import { withAttributeLabels } from '@/lib/inventory/attribute-labels'

/**
 * GET /api/inventory/consumables/[id]
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const consumable = await prisma.consumables.findUnique({
      where: { id },
      include: {
        consumableType: {
          include: { family: { select: { id: true, name: true } }, attributes: true },
        },
        unitOfMeasure: true,
        warehouse: { select: { id: true, name: true } },
        assignedEquipment: {
          select: {
            id: true,
            code: true,
            brand: true,
            model: true,
            serialNumber: true,
            // Usuario que hoy tiene ese equipo — el suministro no se asigna a una
            // persona directamente, pero si el equipo al que está ligado sí tiene
            // dueño, es información derivada útil ("en uso por" en el detalle).
            assignments: {
              where: { isActive: true },
              take: 1,
              select: { receiver: { select: { id: true, name: true, email: true } } },
            },
          },
        },
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
      return NextResponse.json({ error: 'Suministro no encontrado' }, { status: 404 })
    }

    try {
      await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'CONSUMABLE', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const totalStockValue =
      consumable.costPerUnit != null && consumable.currentStock != null
        ? consumable.costPerUnit * consumable.currentStock
        : null

    const consumptionSummary = await getConsumableConsumptionSummary(
      id,
      consumable.currentStock ?? 0
    )

    // Etiqueta legible de cada atributo personalizado, resuelta contra el catálogo del
    // tipo de suministro (misma fuente que equipo/licencia — ver attribute-labels.ts).
    const customValuesWithLabels = withAttributeLabels(
      consumable.customValues as any,
      consumable.consumableType?.attributes
    )

    return NextResponse.json({
      ...consumable,
      customValues: customValuesWithLabels,
      totalStockValue,
      consumptionSummary,
    })
  } catch (error) {
    console.error('Error en GET /api/inventory/consumables/[id]:', error)
    return NextResponse.json({ error: 'Error al obtener suministro' }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/consumables/[id]
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { id } = await params

    try {
      await assertInventoryResourceManage(toInventoryAccessUser(session.user), 'CONSUMABLE', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }
    const body = await request.json()
    const { supplierId, ...rest } = body

    // Validar supplierId si se provee
    if (supplierId !== undefined && supplierId !== null) {
      const supplierExists = await prisma.suppliers.findUnique({
        where: { id: supplierId },
        select: { id: true },
      })
      if (!supplierExists) {
        return NextResponse.json({ error: 'El proveedor especificado no existe' }, { status: 400 })
      }
    }

    const validatedData = updateConsumableSchema.parse(rest)
    const updatePayload: any = { ...validatedData }
    if (supplierId !== undefined) {
      updatePayload.supplierId = supplierId
    }

    // Si se reasigna el tipo (y por tanto la familia), validar permiso en la
    // familia DESTINO — assertInventoryResourceManage de arriba solo cubrió
    // la familia actual del consumible.
    if (validatedData.typeId) {
      try {
        await assertResourceTypeChangeAllowed(
          toInventoryAccessUser(session.user),
          'CONSUMABLE',
          validatedData.typeId
        )
      } catch (err) {
        if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
        throw err
      }
    }

    const consumable = await ConsumableService.updateConsumable(id, updatePayload, session.user.id)

    await AuditServiceComplete.log({
      action: AuditActionsComplete.CONSUMABLE_UPDATED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { updatedFields: Object.keys(updatePayload) },
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando actualización de consumible:', err))

    return NextResponse.json(consumable)
  } catch (error) {
    console.error('Error en PUT /api/inventory/consumables/[id]:', error)
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al actualizar suministro' }, { status: 500 })
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
    const { id } = await params

    try {
      await assertInventoryResourceManage(toInventoryAccessUser(session.user), 'CONSUMABLE', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }
    const existing = await ConsumableService.getConsumableById(id)
    await ConsumableService.deleteConsumable(id, session.user.id)

    await AuditServiceComplete.log({
      action: AuditActionsComplete.CONSUMABLE_DELETED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { name: existing?.name, type: existing?.consumableType?.name },
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando eliminación de consumible:', err))

    return NextResponse.json({ message: 'Suministro eliminado exitosamente' })
  } catch (error) {
    console.error('Error en DELETE /api/inventory/consumables/[id]:', error)
    return NextResponse.json({ error: 'Error al eliminar suministro' }, { status: 500 })
  }
}
