import { z } from 'zod'

/**
 * Esquemas de validación para actas de devolución
 */

export const createReturnActSchema = z.object({
  assignmentId: z.string().uuid({
    message: 'ID de asignación inválido'
  }),
  returnCondition: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'], {
    errorMap: () => ({ message: 'Condición de devolución inválida' })
  }),
  inspectionNotes: z.string().max(1000, {
    message: 'Las notas de inspección no pueden exceder 1000 caracteres'
  }).optional(),
  missingAccessories: z.array(z.string()).optional(),
  damageDescription: z.string().max(1000, {
    message: 'La descripción de daños no puede exceder 1000 caracteres'
  }).optional(),
  returnDate: z.coerce.date().optional(),
})

export const acceptReturnActSchema = z.object({
  ipAddress: z.string().ip({
    message: 'Dirección IP inválida'
  }),
  userAgent: z.string().min(1, {
    message: 'User agent requerido'
  }),
})

export const rejectReturnActSchema = z.object({
  reason: z.string().min(10, {
    message: 'El motivo debe tener al menos 10 caracteres'
  }).max(500, {
    message: 'El motivo no puede exceder 500 caracteres'
  }),
  userId: z.string().uuid({
    message: 'ID de usuario inválido'
  }),
})

export type CreateReturnActInput = z.infer<typeof createReturnActSchema>
export type AcceptReturnActInput = z.infer<typeof acceptReturnActSchema>
export type RejectReturnActInput = z.infer<typeof rejectReturnActSchema>
