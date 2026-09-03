import { z } from 'zod'
import { INVOICE_NUMBER_PATTERN, INVOICE_NUMBER_ERROR } from '@/lib/inventory/invoice-number'

/** '' → undefined (campos texto/fecha/dinero opcionales) */
const emptyToUndef = (v: unknown) => (v === '' || v === null ? undefined : v)

/** '' → null para IDs opcionales (permite desasignar con null) */
const emptyToNull = (v: unknown) => (v === '' ? null : v)

const optionalString = z.preprocess(emptyToUndef, z.string().optional())
const optionalNullableId = z.preprocess(emptyToNull, z.string().min(1).nullable().optional())
const optionalDate = z.preprocess(emptyToUndef, z.coerce.date().optional())
const optionalMoney = z.preprocess(emptyToUndef, z.number().min(0).optional())

export const createLicenseSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  typeId: z.string().min(1, 'El tipo de licencia es requerido'),
  licenseTypeId: z.string().optional(),
  key: z.preprocess(
    emptyToUndef,
    z.string().max(500, 'La clave no puede exceder 500 caracteres').optional()
  ),
  scope: z.enum(['Individual', 'Departamento', 'Empresa']).optional(),
  purchaseDate: optionalDate,
  expirationDate: optionalDate,
  cost: optionalMoney,
  vendor: optionalString,
  supplierId: optionalNullableId,
  invoiceNumber: z.preprocess(
    emptyToUndef,
    z.string().max(100).regex(INVOICE_NUMBER_PATTERN, INVOICE_NUMBER_ERROR).optional()
  ),
  purchaseOrderNumber: z.preprocess(
    emptyToUndef,
    z.string().max(100).regex(INVOICE_NUMBER_PATTERN, INVOICE_NUMBER_ERROR).optional()
  ),
  renewalCost: optionalMoney,
  renewalDate: optionalDate,
  contractId: optionalNullableId,
  contractNumber: z.preprocess(emptyToUndef, z.string().max(100).optional()),
  notes: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
  assignedToEquipment: optionalNullableId,
  assignedToUser: optionalNullableId,
  assignedToDepartment: optionalNullableId,
  customValues: z
    .array(
      z.object({
        fieldName: z.string(),
        fieldValue: z.string(),
      })
    )
    .optional(),
})

export const updateLicenseSchema = createLicenseSchema.partial()

export const licenseFiltersSchema = z.object({
  search: z.string().optional(),
  typeId: z.array(z.string()).optional(),
  assigned: z.enum(['all', 'assigned', 'unassigned']).optional(),
  expired: z.enum(['all', 'active', 'expired', 'expiring']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
})

export type CreateLicenseInput = z.infer<typeof createLicenseSchema>
export type UpdateLicenseInput = z.infer<typeof updateLicenseSchema>
export type LicenseFiltersInput = z.infer<typeof licenseFiltersSchema>
