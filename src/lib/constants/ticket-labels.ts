/**
 * Etiquetas y traducciones centralizadas para el módulo de tickets.
 *
 * ÚNICA fuente de verdad para:
 * - Estados de ticket (OPEN, IN_PROGRESS, RESOLVED, CLOSED, ON_HOLD)
 * - Prioridades (LOW, MEDIUM, HIGH, URGENT)
 * - Nombres de campos técnicos → español
 * - Acciones del historial → español
 * - Roles de usuario → español
 *
 * Importar desde aquí en lugar de definir localmente en cada componente/route.
 */

// ─── Estados ──────────────────────────────────────────────────────────────────

export const TICKET_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En Progreso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
  ON_HOLD: 'En Espera',
}

export const TICKET_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300',
  CLOSED: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
  ON_HOLD: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
}

// ─── Prioridades ──────────────────────────────────────────────────────────────

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

export const TICKET_PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
  URGENT: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
}

// ─── Campos técnicos → español ────────────────────────────────────────────────

export const TICKET_FIELD_LABELS: Record<string, string> = {
  title: 'título',
  description: 'descripción',
  status: 'estado',
  priority: 'prioridad',
  assigneeId: 'técnico asignado',
  categoryId: 'categoría',
  location: 'ubicación',
  tags: 'etiquetas',
  familyId: 'área',
  clientId: 'solicitante',
  ticketCode: 'código',
}

// ─── Acciones del historial → español ────────────────────────────────────────

export const TICKET_ACTION_LABELS: Record<string, string> = {
  created: 'Ticket creado',
  updated: 'Ticket actualizado',
  status_changed: 'Estado actualizado',
  priority_changed: 'Prioridad cambiada',
  assigned: 'Técnico asignado',
  unassigned: 'Técnico desasignado',
  auto_assigned: 'Asignación automática',
  reassigned: 'Técnico reasignado',
  comment_added: 'Comentario',
  resolved: 'Ticket resuelto',
  rating_submitted: 'Calificación recibida',
  file_uploaded: 'Archivo adjunto',
  resolution_plan_created: 'Plan de resolución creado',
  resolution_plan_updated: 'Plan de resolución actualizado',
  resolution_plan_completed: 'Plan de resolución completado',
  resolution_plan_deleted: 'Plan de resolución eliminado',
  resolution_task_created: 'Nueva tarea agregada',
  resolution_task_updated: 'Tarea actualizada',
  resolution_task_deleted: 'Tarea eliminada',
}

// ─── Roles de usuario → español ───────────────────────────────────────────────

export const USER_ROLE_LABELS_ES: Record<string, string> = {
  ADMIN: 'Admin',
  TECHNICIAN: 'Técnico',
  CLIENT: 'Cliente',
  SUPER_ADMIN: 'Super Admin',
}

// ─── Funciones de utilidad ────────────────────────────────────────────────────

/** Traduce un estado de ticket a español */
export function translateStatus(status: string): string {
  return TICKET_STATUS_LABELS[status] ?? status
}

/** Traduce una prioridad de ticket a español */
export function translatePriority(priority: string): string {
  return TICKET_PRIORITY_LABELS[priority] ?? priority
}

/** Traduce un nombre de campo técnico a español */
export function translateField(field: string): string {
  return TICKET_FIELD_LABELS[field] ?? field
}

/** Traduce una lista de campos técnicos separados por coma */
export function translateFieldNames(fields: string[]): string {
  return fields.map(f => TICKET_FIELD_LABELS[f.trim()] ?? f.trim()).join(', ')
}

/** Traduce un valor según el campo al que pertenece */
export function translateFieldValue(field: string | null, value: string | null): string {
  if (!value) return '—'
  if (field === 'status' || TICKET_STATUS_LABELS[value]) return TICKET_STATUS_LABELS[value] ?? value
  if (field === 'priority' || TICKET_PRIORITY_LABELS[value])
    return TICKET_PRIORITY_LABELS[value] ?? value
  return value
}

/** Traduce una acción del historial a español */
export function translateAction(action: string): string {
  return TICKET_ACTION_LABELS[action] ?? action
}

/** Traduce un rol de usuario a español */
export function translateRole(role: string): string {
  return USER_ROLE_LABELS_ES[role] ?? role
}

/** Opciones de estado para selectores (incluye "Todos") */
export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'OPEN', label: TICKET_STATUS_LABELS.OPEN },
  { value: 'IN_PROGRESS', label: TICKET_STATUS_LABELS.IN_PROGRESS },
  { value: 'RESOLVED', label: TICKET_STATUS_LABELS.RESOLVED },
  { value: 'CLOSED', label: TICKET_STATUS_LABELS.CLOSED },
  { value: 'ON_HOLD', label: TICKET_STATUS_LABELS.ON_HOLD },
] as const

/** Opciones de prioridad para selectores (incluye "Todas") */
export const PRIORITY_FILTER_OPTIONS = [
  { value: 'all', label: 'Todas las prioridades' },
  { value: 'URGENT', label: TICKET_PRIORITY_LABELS.URGENT },
  { value: 'HIGH', label: TICKET_PRIORITY_LABELS.HIGH },
  { value: 'MEDIUM', label: TICKET_PRIORITY_LABELS.MEDIUM },
  { value: 'LOW', label: TICKET_PRIORITY_LABELS.LOW },
] as const
