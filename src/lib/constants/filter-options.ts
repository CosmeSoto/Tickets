/**
 * Constantes compartidas para filtros del sistema
 * Centraliza todas las opciones de filtros para evitar duplicación
 */

export const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'OPEN', label: 'Abierto' },
  { value: 'IN_PROGRESS', label: 'En Progreso' },
  { value: 'RESOLVED', label: 'Resuelto' },
  { value: 'CLOSED', label: 'Cerrado' }
] as const

export const PRIORITY_OPTIONS = [
  { value: 'all', label: 'Todas las prioridades' },
  { value: 'URGENT', label: 'Urgente' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'LOW', label: 'Baja' }
] as const

export const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'Todas las fechas' },
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'older', label: 'Más antiguo' }
] as const

// Constantes específicas para usuarios
export const USER_ROLE_OPTIONS = [
  { value: 'all', label: 'Todos los roles' },
  { value: 'ADMIN', label: 'Administradores' },
  { value: 'TECHNICIAN', label: 'Técnicos' },
  { value: 'CLIENT', label: 'Clientes' }
] as const

export const USER_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' }
] as const

export const USER_ROLE_LABELS = {
  ADMIN: 'Administrador',
  TECHNICIAN: 'Técnico',
  CLIENT: 'Cliente'
} as const

export const USER_ROLE_COLORS = {
  ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
  TECHNICIAN: 'bg-blue-100 text-blue-700 border-blue-200',
  CLIENT: 'bg-green-100 text-green-700 border-green-200'
} as const

export const USER_SEARCH_FIELDS = [
  'name',
  'email',
  'department.name',
  'phone'
] as const

export const TICKET_SEARCH_FIELDS = [
  'title',
  'description', 
  'client.name',
  'client.email',
  'assignee.name',
  'category.name'
] as const

export type StatusFilter = typeof STATUS_OPTIONS[number]['value']
export type PriorityFilter = typeof PRIORITY_OPTIONS[number]['value']
export type DateFilter = typeof DATE_FILTER_OPTIONS[number]['value']
export type UserRoleFilter = typeof USER_ROLE_OPTIONS[number]['value']
export type UserStatusFilter = typeof USER_STATUS_OPTIONS[number]['value']