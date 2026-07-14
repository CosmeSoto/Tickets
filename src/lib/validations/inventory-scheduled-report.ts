import { z } from 'zod'

export const SCHEDULE_FREQUENCY_VALUES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const
export const REPORT_EXPORT_FORMAT_VALUES = ['CSV', 'PDF', 'BOTH'] as const

const scheduleTimingSchema = z.object({
  frequency: z.enum(SCHEDULE_FREQUENCY_VALUES).default('WEEKLY'),
  scheduleTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido')
    .default('08:00'),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(28).optional().nullable(),
})

function validateScheduleTiming(
  data: z.infer<typeof scheduleTimingSchema>,
  ctx: z.RefinementCtx
) {
  if (data.frequency === 'WEEKLY' && data.dayOfWeek == null) {
    ctx.addIssue({
      code: 'custom',
      message: 'dayOfWeek es requerido para frecuencia semanal',
      path: ['dayOfWeek'],
    })
  }
  if (data.frequency === 'MONTHLY' && data.dayOfMonth == null) {
    ctx.addIssue({
      code: 'custom',
      message: 'dayOfMonth es requerido para frecuencia mensual',
      path: ['dayOfMonth'],
    })
  }
}

export const createInventoryScheduledReportSchema = scheduleTimingSchema
  .extend({
    savedReportId: z.string().uuid(),
    recipients: z.array(z.string().email()).default([]),
    enabled: z.boolean().default(true),
    exportFormat: z.enum(REPORT_EXPORT_FORMAT_VALUES).default('BOTH'),
  })
  .superRefine(validateScheduleTiming)

export const updateInventoryScheduledReportSchema = scheduleTimingSchema
  .partial()
  .extend({
    recipients: z.array(z.string().email()).optional(),
    enabled: z.boolean().optional(),
    exportFormat: z.enum(REPORT_EXPORT_FORMAT_VALUES).optional(),
  })
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Debes enviar al menos un campo para actualizar',
      })
      return
    }
    if (data.frequency === 'WEEKLY' && data.dayOfWeek === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'dayOfWeek es requerido para frecuencia semanal',
        path: ['dayOfWeek'],
      })
    }
    if (data.frequency === 'MONTHLY' && data.dayOfMonth === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'dayOfMonth es requerido para frecuencia mensual',
        path: ['dayOfMonth'],
      })
    }
  })

export type CreateInventoryScheduledReportInput = z.infer<
  typeof createInventoryScheduledReportSchema
>
export type UpdateInventoryScheduledReportInput = z.infer<
  typeof updateInventoryScheduledReportSchema
>
