import { z } from 'zod'

export const createMaintenanceSchema = z.object({
  equipmentId: z.string().uuid({ message: 'ID de equipo inválido' }),
  type: z.enum(['PREVENTIVE', 'CORRECTIVE'], {
    errorMap: () => ({ message: 'Tipo de mantenimiento inválido' })
  }),
  description: z.string().min(10, { message: 'La descripción debe tener al menos 10 caracteres' })
    .max(1000, { message: 'La descripción no puede exceder 1000 caracteres' }),
  scheduledDate: z.coerce.date(),
  completedDate: z.coerce.date().optional(),
  cost: z.number().min(0, { message: 'El costo debe ser mayor o igual a 0' }).optional(),
  partsReplaced: z.array(z.string()).optional(),
  ticketId: z.string().uuid().optional(),
  technicianId: z.string().uuid({ message: 'ID de técnico inválido' }),
})

export const updateMaintenanceSchema = z.object({
  completedDate: z.coerce.date().optional(),
  cost: z.number().min(0).optional(),
  partsReplaced: z.array(z.string()).optional(),
  notes: z.string().max(1000).optional(),
})

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>
export type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceSchema>
