import { z } from 'zod'
import { TicketPriority } from '@prisma/client'

export const createTicketSchema = z.object({
  title: z
    .string()
    .min(5, 'El título debe tener al menos 5 caracteres')
    .max(200, 'El título no puede exceder 200 caracteres'),
  description: z
    .string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(5000, 'La descripción no puede exceder 5000 caracteres'),
  location: z
    .string()
    .max(300, 'La ubicación no puede exceder 300 caracteres')
    .optional()
    .or(z.literal('')),
  priority: z.nativeEnum(TicketPriority, {
    errorMap: () => ({ message: 'Selecciona una prioridad válida' }),
  }),
  categoryId: z.string().min(1, 'Selecciona una categoría'),
  clientId: z.string().optional(), // Opcional para cuando el admin crea tickets
})

export const updateTicketSchema = z.object({
  title: z
    .string()
    .min(5, 'El título debe tener al menos 5 caracteres')
    .max(200, 'El título no puede exceder 200 caracteres')
    .optional(),
  description: z
    .string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(5000, 'La descripción no puede exceder 5000 caracteres')
    .optional(),
  location: z
    .string()
    .max(300)
    .optional()
    .or(z.literal('')),
  priority: z.nativeEnum(TicketPriority).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  assigneeId: z.string().optional(),
  categoryId: z.string().optional(),
})

export const commentSchema = z.object({
  content: z
    .string()
    .min(1, 'El comentario no puede estar vacío')
    .max(2000, 'El comentario no puede exceder 2000 caracteres'),
  isInternal: z.boolean().default(false),
})

export type CreateTicketData = z.infer<typeof createTicketSchema>
export type UpdateTicketData = z.infer<typeof updateTicketSchema>
export type CommentData = z.infer<typeof commentSchema>
