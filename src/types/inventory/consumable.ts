import { MovementType, Prisma } from '@prisma/client'

export type Consumable = Prisma.consumablesGetPayload<{
  include: {
    consumableType: true
    unitOfMeasure: true
    assignedEquipment: true
    movements: {
      include: {
        user: true
        assignedToUser: true
        assignedToEquipment: true
      }
    }
  }
}>

export type StockMovement = Prisma.stock_movementsGetPayload<{
  include: {
    consumable: true
    user: true
    assignedToUser: true
    assignedToEquipment: true
  }
}>

export interface CreateConsumableData {
  name: string
  typeId: string
  unitOfMeasureId: string
  assignedEquipmentId?: string
  currentStock: number
  minStock: number
  maxStock: number
  costPerUnit?: number
  location?: string
  notes?: string
  compatibleEquipment?: string[]
}

export interface UpdateConsumableData {
  name?: string
  typeId?: string
  unitOfMeasureId?: string
  assignedEquipmentId?: string | null
  minStock?: number
  maxStock?: number
  costPerUnit?: number
  location?: string
  notes?: string
  compatibleEquipment?: string[]
}

export interface CreateStockMovementData {
  consumableId: string
  type: MovementType
  quantity: number
  reason?: string
  assignedToUserId?: string
  assignedToEquipmentId?: string
}

export interface ConsumableSummary {
  total: number
  lowStock: number
  outOfStock: number
  byType: Record<string, number>
  totalValue: number
  recentMovements: number
}
