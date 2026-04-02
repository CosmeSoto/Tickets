import { 
  EquipmentStatus, 
  EquipmentCondition, 
  OwnershipType 
} from '@prisma/client'

// Equipment type from DB
export interface EquipmentTypeInfo {
  id: string
  code: string
  name: string
  description?: string
  icon?: string
  isActive: boolean
  order: number
}

// Department info embedded in equipment
export interface EquipmentDepartmentInfo {
  id: string
  name: string
  familyId: string | null
  family?: {
    id: string
    name: string
    code: string
    color?: string
  } | null
}

// Equipment interface
export interface Equipment {
  id: string
  code: string
  serialNumber: string
  brand: string
  model: string
  typeId: string
  type?: EquipmentTypeInfo
  departmentId?: string
  department?: EquipmentDepartmentInfo | null
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
  rentalProvider?: string
  rentalContractNumber?: string
  rentalStartDate?: Date
  rentalEndDate?: Date
  rentalMonthlyCost?: number
  rentalContactName?: string
  rentalContactEmail?: string
  rentalContactPhone?: string
  rentalNotes?: string
  createdAt: Date
  updatedAt: Date
  // Active assignment (populated when fetched from detail endpoint)
  currentAssignment?: { id: string; isActive: boolean } | null
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
  typeId: string
  departmentId: string
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
  rentalProvider?: string
  rentalContractNumber?: string
  rentalStartDate?: Date | string
  rentalEndDate?: Date | string
  rentalMonthlyCost?: number
  rentalContactName?: string
  rentalContactEmail?: string
  rentalContactPhone?: string
  rentalNotes?: string
}

// Equipment filters
export interface EquipmentFilters {
  search?: string
  typeId?: string[]
  status?: EquipmentStatus[]
  condition?: EquipmentCondition[]
  assignedTo?: string
  familyId?: string
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
  byType: Record<string, number>
  byCondition: Record<EquipmentCondition, number>
  totalValue: number
}

// Rental equipment summary
export interface RentalEquipmentSummary {
  totalRented: number
  activeRentals: number
  expiringThisMonth: number
  expiringSoon: number
  totalMonthlyCost: number
  byProvider: Record<string, {
    count: number
    monthlyCost: number
  }>
  expiringContracts: Array<{
    id: string
    code: string
    provider: string
    endDate: Date
    daysRemaining: number
  }>
}
