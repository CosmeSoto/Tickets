/** Mismo vocabulario que resolution_tasks — compartido entre POST y PATCH
 *  de /api/planner/personal-tasks para no repetir la lista dos veces. */
export const PERSONAL_TASK_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'] as const
export const PERSONAL_TASK_PRIORITIES = ['low', 'medium', 'high'] as const

export type PersonalTaskStatus = (typeof PERSONAL_TASK_STATUSES)[number]
export type PersonalTaskPriority = (typeof PERSONAL_TASK_PRIORITIES)[number]

export function isValidPersonalTaskStatus(value: unknown): value is PersonalTaskStatus {
  return typeof value === 'string' && (PERSONAL_TASK_STATUSES as readonly string[]).includes(value)
}

export function isValidPersonalTaskPriority(value: unknown): value is PersonalTaskPriority {
  return (
    typeof value === 'string' && (PERSONAL_TASK_PRIORITIES as readonly string[]).includes(value)
  )
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** combineDateAndTime (time-utils.ts) no valida el formato — un string
 *  cualquiera produce un Invalid Date que Prisma rechaza con un 500 crudo en
 *  vez de un 400 con mensaje útil. Se valida antes, en las rutas. */
export function isValidDateOnlyString(value: unknown): value is string {
  return typeof value === 'string' && DATE_ONLY.test(value)
}
