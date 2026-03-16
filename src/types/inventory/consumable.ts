import { ConsumableType, MovementType, Prisma } from '@prisma/client'

export type Consumable = Prisma.consumablesGetPayload<{
  include: {
    movements: {
      include: {
        user: true
      }
    }
  }
}>

export type StockMovement = Prisma.stock_movementsGetPayload<{
  include: {
    consumable: true
    user: true
  }
}>

export interface CreateConsumableData {
  name: string
  type: ConsumableType
  unitOfMeasure: string
  currentStock: number
  minStock: number
  maxStock: number
  costPerUnit?: number
  compatibleEquipment?: string[]
}

export interface UpdateConsumableData {
  name?: string
  type?: ConsumableType
  unitOfMeasure?: string
  minStock?: number
  maxStock?: number
  costPerUnit?: number
  compatibleEquipment?: string[]
}

export interface CreateStockMovementData {
  consumableId: string
  type: MovementType
  quantity: number
  reason?: string
}

export interface ConsumableSummary {
  total: number
  lowStock: number
  outOfStock: number
  byType: Record<string, number>
  totalValue: number
  recentMovements: number
}
