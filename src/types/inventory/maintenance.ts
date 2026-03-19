import { Prisma } from '@prisma/client'

export type MaintenanceRecord = Prisma.maintenance_recordsGetPayload<{
  include: {
    equipment: true
    technician: true
    ticket: true
  }
}>

export type MaintenanceStatus = 'REQUESTED' | 'SCHEDULED' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED'

export interface CreateMaintenanceData {
  equipmentId: string
  type: 'PREVENTIVE' | 'CORRECTIVE'
  description: string
  scheduledDate: Date
  cost?: number
  partsReplaced?: string[]
  ticketId?: string
  technicianId?: string
  requestedById?: string
  notes?: string
}

export interface UpdateMaintenanceData {
  completedDate?: Date
  cost?: number
  partsReplaced?: string[]
  notes?: string
}
