import { z } from 'zod'

export const SAVED_REPORT_KIND_VALUES = ['DATASET', 'TEMPLATE'] as const

export const createInventorySavedReportSchema = z.object({
  name: z.string().min(2).max(200),
  kind: z.enum(SAVED_REPORT_KIND_VALUES).default('DATASET'),
  targetId: z.string().min(1).max(100),
  familyId: z.string().uuid().optional().nullable(),
  filterValues: z.record(z.string()).default({}),
  visibleColumns: z.array(z.string()).default([]),
  pinned: z.boolean().optional(),
  pinnedSpan: z.number().int().min(1).max(3).optional(),
})

export const reorderPinnedSavedReportsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(12),
})

export const updateInventorySavedReportSchema = createInventorySavedReportSchema
  .partial()
  .refine(data => Object.keys(data).length > 0, {
    message: 'Debes enviar al menos un campo para actualizar',
  })

export type CreateInventorySavedReportInput = z.infer<typeof createInventorySavedReportSchema>
export type UpdateInventorySavedReportInput = z.infer<typeof updateInventorySavedReportSchema>
export type ReorderPinnedSavedReportsInput = z.infer<typeof reorderPinnedSavedReportsSchema>
