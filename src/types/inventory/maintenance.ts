import { Prisma } from '@prisma/client'

export type MaintenanceRecord = Prisma.maintenance_recordsGetPayload<{
  include: {
    equipment: true
    technician: true
    supplier: true
    ticket: true
    contract: true
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
  /** Proveedor externo que realizará el mantenimiento */
  supplierId?: string
  /** Contrato de mantenimiento/soporte vinculado (opcional) */
  contractId?: string
  requestedById?: string
  notes?: string
}

export interface UpdateMaintenanceData {
  completedDate?: Date
  cost?: number
  partsReplaced?: string[]
  notes?: string
  /** Factura del proveedor externo */
  supplierInvoice?: string
  /** Fecha de vencimiento de garantía del proveedor */
  warrantyExpiresAt?: Date
}
