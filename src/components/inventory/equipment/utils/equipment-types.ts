/**
 * Types and interfaces for Equipment Detail module
 */

import type { BatchMetrics } from '@/types/inventory/batch-inventory'

export interface EquipmentDetailResponse {
  equipment: Equipment
  currentAssignment?: Assignment
  history: HistoryEvent[]
  maintenanceRecords?: MaintenanceRecord[]
  canManageInventory?: boolean
  batch?: {
    id: string
    batchCode: string
    quantity: number
    purchaseDate: string | Date
    unitPrice?: number | null
  }
  batchMetrics?: BatchMetrics
}

export interface Equipment {
  id: string
  code: string
  type?: EquipmentType
  // Campo legacy (string) — se mantiene por compatibilidad con datos viejos
  brand: string
  // Campo nuevo: relación con el catálogo de modelos
  model?: {
    brand?: { name: string } | null
    model: string
  } | null
  // Campo legacy (string) — se mantiene por compatibilidad con datos viejos
  modelDeprecated?: string
  serialNumber: string
  status: EquipmentStatus
  condition: EquipmentCondition
  ownershipType: OwnershipType
  purchaseDate?: string
  purchasePrice?: number
  warrantyExpiration?: string
  location?: string
  accessories?: string[]
  specifications?: Record<string, any>
  notes?: string
  usefulLifeYears?: number
  residualValue?: number
  depreciation?: any
  batchId?: string | null
  supplierId?: string
  invoiceNumber?: string
  purchaseOrderNumber?: string
  saleListingPrice?: number | null
  rentalStartDate?: string | null
  rentalEndDate?: string | null
  rentalMonthlyCost?: number | null
  rentalDeliveryDate?: string | null
  rentalBuyoutValue?: number | null
  rentalClientResponse?:
    | 'NOT_NOTIFIED'
    | 'PENDING_DECISION'
    | 'PURCHASE_CONFIRMED'
    | 'RETURN_REQUESTED'
    | 'RENEWAL_REQUESTED'
  rentalContractNumber?: string | null
}

export interface EquipmentType {
  id: string
  name: string
  family?: {
    id: string
    name: string
  }
}

export interface Assignment {
  id: string
  receiverId: string
  receiver?: {
    name: string
    email: string
  }
  startDate: string
  endDate?: string
  assignmentType: 'PERMANENT' | 'TEMPORARY' | 'LOAN'
  observations?: string
}

export interface HistoryEvent {
  id: string
  action: string
  date: string
  user?: {
    name: string
    email: string
  }
  details?: any
}

export interface MaintenanceRecord {
  id: string
  type: 'PREVENTIVE' | 'CORRECTIVE'
  description: string
  date: string
  status?: 'REQUESTED' | 'SCHEDULED' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED'
  cost?: number
  technician?: {
    name: string
  }
}

export type EquipmentStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'MAINTENANCE'
  | 'DAMAGED'
  | 'RETIRED'
  | 'FOR_SALE'
  | 'SOLD'
export type EquipmentCondition = 'NEW' | 'USED' | 'DAMAGED'
export type OwnershipType = 'FIXED_ASSET' | 'RENTAL' | 'LOAN'

export interface AssignmentForm {
  receiverId: string
  assignmentType: 'PERMANENT' | 'TEMPORARY' | 'LOAN'
  startDate: string
  endDate: string
  observations: string
}

export interface ReturnForm {
  returnDate: string
  observations: string
  condition: string
}

export interface MaintenanceForm {
  type: 'PREVENTIVE' | 'CORRECTIVE'
  description: string
  /** "YYYY-MM-DDTHH:mm" (DateTimePicker) o ISO */
  scheduledDate: string
  /** ID del proveedor externo seleccionado de la lista */
  externalProviderId?: string
  /** Notas adicionales internas */
  notes?: string
}
