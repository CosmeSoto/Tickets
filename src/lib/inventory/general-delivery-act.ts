/**
 * Construcción de snapshots y datos para actas no ligadas a asignaciones de equipo.
 */
import { prisma } from '@/lib/prisma'
import type { UserInfo } from '@/types/inventory/delivery-act'

export async function buildActReceiverInfo(receiverId: string): Promise<UserInfo> {
  const user = await prisma.users.findUnique({
    where: { id: receiverId },
    include: {
      departments: { select: { name: true } },
    },
  })

  if (!user) {
    throw new Error('El receptor indicado no existe')
  }

  return {
    id: user.id,
    name: user.name ?? user.email ?? receiverId,
    email: user.email ?? '',
    role: user.role,
    department: user.departments?.name,
  }
}

export async function buildGeneralActSnapshot(params: {
  actType: string
  referenceId: string
  quantity?: number
  description?: string
  warehouseDestId?: string
}): Promise<Record<string, unknown>> {
  const { actType, referenceId, quantity, description, warehouseDestId } = params

  if (actType === 'MRO_DELIVERY') {
    const consumable = await prisma.consumables.findUnique({
      where: { id: referenceId },
      include: {
        type: { select: { name: true } },
        unitOfMeasure: { select: { name: true, symbol: true } },
      },
    })
    if (!consumable) throw new Error('El consumible referenciado no existe')

    const unit = consumable.unitOfMeasure?.symbol ?? consumable.unitOfMeasure?.name ?? 'u'
    return {
      actType,
      referenceId,
      id: consumable.id,
      code: consumable.name,
      brand: consumable.type?.name ?? 'Material',
      model: `${quantity ?? 0} ${unit}`,
      name: consumable.name,
      quantity: quantity ?? 0,
      unit,
    }
  }

  if (actType === 'SERVICE_COMPLETION') {
    const equipment = await prisma.equipment.findUnique({
      where: { id: referenceId },
      include: {
        type: { select: { name: true } },
        model: { select: { model: true } },
      },
    })
    if (!equipment) throw new Error('El equipo referenciado no existe')

    return {
      actType,
      referenceId,
      id: equipment.id,
      code: equipment.code,
      serialNumber: equipment.serialNumber,
      brand: equipment.brand,
      model: equipment.model?.model ?? equipment.modelDeprecated,
      typeName: equipment.type?.name,
      condition: equipment.condition,
      serviceDescription: description ?? '',
    }
  }

  if (actType === 'ASSET_TRANSFER') {
    const [equipment, warehouse] = await Promise.all([
      prisma.equipment.findUnique({
        where: { id: referenceId },
        include: {
          type: { select: { name: true } },
          model: { select: { model: true } },
          warehouse: { select: { name: true } },
        },
      }),
      warehouseDestId
        ? prisma.warehouses.findUnique({
            where: { id: warehouseDestId },
            select: { id: true, name: true },
          })
        : null,
    ])
    if (!equipment) throw new Error('El equipo referenciado no existe')
    if (warehouseDestId && !warehouse) throw new Error('La bodega destino no existe')

    return {
      actType,
      referenceId,
      id: equipment.id,
      code: equipment.code,
      serialNumber: equipment.serialNumber,
      brand: equipment.brand,
      model: equipment.model?.model ?? equipment.modelDeprecated,
      typeName: equipment.type?.name,
      condition: equipment.condition,
      originWarehouse: equipment.warehouse?.name ?? '—',
      destinationWarehouse: warehouse?.name ?? warehouseDestId,
      warehouseDestId: warehouseDestId ?? null,
    }
  }

  throw new Error(`Tipo de acta no soportado: ${actType}`)
}
