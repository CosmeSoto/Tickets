import { z } from 'zod'
import { EquipmentType, EquipmentStatus, EquipmentCondition, OwnershipType } from '@prisma/client'

// Equipment type enum schema
export const equipmentTypeSchema = z.nativeEnum(EquipmentType, {
  errorMap: () => ({ message: 'Tipo de equipo inválido' })
})

// Equipment status enum schema
export const equipmentStatusSchema = z.nativeEnum(EquipmentStatus, {
  errorMap: () => ({ message: 'Estado de equipo inválido' })
})

// Equipment condition enum schema
export const equipmentConditionSchema = z.nativeEnum(EquipmentCondition, {
  errorMap: () => ({ message: 'Condición de equipo inválida' })
})

// Ownership type enum schema
export const ownershipTypeSchema = z.nativeEnum(OwnershipType, {
  errorMap: () => ({ message: 'Tipo de propiedad inválido' })
})

// Create equipment schema
export const createEquipmentSchema = z.object({
  code: z.string()
    .min(3, 'El código debe tener al menos 3 caracteres')
    .max(20, 'El código no puede exceder 20 caracteres')
    .regex(/^[A-Z0-9-]+$/, 'El código solo puede contener letras mayúsculas, números y guiones'),
  
  serialNumber: z.string()
    .min(5, 'El número de serie debe tener al menos 5 caracteres')
    .max(50, 'El número de serie no puede exceder 50 caracteres'),
  
  brand: z.string()
    .min(2, 'La marca debe tener al menos 2 caracteres')
    .max(50, 'La marca no puede exceder 50 caracteres'),
  
  model: z.string()
    .min(2, 'El modelo debe tener al menos 2 caracteres')
    .max(50, 'El modelo no puede exceder 50 caracteres'),
  
  type: equipmentTypeSchema,
  
  status: equipmentStatusSchema.optional().default('AVAILABLE'),
  
  condition: equipmentConditionSchema,
  
  ownershipType: ownershipTypeSchema,
  
  purchaseDate: z.coerce.date().optional(),
  
  purchasePrice: z.number()
    .positive('El precio debe ser positivo')
    .optional(),
  
  warrantyExpiration: z.coerce.date().optional(),
  
  specifications: z.record(z.any()).optional(),
  
  accessories: z.array(z.string()).optional().default([]),
  
  location: z.string().max(100, 'La ubicación no puede exceder 100 caracteres').optional(),
  
  notes: z.string().max(1000, 'Las notas no pueden exceder 1000 caracteres').optional(),
})

// Update equipment schema (all fields optional except id)
export const updateEquipmentSchema = createEquipmentSchema.partial()

// Equipment filters schema
export const equipmentFiltersSchema = z.object({
  search: z.string().optional(),
  type: z.array(equipmentTypeSchema).optional(),
  status: z.array(equipmentStatusSchema).optional(),
  condition: z.array(equipmentConditionSchema).optional(),
  assignedTo: z.string().uuid('ID de usuario inválido').optional(),
  departmentId: z.string().uuid('ID de departamento inválido').optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
})

// Equipment ID schema
export const equipmentIdSchema = z.object({
  id: z.string().uuid('ID de equipo inválido')
})

// Type exports
export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>
export type EquipmentFiltersInput = z.infer<typeof equipmentFiltersSchema>
