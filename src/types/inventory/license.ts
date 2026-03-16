import { LicenseType, Prisma } from '@prisma/client'

/**
 * Tipos para licencias de software
 */

export type SoftwareLicense = Prisma.software_licensesGetPayload<{
  include: {
    equipment: true
    user: true
  }
}>

export interface CreateLicenseData {
  name: string
  type: LicenseType
  key: string
  purchaseDate: Date
  expirationDate?: Date
  cost?: number
  vendor?: string
}

export interface UpdateLicenseData {
  name?: string
  type?: LicenseType
  key?: string
  expirationDate?: Date
  cost?: number
  vendor?: string
}

export interface AssignLicenseData {
  assignedToEquipment?: string
  assignedToUser?: string
}

export interface LicenseSummary {
  total: number
  active: number
  expired: number
  expiringThisMonth: number
  expiringSoon: number // próximos 30 días
  unassigned: number
  byType: Record<string, number>
  totalCost: number
}

export interface LicenseListResponse {
  licenses: SoftwareLicense[]
  total: number
  page: number
  limit: number
}
