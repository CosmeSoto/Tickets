import { z } from 'zod'
import { CONTRACT_BILLING_CYCLE_VALUES } from '@/lib/validations/contracts'

export const CONTRACT_AMENDMENT_TYPE_VALUES = [
  'PRICE_CHANGE',
  'TERM_EXTENSION',
  'TERM_REDUCTION',
  'SCOPE_CHANGE',
  'BILLING_CHANGE',
  'CANCELLATION',
  'OTHER',
] as const

export const createContractAmendmentSchema = z
  .object({
    title: z.string().min(2).max(200),
    description: z.string().max(5000).optional().nullable(),
    type: z.enum(CONTRACT_AMENDMENT_TYPE_VALUES).default('OTHER'),
    effectiveDate: z.coerce.date(),
    applyToContract: z.boolean().default(true),
    newMonthlyCost: z.number().min(0).optional().nullable(),
    newTotalValue: z.number().min(0).optional().nullable(),
    newEndDate: z.coerce.date().optional().nullable(),
    newBillingCycle: z.enum(CONTRACT_BILLING_CYCLE_VALUES).optional().nullable(),
  })
  .refine(
    data =>
      data.newMonthlyCost != null ||
      data.newTotalValue != null ||
      data.newEndDate != null ||
      data.newBillingCycle != null ||
      (data.description?.trim().length ?? 0) > 0,
    {
      message:
        'Indica al menos un cambio (costo, vigencia, ciclo) o una descripción del adendum',
    }
  )

export type CreateContractAmendmentInput = z.infer<typeof createContractAmendmentSchema>
