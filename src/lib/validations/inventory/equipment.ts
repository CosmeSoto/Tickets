import { z } from 'zod'
import { EquipmentStatus, EquipmentCondition, OwnershipType } from '@prisma/client'

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

// Base equipment schema (sin refine para poder usar partial)
const baseEquipmentSchema = z.object({
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
  
  typeId: z.string().uuid('Tipo de equipo inválido'),
  
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
  
  // Campos para equipos rentados/alquilados
  rentalProvider: z.string()
    .min(2, 'El proveedor debe tener al menos 2 caracteres')
    .max(255, 'El proveedor no puede exceder 255 caracteres')
    .optional(),
  
  rentalContractNumber: z.string()
    .max(100, 'El número de contrato no puede exceder 100 caracteres')
    .optional(),
  
  rentalStartDate: z.coerce.date().optional(),
  
  rentalEndDate: z.coerce.date().optional(),
  
  rentalMonthlyCost: z.number()
    .positive('El costo mensual debe ser positivo')
    .optional(),
  
  rentalContactName: z.string()
    .max(255, 'El nombre de contacto no puede exceder 255 caracteres')
    .optional(),
  
  rentalContactEmail: z.string()
    .email('Email de contacto inválido')
    .optional(),
  
  rentalContactPhone: z.string()
    .max(50, 'El teléfono de contacto no puede exceder 50 caracteres')
    .optional(),
  
  rentalNotes: z.string()
    .max(1000, 'Las notas de renta no pueden exceder 1000 caracteres')
    .optional(),
})

// Create equipment schema (con validaciones refine)
export const createEquipmentSchema = baseEquipmentSchema.refine(
  (data) => {
    // Si es RENTAL, el proveedor es obligatorio
    if (data.ownershipType === 'RENTAL' && !data.rentalProvider) {
      return false
    }
    return true
  },
  {
    message: 'El proveedor es obligatorio para equipos rentados',
    path: ['rentalProvider']
  }
).refine(
  (data) => {
    // Si hay fecha de fin de renta, debe ser posterior a la fecha de inicio
    if (data.rentalStartDate && data.rentalEndDate) {
      return new Date(data.rentalEndDate) > new Date(data.rentalStartDate)
    }
    return true
  },
  {
    message: 'La fecha de fin debe ser posterior a la fecha de inicio',
    path: ['rentalEndDate']
  }
)

// Update equipment schema (all fields optional)
export const updateEquipmentSchema = baseEquipmentSchema.partial()

// Equipment filters schema
export const equipmentFiltersSchema = z.object({
  search: z.string().optional(),
  typeId: z.array(z.string().uuid()).optional(),
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
