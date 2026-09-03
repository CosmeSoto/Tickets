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

export type LicenseType = Prisma.license_typesGetPayload<Record<string, never>>

export interface CreateLicenseData {
  /** Código de inventario — mismo esquema que equipos (ver
   * asset-code-generator.ts). Se resuelve antes de llegar acá, no se genera
   * dentro del servicio, para que la lógica de generación quede en un solo
   * lugar compartido con equipos/MRO. */
  code: string
  name: string
  typeId: string
  key?: string
  purchaseDate?: Date
  expirationDate?: Date
  cost?: number
  vendor?: string
  supplierId?: string // ID del proveedor en el catálogo de proveedores
  invoiceNumber?: string
  purchaseOrderNumber?: string
  renewalCost?: number
  renewalDate?: Date
  licenseScope?: 'INDIVIDUAL' | 'DEPARTMENT' | 'COMPANY'
  contractType?: 'SOFTWARE' | 'SERVICE_EXTERNAL' | 'MAINTENANCE' | 'INSURANCE' | 'SLA'
  notes?: string
  assignedToEquipment?: string
  assignedToUser?: string
  assignedToDepartment?: string
  /** Atributos personalizados del tipo de licencia */
  customValues?: Array<{ fieldName: string; fieldValue: string }>
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
  /** Atributos personalizados del tipo de licencia */
  customValues?: Array<{ fieldName: string; fieldValue: string }>
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
