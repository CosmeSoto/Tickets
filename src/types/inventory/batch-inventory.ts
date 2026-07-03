/**
 * Tipos TypeScript para gestión de lotes de equipos
 */

export interface BatchCommonData {
  modelId: string
  supplierId: string
  departmentId?: string
  condition?: string
  propertyType?: string
  purchaseDate?: Date
  unitPrice?: number
  invoiceNumber?: string
  purchaseOrderNumber?: string
  warehouseId?: string
  customValues?: Record<string, any>
  accessories?: Array<{ name: string; quantity: number }>
  notes?: string
}

export interface BatchIndividualData {
  code: string
  serialNumber?: string
  physicalLocation?: string
  warehouseId?: string
}

export interface BatchCreationData {
  quantity: number
  commonData: BatchCommonData
  individualData: BatchIndividualData[]
}

export interface BatchSummary {
  id: string
  batchCode: string
  description?: string
  modelId: string
  quantity: number
  supplierId: string
  purchaseDate: Date
  unitPrice: number
  totalPrice: number
  status: string
  createdAt: Date
}

export interface BatchMetrics {
  total: number
  available: number
  assigned: number
  maintenance: number
  retired: number
  utilizationRate: number
}

export interface BatchFilters {
  modelId?: string
  typeId?: string
  supplierId?: string
  departmentId?: string
  status?: string
  dateFrom?: Date
  dateTo?: Date
}

export interface BatchHistoryEvent {
  type: 'created' | 'assigned' | 'returned' | 'maintenance' | 'retired' | string
  date: Date
  user?: { name?: string | null } | null
  description: string
  equipmentCode?: string
}

export interface BatchDepreciationSummary {
  method: string
  methodLabel: string
  usefulLifeYears: number
  residualValuePerUnit: number
  equipmentWithDepreciation: number
  totalUnits: number
  totalPurchaseValue: number
  totalBookValue: number
  totalAccumulatedDepreciation: number
}

/** Plantilla para crear un lote similar a uno existente */
export interface BatchCloneTemplate {
  sourceBatchId: string
  sourceBatchCode: string
  familyId: string
  familyCode?: string
  modelId: string
  typeId: string
  brand: string
  model: string
  quantity: number
  condition: string
  ownershipType: string
  departmentId?: string
  supplierId?: string
  unitPrice?: number
  purchaseDate?: string
  invoiceNumber?: string
  purchaseOrderNumber?: string
  warehouseId?: string
  notes?: string
  accessories?: string[]
}

/** Resumen de utilización de lotes para dashboard */
export interface BatchUtilizationOverview {
  summary: {
    totalBatches: number
    criticalCount: number
    warningCount: number
    avgUtilization: number
    totalAvailable: number
    totalAssigned: number
    totalUnits: number
  }
  criticalBatches: Array<{
    id: string
    batchCode: string
    brandModel: string
    typeName?: string
    metrics: BatchMetrics
    topAlert: string
    alertLevel: 'critical' | 'warning'
  }>
  byModel: Array<{
    modelId: string
    brand: string
    model: string
    typeName?: string
    batchCount: number
    totalUnits: number
    available: number
    assigned: number
    utilizationRate: number
  }>
}

export interface BatchWithMetrics extends BatchSummary {
  metrics: BatchMetrics
}
