import { z } from 'zod'

export const createLicenseSchema = z.object({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  typeId: z.string().min(1, 'El tipo de licencia es requerido'),
  key: z.string()
    .max(500, 'La clave no puede exceder 500 caracteres')
    .optional()
    .or(z.literal('')),
  purchaseDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().optional(),
  cost: z.number().min(0, 'El costo debe ser mayor o igual a 0').optional(),
  vendor: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  assignedToEquipment: z.string().optional(),
  assignedToUser: z.string().optional(),
  assignedToDepartment: z.string().optional(),
})

export const updateLicenseSchema = createLicenseSchema.partial()

export const assignLicenseSchema = z.object({
  assignedToEquipment: z.string().optional().nullable(),
  assignedToUser: z.string().optional().nullable(),
  assignedToDepartment: z.string().optional().nullable(),
})

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
export type AssignLicenseInput = z.infer<typeof assignLicenseSchema>
export type LicenseFiltersInput = z.infer<typeof licenseFiltersSchema>
