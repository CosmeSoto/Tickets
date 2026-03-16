import { z } from 'zod'
import { ConsumableType, MovementType } from '@prisma/client'

export const consumableTypeSchema = z.nativeEnum(ConsumableType, {
  errorMap: () => ({ message: 'Tipo de consumible inválido' })
})

export const movementTypeSchema = z.nativeEnum(MovementType, {
  errorMap: () => ({ message: 'Tipo de movimiento inválido' })
})

export const createConsumableSchema = z.object({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  type: consumableTypeSchema,
  unitOfMeasure: z.string()
    .min(1, 'La unidad de medida es requerida')
    .max(20, 'La unidad de medida no puede exceder 20 caracteres'),
  currentStock: z.number()
    .min(0, 'El stock actual debe ser mayor o igual a 0'),
  minStock: z.number()
    .min(0, 'El stock mínimo debe ser mayor o igual a 0'),
  maxStock: z.number()
    .min(0, 'El stock máximo debe ser mayor o igual a 0'),
  costPerUnit: z.number()
    .min(0, 'El costo por unidad debe ser mayor o igual a 0')
    .optional(),
  compatibleEquipment: z.array(z.string()).optional(),
}).refine(
  (data) => data.maxStock >= data.minStock,
  {
    message: 'El stock máximo debe ser mayor o igual al stock mínimo',
    path: ['maxStock']
  }
).refine(
  (data) => data.currentStock <= data.maxStock,
  {
    message: 'El stock actual no puede exceder el stock máximo',
    path: ['currentStock']
  }
)

export const updateConsumableSchema = createConsumableSchema.partial().omit({ currentStock: true })

export const createStockMovementSchema = z.object({
  consumableId: z.string().uuid('ID de consumible inválido'),
  type: movementTypeSchema,
  quantity: z.number()
    .positive('La cantidad debe ser mayor a 0'),
  reason: z.string()
    .max(500, 'El motivo no puede exceder 500 caracteres')
    .optional(),
})

export const consumableFiltersSchema = z.object({
  search: z.string().optional(),
  type: z.array(consumableTypeSchema).optional(),
  lowStock: z.boolean().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
})

export type CreateConsumableInput = z.infer<typeof createConsumableSchema>
export type UpdateConsumableInput = z.infer<typeof updateConsumableSchema>
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>
export type ConsumableFiltersInput = z.infer<typeof consumableFiltersSchema>
