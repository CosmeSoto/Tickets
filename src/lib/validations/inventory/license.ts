import { z } from 'zod'
import { LicenseType } from '@prisma/client'

export const licenseTypeSchema = z.nativeEnum(LicenseType, {
  errorMap: () => ({ message: 'Tipo de licencia inválido' })
})

export const createLicenseSchema = z.object({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  type: licenseTypeSchema,
  key: z.string()
    .min(5, 'La clave debe tener al menos 5 caracteres')
    .max(500, 'La clave no puede exceder 500 caracteres'),
  purchaseDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
  cost: z.number().min(0, 'El costo debe ser mayor o igual a 0').optional(),
  vendor: z.string().max(100).optional(),
})

export const updateLicenseSchema = createLicenseSchema.partial()

export const assignLicenseSchema = z.object({
  assignedToEquipment: z.string().uuid('ID de equipo inválido').optional().nullable(),
  assignedToUser: z.string().uuid('ID de usuario inválido').optional().nullable(),
}).refine(
  (data) => {
    // No puede estar asignado a equipo Y usuario al mismo tiempo
    if (data.assignedToEquipment && data.assignedToUser) {
      return false
    }
    return true
  },
  {
    message: 'La licencia solo puede asignarse a un equipo O a un usuario, no a ambos',
    path: ['assignedToEquipment']
  }
)

export const licenseFiltersSchema = z.object({
  search: z.string().optional(),
  type: z.array(licenseTypeSchema).optional(),
  assigned: z.enum(['all', 'assigned', 'unassigned']).optional(),
  expired: z.enum(['all', 'active', 'expired', 'expiring']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
})

export type CreateLicenseInput = z.infer<typeof createLicenseSchema>
export type UpdateLicenseInput = z.infer<typeof updateLicenseSchema>
export type AssignLicenseInput = z.infer<typeof assignLicenseSchema>
export type LicenseFiltersInput = z.infer<typeof licenseFiltersSchema>
