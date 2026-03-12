import { 
  EquipmentType, 
  EquipmentStatus, 
  EquipmentCondition, 
  OwnershipType 
} from '@prisma/client'

// Equipment interface
export interface Equipment {
  id: string
  code: string
  serialNumber: string
  brand: string
  model: string
  type: EquipmentType
  status: EquipmentStatus
  condition: EquipmentCondition
  ownershipType: OwnershipType
  purchaseDate?: Date
  purchasePrice?: number
  warrantyExpiration?: Date
  specifications?: Record<string, any>
  accessories: string[]
  location?: string
  notes?: string
  photoUrl?: string
  qrCode: string
  createdAt: Date
  updatedAt: Date
}

// Equipment with relations
export interface EquipmentWithRelations extends Equipment {
  assignments?: any[]
  maintenanceRecords?: any[]
  licenses?: any[]
}

// Equipment form data
export interface EquipmentFormData {
  code: string
  serialNumber: string
  brand: string
  model: string
  type: EquipmentType
  status?: EquipmentStatus
  condition: EquipmentCondition
  ownershipType: OwnershipType
  purchaseDate?: Date | string
  purchasePrice?: number
  warrantyExpiration?: Date | string
  specifications?: Record<string, any>
  accessories?: string[]
  location?: string
  notes?: string
  photo?: File
}

// Equipment filters
export interface EquipmentFilters {
  search?: string
  type?: EquipmentType[]
  status?: EquipmentStatus[]
  condition?: EquipmentCondition[]
  assignedTo?: string
  departmentId?: string
}

// Equipment list response
export interface EquipmentListResponse {
  equipment: Equipment[]
  total: number
  page: number
  limit: number
}

// Equipment detail response
export interface EquipmentDetailResponse {
  equipment: EquipmentWithRelations
  currentAssignment?: any
  history: EquipmentHistoryEvent[]
  maintenanceRecords: any[]
}

// Equipment history event
export interface EquipmentHistoryEvent {
  id: string
  type: 'CREATED' | 'UPDATED' | 'ASSIGNED' | 'RETURNED' | 'MAINTENANCE' | 'STATUS_CHANGE' | 'CONDITION_CHANGE'
  description: string
  userId?: string
  userName?: string
  timestamp: Date
  metadata?: Record<string, any>
}

// Equipment summary for dashboard
export interface EquipmentSummary {
  total: number
  available: number
  assigned: number
  maintenance: number
  damaged: number
  retired: number
  byType: Record<EquipmentType, number>
  byCondition: Record<EquipmentCondition, number>
  totalValue: number
}
