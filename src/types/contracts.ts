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

export type SubscriptionUsageStatus = 'ACTIVE' | 'UNUSED' | 'PENDING_CANCEL' | 'CANCELLED'
export type PaymentCardBrand = 'VISA' | 'MASTERCARD' | 'AMEX' | 'OTHER'
export type PaymentMethodType =
  | 'CORPORATE_CARD'
  | 'PAYPAL'
  | 'CRYPTO'
  | 'BANK_TRANSFER'
  | 'PROVIDER_INVOICE'
  | 'OTHER'
export type SubscriptionServiceType =
  | 'SOCIAL_MEDIA'
  | 'CONTENT'
  | 'AUDIOVISUAL'
  | 'ARTIFICIAL_INTELLIGENCE'
  | 'EDUCATION_LMS'
  | 'CLOUD_SERVICES'
  | 'DESIGN'
  | 'COMMUNICATIONS'
  | 'DIGITAL_ADS'
  | 'OTHER'

export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  CORPORATE_CARD: 'Tarjeta corporativa',
  PAYPAL: 'PayPal',
  CRYPTO: 'Criptomonedas',
  BANK_TRANSFER: 'Transferencia bancaria',
  PROVIDER_INVOICE: 'Factura del proveedor',
  OTHER: 'Otro método',
}

export const SUBSCRIPTION_SERVICE_TYPE_LABELS: Record<SubscriptionServiceType, string> = {
  SOCIAL_MEDIA: 'Redes sociales',
  CONTENT: 'Contenido / editorial',
  AUDIOVISUAL: 'Servicios audiovisuales',
  ARTIFICIAL_INTELLIGENCE: 'Inteligencia artificial',
  EDUCATION_LMS: 'Educación / LMS (Canvas, etc.)',
  CLOUD_SERVICES: 'Servicios en la nube',
  DESIGN: 'Diseño y creatividad',
  COMMUNICATIONS: 'Comunicaciones / internet',
  DIGITAL_ADS: 'Publicidad digital / Ads',
  OTHER: 'Otro servicio',
}

export const SUBSCRIPTION_USAGE_STATUS_LABELS: Record<SubscriptionUsageStatus, string> = {
  ACTIVE: 'En uso',
  UNUSED: 'Sin uso',
  PENDING_CANCEL: 'Pendiente de cancelación',
  CANCELLED: 'Cancelada',
}

export const PAYMENT_CARD_BRAND_LABELS: Record<PaymentCardBrand, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  AMEX: 'American Express',
  OTHER: 'Otra',
}

/** Categorías con gobernanza de suscripción recurrente */
export const SUBSCRIPTION_GOVERNANCE_CATEGORIES: ContractCategory[] = [
  'SERVICE',
  'SOFTWARE_LICENSE',
  'SUPPORT',
  'MAINTENANCE',
]

export const EXPIRING_DAYS = 30 // días antes del vencimiento para alertar

export type ContractAmendmentType =
  | 'PRICE_CHANGE'
  | 'TERM_EXTENSION'
  | 'TERM_REDUCTION'
  | 'SCOPE_CHANGE'
  | 'BILLING_CHANGE'
  | 'CANCELLATION'
  | 'OTHER'

export const CONTRACT_AMENDMENT_TYPE_LABELS: Record<ContractAmendmentType, string> = {
  PRICE_CHANGE: 'Cambio de precio',
  TERM_EXTENSION: 'Extensión de vigencia',
  TERM_REDUCTION: 'Reducción de vigencia',
  SCOPE_CHANGE: 'Cambio de alcance',
  BILLING_CHANGE: 'Cambio de facturación',
  CANCELLATION: 'Cancelación',
  OTHER: 'Otro',
}

export interface ContractAmendment {
  id: string
  contractId: string
  folio: string
  amendmentNumber: number
  title: string
  description?: string | null
  type: ContractAmendmentType
  status: string
  effectiveDate: string
  applyToContract: boolean
  previousMonthlyCost?: number | null
  newMonthlyCost?: number | null
  previousTotalValue?: number | null
  newTotalValue?: number | null
  previousEndDate?: string | null
  newEndDate?: string | null
  previousBillingCycle?: BillingCycle | null
  newBillingCycle?: BillingCycle | null
  createdAt: string
  creator?: { id: string; name: string; email: string }
}

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
  serviceSubtype?: SubscriptionServiceType | null
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
  // Gobernanza de suscripción
  custodianUserId?: string | null
  backupCustodianUserId?: string | null
  billingAccountEmail?: string | null
  billingPortalUrl?: string | null
  vendorAccountId?: string | null
  paymentMethodType?: PaymentMethodType
  paymentAccountRef?: string | null
  paymentCardBrand?: string | null
  paymentCardLast4?: string | null
  paymentCardBank?: string | null
  paymentCardExpiry?: string | null
  corporateCardLabel?: string | null
  lastChargeDate?: string | null
  lastChargeAmount?: number | null
  lastTransactionRef?: string | null
  subscriptionUsageStatus?: SubscriptionUsageStatus
  cancellationNoticeDays?: number | null
  createdBy: string
  createdAt: string
  updatedAt: string
  // Relaciones
  supplier?: { id: string; name: string } | null
  family?: { id: string; name: string; color?: string | null; code: string } | null
  creator?: { id: string; name: string; email: string } | null
  custodian?: { id: string; name: string; email: string; role?: string } | null
  backupCustodian?: { id: string; name: string; email: string; role?: string } | null
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
  serviceSubtype: SubscriptionServiceType | ''
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
  // Facturación y responsables
  paymentMethodType: PaymentMethodType
  paymentAccountRef: string
  custodianUserId: string
  backupCustodianUserId: string
  billingAccountEmail: string
  billingPortalUrl: string
  vendorAccountId: string
  paymentCardBrand: PaymentCardBrand | ''
  paymentCardLast4: string
  paymentCardBank: string
  paymentCardExpiry: string
  corporateCardLabel: string
  lastChargeDate: string
  lastChargeAmount: string
  lastTransactionRef: string
  subscriptionUsageStatus: SubscriptionUsageStatus
  cancellationNoticeDays: string
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
