/**
 * Schemas de Validación Centralizados
 * Usando Zod para validación robusta de datos
 */

import { z } from 'zod'

// ============================================
// SCHEMAS DE TICKETS
// ============================================

export const createTicketSchema = z.object({
  title: z.string()
    .min(5, 'El título debe tener al menos 5 caracteres')
    .max(200, 'El título no puede exceder 200 caracteres')
    .trim(),
  
  description: z.string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(5000, 'La descripción no puede exceder 5000 caracteres')
    .trim(),
  
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .default('MEDIUM'),
  
  categoryId: z.string()
    .uuid('ID de categoría inválido'),
  
  clientId: z.string()
    .uuid('ID de cliente inválido')
    .optional(),
  
  assigneeId: z.string()
    .uuid('ID de técnico inválido')
    .optional()
    .nullable(),
  
  tags: z.array(z.string().max(50))
    .max(10, 'Máximo 10 etiquetas')
    .optional()
})

export const updateTicketSchema = z.object({
  title: z.string()
    .min(5)
    .max(200)
    .trim()
    .optional(),
  
  description: z.string()
    .min(10)
    .max(5000)
    .trim()
    .optional(),
  
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
    .optional(),
  
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .optional(),
  
  assigneeId: z.string()
    .uuid()
    .optional()
    .nullable(),
  
  categoryId: z.string()
    .uuid()
    .optional(),
  
  tags: z.array(z.string().max(50))
    .max(10)
    .optional()
})

// ============================================
// SCHEMAS DE COMENTARIOS
// ============================================

export const createCommentSchema = z.object({
  content: z.string()
    .min(1, 'El comentario no puede estar vacío')
    .max(5000, 'El comentario no puede exceder 5000 caracteres')
    .trim(),
  
  isInternal: z.boolean()
    .default(false)
})

// ============================================
// SCHEMAS DE USUARIOS
// ============================================

export const createUserSchema = z.object({
  email: z.string()
    .email('Email inválido')
    .max(255)
    .toLowerCase()
    .trim(),
  
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim(),
  
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
    )
    .optional(),
  
  role: z.enum(['ADMIN', 'TECHNICIAN', 'CLIENT'])
    .default('CLIENT'),
  
  departmentId: z.string()
    .uuid()
    .optional()
    .nullable(),
  
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Número de teléfono inválido')
    .optional()
    .nullable()
})

export const updateUserSchema = z.object({
  name: z.string()
    .min(2)
    .max(100)
    .trim()
    .optional(),
  
  role: z.enum(['ADMIN', 'TECHNICIAN', 'CLIENT'])
    .optional(),
  
  departmentId: z.string()
    .uuid()
    .optional()
    .nullable(),
  
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .nullable(),
  
  isActive: z.boolean()
    .optional()
})

// ============================================
// SCHEMAS DE CATEGORÍAS
// ============================================

export const createCategorySchema = z.object({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim(),
  
  description: z.string()
    .max(500)
    .trim()
    .optional()
    .nullable(),
  
  level: z.number()
    .int()
    .min(1)
    .max(5)
    .default(1),
  
  parentId: z.string()
    .uuid()
    .optional()
    .nullable(),
  
  departmentId: z.string()
    .uuid()
    .optional()
    .nullable(),
  
  color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Color hexadecimal inválido')
    .default('#6B7280')
})

export const updateCategorySchema = z.object({
  name: z.string()
    .min(2)
    .max(100)
    .trim()
    .optional(),
  
  description: z.string()
    .max(500)
    .trim()
    .optional()
    .nullable(),
  
  color: z.string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  
  isActive: z.boolean()
    .optional(),
  
  order: z.number()
    .int()
    .min(0)
    .optional()
})

// ============================================
// SCHEMAS DE WEBHOOKS
// ============================================

export const createWebhookSchema = z.object({
  name: z.string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim(),
  
  url: z.string()
    .url('URL inválida')
    .max(500, 'La URL no puede exceder 500 caracteres')
    .refine(
      (url) => url.startsWith('https://'),
      'La URL debe usar HTTPS por seguridad'
    ),
  
  events: z.array(z.string())
    .min(1, 'Debe seleccionar al menos un evento')
    .max(20, 'Máximo 20 eventos'),
  
  secret: z.string()
    .min(32, 'El secret debe tener al menos 32 caracteres')
    .optional(),
  
  headers: z.record(z.string())
    .optional(),
  
  timeoutMs: z.number()
    .int()
    .min(1000, 'Timeout mínimo: 1 segundo')
    .max(60000, 'Timeout máximo: 60 segundos')
    .default(30000)
    .optional(),
  
  retryCount: z.number()
    .int()
    .min(0)
    .max(5, 'Máximo 5 reintentos')
    .default(3)
    .optional()
})

export const updateWebhookSchema = z.object({
  name: z.string()
    .min(1)
    .max(100)
    .trim()
    .optional(),
  
  url: z.string()
    .url()
    .max(500)
    .refine((url) => url.startsWith('https://'))
    .optional(),
  
  events: z.array(z.string())
    .min(1)
    .max(20)
    .optional(),
  
  headers: z.record(z.string())
    .optional(),
  
  timeoutMs: z.number()
    .int()
    .min(1000)
    .max(60000)
    .optional(),
  
  retryCount: z.number()
    .int()
    .min(0)
    .max(5)
    .optional(),
  
  isActive: z.boolean()
    .optional()
})

// ============================================
// SCHEMAS DE SLA
// ============================================

export const createSLAPolicySchema = z.object({
  name: z.string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim(),
  
  description: z.string()
    .max(500)
    .trim()
    .optional(),
  
  categoryId: z.string()
    .uuid('ID de categoría inválido')
    .optional()
    .nullable(),
  
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'], {
    errorMap: () => ({ message: 'Prioridad inválida' })
  }),
  
  responseTimeHours: z.number()
    .int()
    .min(1, 'Debe ser al menos 1 hora')
    .max(720, 'Máximo 30 días (720 horas)'),
  
  resolutionTimeHours: z.number()
    .int()
    .min(1, 'Debe ser al menos 1 hora')
    .max(720, 'Máximo 30 días (720 horas)'),
  
  businessHoursOnly: z.boolean()
    .default(false),
  
  businessHoursStart: z.string()
    .regex(/^\d{2}:\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM:SS)')
    .default('09:00:00'),
  
  businessHoursEnd: z.string()
    .regex(/^\d{2}:\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM:SS)')
    .default('18:00:00'),
  
  businessDays: z.string()
    .regex(/^(MON|TUE|WED|THU|FRI|SAT|SUN)(,(MON|TUE|WED|THU|FRI|SAT|SUN))*$/, 'Formato de días inválido')
    .default('MON,TUE,WED,THU,FRI')
}).refine(
  (data) => data.resolutionTimeHours >= data.responseTimeHours,
  {
    message: 'El tiempo de resolución debe ser mayor o igual al tiempo de respuesta',
    path: ['resolutionTimeHours']
  }
)

export const updateSLAPolicySchema = z.object({
  name: z.string()
    .min(1)
    .max(100)
    .trim()
    .optional(),
  
  description: z.string()
    .max(500)
    .trim()
    .optional(),
  
  responseTimeHours: z.number()
    .int()
    .min(1)
    .max(720)
    .optional(),
  
  resolutionTimeHours: z.number()
    .int()
    .min(1)
    .max(720)
    .optional(),
  
  businessHoursOnly: z.boolean()
    .optional(),
  
  businessHoursStart: z.string()
    .regex(/^\d{2}:\d{2}:\d{2}$/)
    .optional(),
  
  businessHoursEnd: z.string()
    .regex(/^\d{2}:\d{2}:\d{2}$/)
    .optional(),
  
  businessDays: z.string()
    .regex(/^(MON|TUE|WED|THU|FRI|SAT|SUN)(,(MON|TUE|WED|THU|FRI|SAT|SUN))*$/)
    .optional(),
  
  isActive: z.boolean()
    .optional()
})

// ============================================
// SCHEMAS DE REPORTES
// ============================================

export const exportReportSchema = z.object({
  reportType: z.enum(['tickets', 'technicians', 'categories'], {
    errorMap: () => ({ message: 'Tipo de reporte inválido' })
  }),
  
  format: z.enum(['csv', 'excel', 'pdf'], {
    errorMap: () => ({ message: 'Formato inválido' })
  }),
  
  startDate: z.string()
    .datetime({ message: 'Fecha de inicio inválida' })
    .optional(),
  
  endDate: z.string()
    .datetime({ message: 'Fecha de fin inválida' })
    .optional(),
  
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
    .optional(),
  
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .optional(),
  
  categoryId: z.string()
    .uuid()
    .optional(),
  
  technicianId: z.string()
    .uuid()
    .optional()
})

// ============================================
// HELPERS DE VALIDACIÓN
// ============================================

/**
 * Valida y sanitiza datos de entrada
 */
export function validateAndSanitize<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { success: false, errors: result.error }
  }
}

/**
 * Formatea errores de Zod para respuesta API
 */
export function formatZodErrors(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }))
}
