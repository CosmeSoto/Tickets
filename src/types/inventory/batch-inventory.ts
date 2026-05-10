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

export interface BatchWithMetrics extends BatchSummary {
  metrics: BatchMetrics
}
