import { z } from 'zod'
import { MovementType } from '@prisma/client'

export const movementTypeSchema = z.nativeEnum(MovementType, {
  errorMap: () => ({ message: 'Tipo de movimiento inválido' }),
})

const consumableBaseSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  typeId: z.string().optional(),
  unitOfMeasureId: z.string().optional(),
  assignedEquipmentId: z.string().optional().nullable(),
  currentStock: z.number().min(0, 'El stock actual debe ser mayor o igual a 0'),
  minStock: z.number().min(0, 'El stock mínimo debe ser mayor o igual a 0'),
  maxStock: z.number().min(0, 'El stock máximo debe ser mayor o igual a 0'),
  costPerUnit: z.number().min(0, 'El costo por unidad debe ser mayor o igual a 0').optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  compatibleEquipment: z.array(z.string()).optional(),
  customValues: z
    .array(
      z.object({
        fieldName: z.string(),
        fieldValue: z.string(),
      })
    )
    .optional(),
})

export const createConsumableSchema = consumableBaseSchema
  .refine(data => data.maxStock >= data.minStock, {
    message: 'El stock máximo debe ser mayor o igual al stock mínimo',
    path: ['maxStock'],
  })
  .refine(data => data.currentStock <= data.maxStock, {
    message: 'El stock actual no puede exceder el stock máximo',
    path: ['currentStock'],
  })

export const updateConsumableSchema = consumableBaseSchema.omit({ currentStock: true }).partial()

export const createStockMovementSchema = z
  .object({
    consumableId: z.string().uuid('ID de suministro inválido'),
    type: movementTypeSchema,
    quantity: z.number().positive('La cantidad debe ser mayor a 0'),
    reason: z.string().max(500, 'El motivo no puede exceder 500 caracteres').optional(),
    assignedToUserId: z.string().uuid().optional(),
    assignedToEquipmentId: z.string().uuid().optional(),
    /** Fecha del movimiento (YYYY-MM-DD). Útil para registrar consumos atrasados. */
    occurredAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
      .optional(),
    // Datos de compra — opcionales, solo tienen efecto en type=ENTRY.
    amount: z.number().min(0, 'El monto debe ser mayor o igual a 0').optional(),
    currency: z.string().max(3).optional(),
    invoiceNumber: z.string().max(100).optional(),
    purchaseOrderNumber: z.string().max(100).optional(),
    supplierId: z.string().optional(),
    paymentMethod: z.string().optional(),
    bankEntity: z.string().max(100).optional(),
    referenceNumber: z.string().max(200).optional(),
    cardLast4: z.string().max(4).optional(),
    cardBrand: z.string().max(50).optional(),
    transactionId: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.occurredAt) return
    const day = new Date(`${data.occurredAt}T12:00:00`)
    if (Number.isNaN(day.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fecha inválida', path: ['occurredAt'] })
      return
    }
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (day > today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La fecha no puede ser futura',
        path: ['occurredAt'],
      })
    }
    const min = new Date()
    min.setDate(min.getDate() - 90)
    min.setHours(0, 0, 0, 0)
    if (day < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Solo se permiten fechas de los últimos 90 días',
        path: ['occurredAt'],
      })
    }
  })

export const consumableFiltersSchema = z.object({
  search: z.string().optional(),
  typeId: z.array(z.string()).optional(),
  lowStock: z.boolean().optional(),
  familyId: z.string().optional(),
  scopeFamilyIds: z.array(z.string()).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
})

export type CreateConsumableInput = z.infer<typeof createConsumableSchema>
export type UpdateConsumableInput = z.infer<typeof updateConsumableSchema>
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>
export type ConsumableFiltersInput = z.infer<typeof consumableFiltersSchema>
