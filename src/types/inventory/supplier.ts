/**
 * Tipos del maestro de proveedores (inventario / AP).
 */

export type SupplierBankAccountType = 'CHECKING' | 'SAVINGS' | 'OTHER'

export interface Supplier {
  id: string
  name: string
  legalName?: string | null
  typeId?: string | null
  familyId?: string | null
  taxId?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  country?: string | null
  website?: string | null
  contactName?: string | null
  paymentTermsDays?: number | null
  creditLimit?: number | string | null
  creditCurrency?: string | null
  preferredPaymentMethod?: string | null
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountType?: SupplierBankAccountType | string | null
  bankSwift?: string | null
  notes?: string | null
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
  supplierType?: { id: string; name: string } | null
  family?: { id: string; name: string; color?: string | null } | null
  commercialSummary?: {
    openContracts: number
    monthlyCommitment: number
    currency: string
    creditLimit: number | null
    creditCurrency: string
    annualizedCommitment: number
    referenceStatus: 'ok' | 'high' | 'unknown'
  }
}
