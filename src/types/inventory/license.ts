import { Prisma } from '@prisma/client'

/**
 * Tipos para licencias de software / contratos
 */

export type SoftwareLicense = Prisma.software_licensesGetPayload<{
  include: {
    licenseType: true
    equipment: true
    user: true
    department: true
  }
}>

export type LicenseType = Prisma.license_typesGetPayload<{}>

export interface CreateLicenseData {
  name: string
  typeId: string
  key?: string
  purchaseDate?: Date
  expirationDate?: Date
  cost?: number
  vendor?: string
  notes?: string
  assignedToEquipment?: string
  assignedToUser?: string
  assignedToDepartment?: string
}

export interface UpdateLicenseData {
  name?: string
  typeId?: string
  key?: string
  purchaseDate?: Date
  expirationDate?: Date
  cost?: number
  vendor?: string
  notes?: string
  assignedToEquipment?: string | null
  assignedToUser?: string | null
  assignedToDepartment?: string | null
}

export interface AssignLicenseData {
  assignedToEquipment?: string
  assignedToUser?: string
  assignedToDepartment?: string
}

export interface LicenseSummary {
  total: number
  active: number
  expired: number
  expiringThisMonth: number
  expiringSoon: number
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
