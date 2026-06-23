import { z } from 'zod'

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
  quantity: z
    .number({ coerce: true })
    .min(0.01, 'La cantidad debe ser mayor a 0')
    .default(1),
  unitPrice: z.number({ coerce: true }).min(0).optional().nullable(),
  equipmentId: z.string().optional().nullable(),
  licenseId: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
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
  supplierId: z.string().uuid().optional().nullable(),
  familyId: z.string().uuid().optional().nullable(),
  modelId: z.string().uuid().optional().nullable(),
  batchId: z.string().uuid().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  autoRenew: z.boolean().default(false),
  renewalNoticeDays: z.number({ coerce: true }).int().min(0).max(365).default(30),
  billingCycle: z.enum(CONTRACT_BILLING_CYCLE_VALUES).default('MONTHLY'),
  totalValue: z.number({ coerce: true }).min(0).optional().nullable(),
  monthlyCost: z.number({ coerce: true }).min(0).optional().nullable(),
  currency: z.string().length(3).default('USD'),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email().max(200).optional().nullable().or(z.literal('')),
  contactPhone: z.string().max(50).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  termsUrl: z.string().url().max(500).optional().nullable().or(z.literal('')),
  lines: z.array(contractLineSchema).default([]),
})

export const updateContractSchema = createContractSchema.partial().extend({
  // Al actualizar, si se envía category vacía también se ignora
  category: z
    .enum(CONTRACT_CATEGORY_VALUES)
    .optional(),
})

export type CreateContractInput = z.infer<typeof createContractSchema>
export type UpdateContractInput = z.infer<typeof updateContractSchema>
