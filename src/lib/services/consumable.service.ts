import { PrismaClient } from '@prisma/client'
import type { Consumable, StockMovement, CreateConsumableData, UpdateConsumableData, CreateStockMovementData, ConsumableSummary } from '@/types/inventory/consumable'

const prisma = new PrismaClient()

/**
 * Servicio para gestión de consumibles y movimientos de stock
 */
export class ConsumableService {
  /**
   * Crea un nuevo consumible
   */
  static async createConsumable(data: CreateConsumableData, userId: string): Promise<Consumable> {
    try {
      const consumable = await prisma.consumables.create({
        data: {
          name: data.name,
          type: data.type,
          unitOfMeasure: data.unitOfMeasure,
          currentStock: data.currentStock,
          minStock: data.minStock,
          maxStock: data.maxStock,
          costPerUnit: data.costPerUnit,
          compatibleEquipment: data.compatibleEquipment || [],
        },
        include: {
          movements: {
            include: { user: true }
          }
        }
      })

      // Registrar movimiento inicial si hay stock
      if (data.currentStock > 0) {
        await this.createStockMovement({
          consumableId: consumable.id,
          type: 'ENTRY',
          quantity: data.currentStock,
          reason: 'Stock inicial',
        }, userId)
      }

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          action: 'CREATE',
          entityType: 'consumable',
          entityId: consumable.id,
          userId,
          details: {
            name: data.name,
            type: data.type,
          }
        }
      })

      return consumable as Consumable
    } catch (error) {
      console.error('Error creando consumible:', error)
      throw error
    }
  }

  /**
   * Actualiza un consumible
   */
  static async updateConsumable(id: string, data: UpdateConsumableData, userId: string): Promise<Consumable> {
    try {
      const consumable = await prisma.consumables.update({
        where: { id },
        data,
        include: {
          movements: {
            include: { user: true }
          }
        }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          action: 'UPDATE',
          entityType: 'consumable',
          entityId: id,
          userId,
          details: {
            updatedFields: Object.keys(data),
          }
        }
      })

      return consumable as Consumable
    } catch (error) {
      console.error('Error actualizando consumible:', error)
      throw error
    }
  }

  /**
   * Elimina un consumible
   */
  static async deleteConsumable(id: string, userId: string): Promise<void> {
    try {
      await prisma.consumables.delete({
        where: { id }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          action: 'DELETE',
          entityType: 'consumable',
          entityId: id,
          userId,
          details: {}
        }
      })
    } catch (error) {
      console.error('Error eliminando consumible:', error)
      throw error
    }
  }

  /**
   * Crea un movimiento de stock y actualiza el stock actual
   */
  static async createStockMovement(data: CreateStockMovementData, userId: string): Promise<StockMovement> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Obtener consumible actual
        const consumable = await tx.consumables.findUnique({
          where: { id: data.consumableId }
        })

        if (!consumable) {
          throw new Error('Consumible no encontrado')
        }

        // Calcular nuevo stock
        let newStock = consumable.currentStock

        switch (data.type) {
          case 'ENTRY':
            newStock += data.quantity
            break
          case 'EXIT':
            newStock -= data.quantity
            if (newStock < 0) {
              throw new Error('Stock insuficiente para realizar la salida')
            }
            break
          case 'ADJUSTMENT':
            newStock = data.quantity
            break
        }

        // Crear movimiento
        const movement = await tx.stock_movements.create({
          data: {
            consumableId: data.consumableId,
            type: data.type,
            quantity: data.quantity,
            reason: data.reason,
            userId,
          },
          include: {
            consumable: true,
            user: true,
          }
        })

        // Actualizar stock actual
        await tx.consumables.update({
          where: { id: data.consumableId },
          data: { currentStock: newStock }
        })

        // Registrar en auditoría
        await tx.audit_logs.create({
          data: {
            action: 'STOCK_MOVEMENT',
            entityType: 'consumable',
            entityId: data.consumableId,
            userId,
            details: {
              type: data.type,
              quantity: data.quantity,
              previousStock: consumable.currentStock,
              newStock,
            }
          }
        })

        return movement
      })

      return result as StockMovement
    } catch (error) {
      console.error('Error creando movimiento de stock:', error)
      throw error
    }
  }

  /**
   * Obtiene un consumible por ID
   */
  static async getConsumableById(id: string): Promise<Consumable | null> {
    try {
      const consumable = await prisma.consumables.findUnique({
        where: { id },
        include: {
          movements: {
            include: { user: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }
        }
      })

      return consumable as Consumable | null
    } catch (error) {
      console.error('Error obteniendo consumible:', error)
      throw error
    }
  }

  /**
   * Lista consumibles con filtros
   */
  static async listConsumables(filters: any): Promise<{ consumables: Consumable[], total: number }> {
    try {
      const where: any = {}

      if (filters.search) {
        where.name = { contains: filters.search, mode: 'insensitive' }
      }

      if (filters.type && filters.type.length > 0) {
        where.type = { in: filters.type }
      }

      if (filters.lowStock) {
        where.currentStock = { lte: prisma.consumables.fields.minStock }
      }

      const [consumables, total] = await Promise.all([
        prisma.consumables.findMany({
          where,
          include: {
            movements: {
              include: { user: true },
              orderBy: { createdAt: 'desc' },
              take: 5,
            }
          },
          skip: (filters.page - 1) * filters.limit,
          take: filters.limit,
          orderBy: { name: 'asc' },
        }),
        prisma.consumables.count({ where }),
      ])

      return { consumables: consumables as Consumable[], total }
    } catch (error) {
      console.error('Error listando consumibles:', error)
      throw error
    }
  }

  /**
   * Obtiene resumen de consumibles
   */
  static async getConsumableSummary(): Promise<ConsumableSummary> {
    try {
      const [total, lowStock, outOfStock, byType, totalValueResult, recentMovements] = await Promise.all([
        prisma.consumables.count(),
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count FROM consumables WHERE current_stock <= min_stock
        `,
        prisma.consumables.count({
          where: { currentStock: 0 }
        }),
        prisma.consumables.groupBy({
          by: ['type'],
          _count: true,
        }),
        prisma.$queryRaw<Array<{ total: number }>>`
          SELECT SUM(current_stock * COALESCE(cost_per_unit, 0)) as total FROM consumables
        `,
        prisma.stock_movements.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // últimos 7 días
            }
          }
        }),
      ])

      const byTypeMap: Record<string, number> = {}
      byType.forEach(item => {
        byTypeMap[item.type] = item._count
      })

      return {
        total,
        lowStock: Number(lowStock[0]?.count || 0),
        outOfStock,
        byType: byTypeMap,
        totalValue: totalValueResult[0]?.total || 0,
        recentMovements,
      }
    } catch (error) {
      console.error('Error obteniendo resumen de consumibles:', error)
      throw error
    }
  }

  /**
   * Verifica si un consumible tiene stock bajo
   */
  static isLowStock(consumable: Consumable): boolean {
    return consumable.currentStock <= consumable.minStock
  }

  /**
   * Obtiene consumibles con stock bajo
   */
  static async getLowStockConsumables(): Promise<Consumable[]> {
    try {
      const consumables = await prisma.$queryRaw<Consumable[]>`
        SELECT * FROM consumables 
        WHERE current_stock <= min_stock 
        ORDER BY (current_stock / NULLIF(min_stock, 0)) ASC
      `

      return consumables
    } catch (error) {
      console.error('Error obteniendo consumibles con stock bajo:', error)
      throw error
    }
  }

  /**
   * Obtiene historial de movimientos de un consumible
   */
  static async getConsumableMovements(consumableId: string, limit: number = 50): Promise<StockMovement[]> {
    try {
      const movements = await prisma.stock_movements.findMany({
        where: { consumableId },
        include: {
          consumable: true,
          user: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return movements as StockMovement[]
    } catch (error) {
      console.error('Error obteniendo movimientos:', error)
      throw error
    }
  }
}
