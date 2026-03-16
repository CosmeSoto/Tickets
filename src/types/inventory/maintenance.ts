import { Prisma } from '@prisma/client'

/**
 * Tipos para registros de mantenimiento
 */

export type MaintenanceRecord = Prisma.maintenance_recordsGetPayload<{
  include: {
    equipment: true
    technician: true
    ticket: true
  }
}>

export interface CreateMaintenanceData {
  equipmentId: string
  type: 'PREVENTIVE' | 'CORRECTIVE'
  description: string
  scheduledDate: Date
  completedDate?: Date
  cost?: number
  partsReplaced?: string[]
  ticketId?: string
  technicianId: string
}

export interface UpdateMaintenanceData {
  completedDate?: Date
  cost?: number
  partsReplaced?: string[]
  notes?: string
}

export interface MaintenanceSummary {
  id: string
  type: string
  description: string
  scheduledDate: Date
  completedDate?: Date
  cost?: number
  technicianName: string
  equipmentCode: string
}
