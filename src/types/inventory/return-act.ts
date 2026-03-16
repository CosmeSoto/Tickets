import { Prisma } from '@prisma/client'

/**
 * Tipos para actas de devolución
 */

// Tipo base del acta de devolución desde Prisma
export type ReturnAct = Prisma.return_actsGetPayload<{
  include: {
    assignment: {
      include: {
        equipment: true
        receiver: true
        deliverer: true
      }
    }
    deliveryAct: true
  }
}>

// Información del usuario en el snapshot
export interface UserInfo {
  id: string
  name: string
  email: string
  role: string
  department?: string
}

// Snapshot del equipo en el momento de la devolución
export interface EquipmentSnapshot {
  id: string
  code: string
  serialNumber: string
  brand: string
  model: string
  type: string
  condition: string
  specifications?: any
}

// Datos para crear un acta de devolución
export interface CreateReturnActData {
  assignmentId: string
  returnCondition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED'
  inspectionNotes?: string
  missingAccessories?: string[]
  damageDescription?: string
  returnDate?: Date
}

// Datos para aceptar un acta de devolución
export interface AcceptReturnActData {
  ipAddress: string
  userAgent: string
}

// Datos para rechazar un acta de devolución
export interface RejectReturnActData {
  reason: string
  userId: string
}

// Resumen de acta de devolución
export interface ReturnActSummary {
  id: string
  folio: string
  status: string
  equipmentCode: string
  equipmentDescription: string
  receiverName: string
  delivererName: string
  returnDate: Date
  returnCondition: string
  createdAt: Date
  acceptedAt?: Date
  rejectedAt?: Date
}
