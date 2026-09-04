import { z } from 'zod'

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v)

const optionalString = (max: number) =>
  z.preprocess(emptyToNull, z.string().max(max).nullable().optional())

const score = (label: string) =>
  z
    .number({ invalid_type_error: `${label} es obligatorio` })
    .int(`${label} debe ser un número entero`)
    .min(0, `${label} debe estar entre 0 y 5`)
    .max(5, `${label} debe estar entre 0 y 5`)

export const supplierEvaluationFormSchema = z.object({
  year: z
    .number({ invalid_type_error: 'El año es obligatorio' })
    .int()
    .min(2000, 'Año inválido')
    .max(2100, 'Año inválido'),
  detail: optionalString(200),
  quality: score('Calidad'),
  creditTime: score('Tiempo de crédito'),
  deliveryTime: score('Tiempo de entrega'),
  price: score('Precio'),
  references: score('Referencias'),
  equipmentScore: score('Equipo'),
  notes: optionalString(2000),
})

export type SupplierEvaluationFormInput = z.infer<typeof supplierEvaluationFormSchema>

export function sanitizeSupplierEvaluationPayload(raw: Record<string, unknown>) {
  const parsed = supplierEvaluationFormSchema.parse(raw)
  return {
    year: parsed.year,
    detail: parsed.detail || null,
    quality: parsed.quality,
    creditTime: parsed.creditTime,
    deliveryTime: parsed.deliveryTime,
    price: parsed.price,
    references: parsed.references,
    equipmentScore: parsed.equipmentScore,
    notes: parsed.notes || null,
  }
}
