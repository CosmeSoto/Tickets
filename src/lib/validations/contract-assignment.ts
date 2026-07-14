import { z } from 'zod'

export const assignContractSchema = z.object({
  clientId: z.string().uuid('Cliente inválido'),
  startDate: z.string().optional(),
  plannedEndDate: z.string().optional().nullable(),
  changeReason: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export const returnContractAssignmentSchema = z.object({
  returnDate: z.string().optional(),
  withdrawalReason: z.string().max(500).optional().nullable(),
  handoverNotes: z.string().max(2000).optional().nullable(),
})

export type AssignContractInput = z.infer<typeof assignContractSchema>
export type ReturnContractAssignmentInput = z.infer<typeof returnContractAssignmentSchema>
