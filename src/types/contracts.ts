/**
 * Tipos del módulo de Contratos
 */

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED' | 'RENEWED'
export type ContractCategory = 'EQUIPMENT_RENTAL' | 'SOFTWARE_LICENSE' | 'SERVICE' | 'MAINTENANCE' | 'SUPPORT' | 'OTHER'
export type ContractLineType = 'EQUIPMENT' | 'SOFTWARE' | 'SERVICE' | 'CONSUMABLE' | 'OTHER'
export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'ONE_TIME'

// ── Labels ────────────────────────────────────────────────────────────────────

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT:      'Borrador',
  ACTIVE:     'Vigente',
  EXPIRING:   'Por vencer',
  EXPIRED:    'Vencido',
  TERMINATED: 'Terminado',
  RENEWED:    'Renovado',
}

export const CONTRACT_CATEGORY_LABELS: Record<ContractCategory, string> = {
  EQUIPMENT_RENTAL: 'Arrendamiento de equipo',
  SOFTWARE_LICENSE: 'Licencia de software',
  SERVICE:          'Servicio',
  MAINTENANCE:      'Mantenimiento',
  SUPPORT:          'Soporte',
  OTHER:            'Otro',
}

export const CONTRACT_LINE_TYPE_LABELS: Record<ContractLineType, string> = {
  EQUIPMENT:  'Equipo',
  SOFTWARE:   'Software',
  SERVICE:    'Servicio',
  CONSUMABLE: 'Consumible',
  OTHER:      'Otro',
}

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY:    'Mensual',
  QUARTERLY:  'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL:     'Anual',
  ONE_TIME:   'Pago único',
}

export const EXPIRING_DAYS = 30 // días antes del vencimiento para alertar

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ContractLine {
  id: string
  contractId: string
  type: ContractLineType
  description: string
  quantity: number
  unitPrice?: number | null
  totalPrice?: number | null
  equipmentId?: string | null
  licenseId?: string | null
  notes?: string | null
  order: number
  createdAt: string
  updatedAt: string
  // Relaciones opcionales
  equipment?: { id: string; code: string; brand: string; model: string } | null
  license?: { id: string; name: string } | null
}

export interface ContractAttachment {
  id: string
  contractId: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  path: string
  uploadedBy: string
  createdAt: string
}

export interface Contract {
  id: string
  contractNumber?: string | null
  name: string
  description?: string | null
  category: ContractCategory
  status: ContractStatus
  supplierId?: string | null
  familyId?: string | null
  startDate?: string | null
  endDate?: string | null
  autoRenew: boolean
  renewalNoticeDays: number
  billingCycle: BillingCycle
  totalValue?: number | null
  monthlyCost?: number | null
  currency: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  notes?: string | null
  termsUrl?: string | null
  expiryAlertSentAt?: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  // Relaciones
  supplier?: { id: string; name: string } | null
  family?: { id: string; name: string; color?: string | null; code: string } | null
  creator?: { id: string; name: string; email: string } | null
  lines?: ContractLine[]
  attachments?: ContractAttachment[]
  // Calculados
  daysUntilExpiry?: number
}

// ── Formulario ────────────────────────────────────────────────────────────────

export interface ContractFormData {
  contractNumber: string
  name: string
  description: string
  category: ContractCategory
  supplierId: string
  familyId: string
  startDate: string
  endDate: string
  autoRenew: boolean
  renewalNoticeDays: number
  billingCycle: BillingCycle
  totalValue: string
  monthlyCost: string
  currency: string
  contactName: string
  contactEmail: string
  contactPhone: string
  notes: string
  termsUrl: string
  lines: ContractLineFormData[]
}

export interface ContractLineFormData {
  id?: string
  type: ContractLineType
  description: string
  quantity: string
  unitPrice: string
  equipmentId: string
  licenseId: string
  notes: string
  order: number
}

// ── API responses ─────────────────────────────────────────────────────────────

export interface ContractsListResponse {
  contracts: Contract[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  stats: {
    total: number
    active: number
    expiring: number
    expired: number
    draft: number
    monthlyCostTotal: number
  }
}
