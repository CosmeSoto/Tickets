/**
 * Tipos TypeScript para gestión de equipos
 */

import { Prisma } from '@prisma/client'

export type EquipmentWithRelations = Prisma.equipmentGetPayload<{
  include: {
    type: true
    department: true
    warehouse: true
    model: true
  }
}>

export interface EquipmentFilters {
  batchId?: string
  modelId?: string
  typeId?: string
  departmentId?: string
  warehouseId?: string
  status?: string
  condition?: string
  search?: string
}

export type EquipmentStatus = 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'RETIRED' | 'LOST' | 'SOLD'

export type EquipmentCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR'

export type OwnershipType = 'FIXED_ASSET' | 'RENTAL' | 'LOAN'
