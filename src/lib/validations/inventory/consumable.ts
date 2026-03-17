import { z } from 'zod'
import { MovementType } from '@prisma/client'

export const movementTypeSchema = z.nativeEnum(MovementType, {
  errorMap: () => ({ message: 'Tipo de movimiento inválido' })
})

const consumableBaseSchema = z.object({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  typeId: z.string().min(1, 'El tipo de consumible es requerido'),
  unitOfMeasureId: z.string().min(1, 'La unidad de medida es requerida'),
  assignedEquipmentId: z.string().optional().nullable(),
  currentStock: z.number()
    .min(0, 'El stock actual debe ser mayor o igual a 0'),
  minStock: z.number()
    .min(0, 'El stock mínimo debe ser mayor o igual a 0'),
  maxStock: z.number()
    .min(0, 'El stock máximo debe ser mayor o igual a 0'),
  costPerUnit: z.number()
    .min(0, 'El costo por unidad debe ser mayor o igual a 0')
    .optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  compatibleEquipment: z.array(z.string()).optional(),
})

export const createConsumableSchema = consumableBaseSchema.refine(
  (data) => data.maxStock >= data.minStock,
  { message: 'El stock máximo debe ser mayor o igual al stock mínimo', path: ['maxStock'] }
).refine(
  (data) => data.currentStock <= data.maxStock,
  { message: 'El stock actual no puede exceder el stock máximo', path: ['currentStock'] }
)

export const updateConsumableSchema = consumableBaseSchema.omit({ currentStock: true }).partial()

export const createStockMovementSchema = z.object({
  consumableId: z.string().uuid('ID de consumible inválido'),
  type: movementTypeSchema,
  quantity: z.number()
    .positive('La cantidad debe ser mayor a 0'),
  reason: z.string()
    .max(500, 'El motivo no puede exceder 500 caracteres')
    .optional(),
  assignedToUserId: z.string().uuid().optional(),
  assignedToEquipmentId: z.string().uuid().optional(),
})

export const consumableFiltersSchema = z.object({
  search: z.string().optional(),
  typeId: z.array(z.string()).optional(),
  lowStock: z.boolean().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
})

export type CreateConsumableInput = z.infer<typeof createConsumableSchema>
export type UpdateConsumableInput = z.infer<typeof updateConsumableSchema>
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>
export type ConsumableFiltersInput = z.infer<typeof consumableFiltersSchema>
