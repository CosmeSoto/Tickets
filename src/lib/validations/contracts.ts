import { z } from 'zod'

/** Convierte '' / undefined a null para campos opcionales (Combobox / Select). */
const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v)

/** IDs de entidades (cuid o uuid) — proveedores usan cuid. */
const optionalEntityId = z.preprocess(emptyToNull, z.string().min(1).max(40).nullable().optional())

const optionalUuid = z.preprocess(emptyToNull, z.string().uuid().nullable().optional())

const optionalEnum = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(emptyToNull, schema.nullable().optional())

/** Email opcional: vacío → null (no falla .email()). */
const optionalEmail = z.preprocess(
  emptyToNull,
  z.string().email('Email inválido').max(200).nullable().optional()
)

/** URL opcional: vacío → null (no falla .url()). */
const optionalUrl = z.preprocess(
  emptyToNull,
  z.string().url('URL inválida').max(500).nullable().optional()
)

const optionalLast4 = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^\d{4}$/, 'Los últimos 4 dígitos deben ser exactamente 4 números')
    .nullable()
    .optional()
)

const optionalCardExpiry = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^\d{2}\/\d{4}$/, 'Vencimiento de tarjeta: usa formato MM/YYYY')
    .nullable()
    .optional()
)

// Valores exactos del enum ContractCategory en Prisma
export const CONTRACT_CATEGORY_VALUES = [
  'EQUIPMENT_RENTAL',
  'SOFTWARE_LICENSE',
  'SERVICE',
  'MAINTENANCE',
  'SUPPORT',
  'OTHER',
] as const

export const CONTRACT_BILLING_CYCLE_VALUES = [
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
  'ONE_TIME',
] as const

export const SUBSCRIPTION_USAGE_STATUS_VALUES = [
  'ACTIVE',
  'UNUSED',
  'PENDING_CANCEL',
  'CANCELLED',
] as const

export const PAYMENT_CARD_BRAND_VALUES = ['VISA', 'MASTERCARD', 'AMEX', 'OTHER'] as const

export const PAYMENT_METHOD_TYPE_VALUES = [
  'CORPORATE_CARD',
  'PAYPAL',
  'CRYPTO',
  'BANK_TRANSFER',
  'CHECK',
  'PROVIDER_INVOICE',
  'OTHER',
] as const

export const SUBSCRIPTION_SERVICE_TYPE_VALUES = [
  'SOCIAL_MEDIA',
  'CONTENT',
  'AUDIOVISUAL',
  'ARTIFICIAL_INTELLIGENCE',
  'EDUCATION_LMS',
  'CLOUD_SERVICES',
  'DESIGN',
  'COMMUNICATIONS',
  'DIGITAL_ADS',
  'OTHER',
] as const

/** Código del catálogo (enum legacy o personalizado). */
const serviceSubtypeSchema = z.preprocess(emptyToNull, z.string().max(50).nullable().optional())

const billingFieldsSchema = {
  serviceSubtype: serviceSubtypeSchema,
  paymentMethodType: z.enum(PAYMENT_METHOD_TYPE_VALUES).default('CORPORATE_CARD'),
  paymentAccountRef: z.string().max(300).optional().nullable(),
  custodianUserId: optionalUuid,
  backupCustodianUserId: optionalUuid,
  billingAccountEmail: optionalEmail,
  billingPortalUrl: optionalUrl,
  vendorAccountId: z.preprocess(emptyToNull, z.string().max(200).nullable().optional()),
  paymentCardBrand: optionalEnum(z.enum(PAYMENT_CARD_BRAND_VALUES)),
  paymentCardLast4: optionalLast4,
  paymentCardBank: z.preprocess(emptyToNull, z.string().max(100).nullable().optional()),
  paymentCardExpiry: optionalCardExpiry,
  corporateCardLabel: z.preprocess(emptyToNull, z.string().max(100).nullable().optional()),
  lastChargeDate: z.preprocess(emptyToNull, z.string().nullable().optional()),
  lastChargeAmount: z.preprocess(
    v => (v === '' || v === undefined ? null : v),
    z.number({ coerce: true }).min(0).nullable().optional()
  ),
  lastTransactionRef: z.preprocess(emptyToNull, z.string().max(200).nullable().optional()),
  subscriptionUsageStatus: z.enum(SUBSCRIPTION_USAGE_STATUS_VALUES).default('ACTIVE'),
}

export const CONTRACT_LINE_TYPE_VALUES = [
  'EQUIPMENT',
  'SOFTWARE',
  'SERVICE',
  'CONSUMABLE',
  'OTHER',
] as const

export const contractLineSchema = z.object({
  id: z.string().optional(),
  type: z.enum(CONTRACT_LINE_TYPE_VALUES).default('SERVICE'),
  description: z.string().min(1, 'La descripción de la línea es requerida').max(500),
  quantity: z.number({ coerce: true }).min(0.01, 'La cantidad debe ser mayor a 0').default(1),
  unitPrice: z.number({ coerce: true }).min(0).optional().nullable(),
  equipmentId: optionalUuid,
  licenseId: optionalUuid,
  notes: z.string().max(1000).optional().nullable(),
  serviceStartDate: z.preprocess(emptyToNull, z.string().nullable().optional()),
  serviceEndDate: z.preprocess(emptyToNull, z.string().nullable().optional()),
  order: z.number({ coerce: true }).int().min(0).default(0),
})

export const createContractSchema = z.object({
  contractNumber: z.string().max(100).optional().nullable(),
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  description: z.string().max(2000).optional().nullable(),
  // Fallback a 'SERVICE' si llega vacío (deselección del Combobox)
  category: z
    .enum(CONTRACT_CATEGORY_VALUES, {
      errorMap: () => ({ message: 'Categoría inválida' }),
    })
    .default('SERVICE'),
  supplierId: optionalEntityId,
  familyId: optionalEntityId,
  modelId: optionalUuid,
  batchId: optionalUuid,
  startDate: z.preprocess(emptyToNull, z.string().nullable().optional()),
  endDate: z.preprocess(emptyToNull, z.string().nullable().optional()),
  autoRenew: z.boolean().default(false),
  renewalNoticeDays: z.number({ coerce: true }).int().min(0).max(365).default(30),
  billingCycle: z.enum(CONTRACT_BILLING_CYCLE_VALUES).default('MONTHLY'),
  totalValue: z.number({ coerce: true }).min(0).optional().nullable(),
  monthlyCost: z.number({ coerce: true }).min(0).optional().nullable(),
  currency: z.string().length(3).default('USD'),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: optionalEmail,
  contactPhone: z.preprocess(emptyToNull, z.string().max(50).nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().max(5000).nullable().optional()),
  termsUrl: optionalUrl,
  lines: z.array(contractLineSchema).default([]),
  ...billingFieldsSchema,
})

export const updateContractSchema = createContractSchema.partial().extend({
  // Al actualizar, si se envía category vacía también se ignora
  category: z.enum(CONTRACT_CATEGORY_VALUES).optional(),
})

export type CreateContractInput = z.infer<typeof createContractSchema>
export type UpdateContractInput = z.infer<typeof updateContractSchema>
