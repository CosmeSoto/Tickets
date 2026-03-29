import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { calculateConsumableStatus } from '@/lib/inventory/consumable-status'
import type { Consumable, StockMovement, CreateConsumableData, UpdateConsumableData, CreateStockMovementData, ConsumableSummary } from '@/types/inventory/consumable'


const consumableInclude = {
  consumableType: { include: { family: true } },
  unitOfMeasure: true,
  assignedEquipment: { select: { id: true, code: true, brand: true, model: true, serialNumber: true } },
  movements: {
    include: {
      user: { select: { id: true, name: true, email: true } },
      assignedToUser: { select: { id: true, name: true, email: true } },
      assignedToEquipment: { select: { id: true, code: true, brand: true, model: true } },
    },
    orderBy: { createdAt: 'desc' as const },
    take: 5,
  },
}

export class ConsumableService {
  static async createConsumable(data: CreateConsumableData, userId: string): Promise<Consumable> {
    const consumable = await prisma.consumables.create({
      data: {
        name: data.name,
        typeId: data.typeId,
        unitOfMeasureId: data.unitOfMeasureId,
        assignedEquipmentId: data.assignedEquipmentId || null,
        currentStock: data.currentStock,
        minStock: data.minStock,
        maxStock: data.maxStock,
        costPerUnit: data.costPerUnit,
        location: data.location,
        notes: data.notes,
        compatibleEquipment: data.compatibleEquipment || [],
      },
      include: consumableInclude,
    })

    if (data.currentStock > 0) {
      await this.createStockMovement({
        consumableId: consumable.id,
        type: 'ENTRY',
        quantity: data.currentStock,
        reason: 'Stock inicial',
      }, userId)
    }

    return consumable as Consumable
  }

  static async updateConsumable(id: string, data: UpdateConsumableData, userId: string): Promise<Consumable> {
    const updateData: any = { ...data }
    // Permitir desasignar equipo enviando null
    if (data.assignedEquipmentId === null) {
      updateData.assignedEquipmentId = null
    }
    const consumable = await prisma.consumables.update({
      where: { id },
      data: updateData,
      include: consumableInclude,
    })
    return consumable as Consumable
  }

  static async deleteConsumable(id: string, userId: string): Promise<void> {
    await prisma.stock_movements.deleteMany({ where: { consumableId: id } })
    await prisma.consumables.delete({ where: { id } })
  }

  static async createStockMovement(data: CreateStockMovementData, userId: string): Promise<StockMovement> {
    const result = await prisma.$transaction(async (tx) => {
      const consumable = await tx.consumables.findUnique({ where: { id: data.consumableId } })
      if (!consumable) throw new Error('Consumible no encontrado')

      // Bloquear EXIT sobre MRO caducado
      if (data.type === 'EXIT' && consumable.status === 'EXPIRED') {
        throw new Error('No se puede consumir un material caducado')
      }

      let newStock = consumable.currentStock
      switch (data.type) {
        case 'ENTRY': newStock += data.quantity; break
        case 'EXIT': newStock -= data.quantity; break
        case 'ADJUSTMENT': newStock = data.quantity; break
      }

      if (newStock < 0) {
        throw new Error(`Stock insuficiente: disponible ${consumable.currentStock}, solicitado ${data.quantity}`)
      }

      const movement = await tx.stock_movements.create({
        data: {
          consumableId: data.consumableId,
          type: data.type,
          quantity: data.quantity,
          reason: data.reason,
          userId,
          assignedToUserId: data.assignedToUserId || null,
          assignedToEquipmentId: data.assignedToEquipmentId || null,
        },
        include: {
          consumable: true,
          user: true,
          assignedToUser: true,
          assignedToEquipment: true,
        },
      })

      // Recalcular status tras el movimiento
      const newStatus = calculateConsumableStatus(
        newStock,
        consumable.minStock,
        consumable.expirationDate
      )
      await tx.consumables.update({
        where: { id: data.consumableId },
        data: { currentStock: newStock, status: newStatus },
      })

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'STOCK_MOVEMENT',
          entityType: 'asset',
          entityId: data.consumableId,
          userId,
          details: {
            type: data.type,
            quantity: data.quantity,
            previousStock: consumable.currentStock,
            newStock,
          },
        },
      })

      return movement
    })

    return result as StockMovement
  }

  static async getConsumableById(id: string): Promise<Consumable | null> {
    const consumable = await prisma.consumables.findUnique({
      where: { id },
      include: {
        consumableType: true,
        unitOfMeasure: true,
        assignedEquipment: { select: { id: true, code: true, brand: true, model: true, serialNumber: true } },
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
    return consumable as Consumable | null
  }

  static async listConsumables(filters: any): Promise<{ consumables: Consumable[], total: number }> {
    const where: any = {}

    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' }
    }

    if (filters.typeId && filters.typeId.length > 0) {
      where.typeId = { in: filters.typeId }
    }

    if (filters.familyId) {
      where.consumableType = { familyId: filters.familyId }
    }

    if (filters.lowStock) {
      const lowStockIds = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM consumables WHERE current_stock <= min_stock
      `
      where.id = { in: lowStockIds.map(r => r.id) }
    }

    const [consumables, total] = await Promise.all([
      prisma.consumables.findMany({
        where,
        include: consumableInclude,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { name: 'asc' },
      }),
      prisma.consumables.count({ where }),
    ])

    return { consumables: consumables as Consumable[], total }
  }

  static async getConsumableSummary(): Promise<ConsumableSummary> {
    const [total, lowStock, outOfStock, byType, totalValueResult, recentMovements] = await Promise.all([
      prisma.consumables.count(),
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM consumables WHERE current_stock <= min_stock`,
      prisma.consumables.count({ where: { currentStock: 0 } }),
      prisma.consumables.groupBy({ by: ['typeId'], _count: true }),
      prisma.$queryRaw<Array<{ total: number }>>`SELECT SUM(current_stock * COALESCE(cost_per_unit, 0)) as total FROM consumables`,
      prisma.stock_movements.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    ])

    const typeIds = byType.map(t => t.typeId)
    const types = typeIds.length > 0
      ? await prisma.consumable_types.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true } })
      : []
    const typeMap = Object.fromEntries(types.map(t => [t.id, t.name]))

    const byTypeMap: Record<string, number> = {}
    byType.forEach(item => { byTypeMap[typeMap[item.typeId] || item.typeId] = item._count })

    return {
      total,
      lowStock: Number(lowStock[0]?.count || 0),
      outOfStock,
      byType: byTypeMap,
      totalValue: totalValueResult[0]?.total || 0,
      recentMovements,
    }
  }

  static async getConsumableMovements(consumableId: string, limit: number = 50): Promise<StockMovement[]> {
    const movements = await prisma.stock_movements.findMany({
      where: { consumableId },
      include: {
        consumable: true,
        user: true,
        assignedToUser: true,
        assignedToEquipment: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return movements as StockMovement[]
  }
}
