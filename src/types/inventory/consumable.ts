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
    supplier: true
  }
}>

export interface CreateConsumableData {
  name: string
  typeId?: string
  unitOfMeasureId?: string
  assignedEquipmentId?: string
  currentStock: number
  minStock: number
  maxStock: number
  costPerUnit?: number
  location?: string
  notes?: string
  compatibleEquipment?: string[]
  customValues?: Array<{ fieldName: string; fieldValue: string }>
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
  customValues?: Array<{ fieldName: string; fieldValue: string }>
}

export interface CreateStockMovementData {
  consumableId: string
  type: MovementType
  quantity: number
  reason?: string
  assignedToUserId?: string
  assignedToEquipmentId?: string
  /** ISO date YYYY-MM-DD — se guarda como createdAt del movimiento */
  occurredAt?: string
  // Datos de compra — opcionales, solo se persisten cuando type=ENTRY.
  // Alimentan también costPerUnit/supplierId del suministro (ver
  // ConsumableService.createStockMovement).
  amount?: number
  currency?: string
  invoiceNumber?: string
  purchaseOrderNumber?: string
  supplierId?: string
  paymentMethod?: string
  bankEntity?: string
  referenceNumber?: string
  cardLast4?: string
  cardBrand?: string
  transactionId?: string
}

export interface ConsumableSummary {
  total: number
  lowStock: number
  outOfStock: number
  byType: Record<string, number>
  totalValue: number
  recentMovements: number
}
