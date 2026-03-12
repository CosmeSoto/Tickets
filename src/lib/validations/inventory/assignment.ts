import { z } from 'zod'

// Assignment validation schema
export const createAssignmentSchema = z.object({
  equipmentId: z.string().uuid({ message: 'ID de equipo inválido' }),
  receiverId: z.string().uuid({ message: 'ID de receptor inválido' }),
  assignmentType: z.enum(['PERMANENT', 'TEMPORARY', 'LOAN'], {
    errorMap: () => ({ message: 'Tipo de asignación inválido' })
  }),
  startDate: z.coerce.date({
    errorMap: () => ({ message: 'Fecha de inicio inválida' })
  }),
  endDate: z.coerce.date().optional(),
  accessories: z.array(z.string()).default([]),
  observations: z.string().max(1000, 'Las observaciones no pueden exceder 1000 caracteres').optional(),
}).refine((data) => {
  // Si es TEMPORARY o LOAN, endDate es requerida
  if ((data.assignmentType === 'TEMPORARY' || data.assignmentType === 'LOAN') && !data.endDate) {
    return false
  }
  return true
}, {
  message: 'La fecha de fin es requerida para asignaciones temporales o préstamos',
  path: ['endDate']
}).refine((data) => {
  // endDate debe ser posterior a startDate
  if (data.endDate && data.startDate) {
    return data.endDate > data.startDate
  }
  return true
}, {
  message: 'La fecha de fin debe ser posterior a la fecha de inicio',
  path: ['endDate']
})

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>

// Assignment filters schema
export const assignmentFiltersSchema = z.object({
  equipmentId: z.string().uuid().optional(),
  receiverId: z.string().uuid().optional(),
  delivererId: z.string().uuid().optional(),
  assignmentType: z.array(z.enum(['PERMANENT', 'TEMPORARY', 'LOAN'])).optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
})

export type AssignmentFiltersInput = z.infer<typeof assignmentFiltersSchema>

// Act acceptance schema
export const acceptActSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  acceptedTerms: z.boolean().refine((val) => val === true, {
    message: 'Debes aceptar los términos y condiciones'
  }),
})

export type AcceptActInput = z.infer<typeof acceptActSchema>

// Act rejection schema
export const rejectActSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  reason: z.string().min(10, 'El motivo debe tener al menos 10 caracteres').max(500, 'El motivo no puede exceder 500 caracteres'),
})

export type RejectActInput = z.infer<typeof rejectActSchema>

// Return act creation schema
export const createReturnActSchema = z.object({
  condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'], {
    errorMap: () => ({ message: 'Condición inválida' })
  }),
  inspectionNotes: z.string().max(1000, 'Las notas no pueden exceder 1000 caracteres').optional(),
  returnDate: z.coerce.date({
    errorMap: () => ({ message: 'Fecha de devolución inválida' })
  }),
})

export type CreateReturnActInput = z.infer<typeof createReturnActSchema>
