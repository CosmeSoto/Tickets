import { z } from 'zod'

export const assignLicenseScopeSchema = z
  .object({
    scope: z.enum(['INDIVIDUAL', 'DEPARTMENT', 'COMPANY']),
    userId: z.string().uuid().optional().nullable(),
    departmentId: z.string().optional().nullable(),
    equipmentId: z.string().uuid().optional().nullable(),
    changeReason: z.string().max(500).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .refine(d => d.scope !== 'INDIVIDUAL' || !!d.userId || !!d.equipmentId, {
    message: 'Asigna un usuario o un equipo',
    path: ['userId'],
  })
  .refine(d => !(d.scope === 'INDIVIDUAL' && d.userId && d.equipmentId), {
    message: 'Una licencia individual no puede ir a usuario y equipo a la vez',
    path: ['userId'],
  })
  .refine(d => d.scope !== 'DEPARTMENT' || !!d.departmentId, {
    message: 'Selecciona un departamento',
    path: ['departmentId'],
  })

export type AssignLicenseScopeInput = z.infer<typeof assignLicenseScopeSchema>
