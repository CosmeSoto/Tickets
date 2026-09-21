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
