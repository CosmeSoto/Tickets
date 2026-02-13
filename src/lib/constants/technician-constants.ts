/**
 * Constantes centralizadas para el módulo de técnicos
 * Evita duplicación y asegura consistencia visual
 */

import { Users, UserCheck, UserX, Building, Ticket, LucideIcon } from 'lucide-react'

// ============================================================================
// ESTADOS DE TÉCNICOS
// ============================================================================

export const TECHNICIAN_STATUSES = {
  ALL: 'all',
  ACTIVE: 'true',
  INACTIVE: 'false'
} as const

export type TechnicianStatus = typeof TECHNICIAN_STATUSES[keyof typeof TECHNICIAN_STATUSES]

// ============================================================================
// OPCIONES DE FILTRO DE ESTADO
// ============================================================================

export const TECHNICIAN_STATUS_FILTER_OPTIONS = [
  { value: TECHNICIAN_STATUSES.ALL, label: 'Todos los estados' },
  { value: TECHNICIAN_STATUSES.ACTIVE, label: 'Activos' },
  { value: TECHNICIAN_STATUSES.INACTIVE, label: 'Inactivos' }
] as const

export type TechnicianStatusFilterOption = typeof TECHNICIAN_STATUS_FILTER_OPTIONS[number]

// ============================================================================
// ESTADOS DE TICKETS (para filtros de técnicos)
// ============================================================================

export const TICKET_STATUSES = {
  ALL: 'all',
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  ON_HOLD: 'ON_HOLD'
} as const

export type TicketStatus = typeof TICKET_STATUSES[keyof typeof TICKET_STATUSES]

export const TICKET_STATUS_FILTER_OPTIONS = [
  { value: TICKET_STATUSES.ALL, label: 'Todos los estados' },
  { value: TICKET_STATUSES.OPEN, label: 'Abierto' },
  { value: TICKET_STATUSES.IN_PROGRESS, label: 'En Progreso' },
  { value: TICKET_STATUSES.RESOLVED, label: 'Resuelto' },
  { value: TICKET_STATUSES.CLOSED, label: 'Cerrado' },
  { value: TICKET_STATUSES.ON_HOLD, label: 'En Espera' }
] as const

// ============================================================================
// PRIORIDADES DE TICKETS
// ============================================================================

export const TICKET_PRIORITIES = {
  ALL: 'all',
  URGENT: 'URGENT',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
} as const

export type TicketPriority = typeof TICKET_PRIORITIES[keyof typeof TICKET_PRIORITIES]

export const TICKET_PRIORITY_FILTER_OPTIONS = [
  { value: TICKET_PRIORITIES.ALL, label: 'Todas las prioridades' },
  { value: TICKET_PRIORITIES.URGENT, label: 'Urgente' },
  { value: TICKET_PRIORITIES.HIGH, label: 'Alta' },
  { value: TICKET_PRIORITIES.MEDIUM, label: 'Media' },
  { value: TICKET_PRIORITIES.LOW, label: 'Baja' }
] as const

// ============================================================================
// FILTROS DE FECHA
// ============================================================================

export const DATE_FILTERS = {
  ALL: 'all',
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  WEEK: 'week',
  MONTH: 'month',
  OLDER: 'older'
} as const

export type DateFilter = typeof DATE_FILTERS[keyof typeof DATE_FILTERS]

export const DATE_FILTER_OPTIONS = [
  { value: DATE_FILTERS.ALL, label: 'Todas las fechas' },
  { value: DATE_FILTERS.TODAY, label: 'Hoy' },
  { value: DATE_FILTERS.YESTERDAY, label: 'Ayer' },
  { value: DATE_FILTERS.WEEK, label: 'Esta semana' },
  { value: DATE_FILTERS.MONTH, label: 'Este mes' },
  { value: DATE_FILTERS.OLDER, label: 'Más antiguo' }
] as const

// ============================================================================
// COLORES E ICONOS PARA ESTADOS
// ============================================================================

export const TECHNICIAN_STATUS_COLORS = {
  'true': 'bg-green-100 text-green-700 border-green-200',
  'false': 'bg-red-100 text-red-700 border-red-200'
} as const

export const TECHNICIAN_STATUS_ICONS: Record<string, LucideIcon> = {
  [TECHNICIAN_STATUSES.ALL]: Users,
  [TECHNICIAN_STATUSES.ACTIVE]: UserCheck,
  [TECHNICIAN_STATUSES.INACTIVE]: UserX
} as const

// ============================================================================
// COLORES PARA ESTADOS DE TICKETS
// ============================================================================

export const TICKET_STATUS_COLORS = {
  'OPEN': 'bg-orange-100 text-orange-700 border-orange-200',
  'IN_PROGRESS': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'RESOLVED': 'bg-green-100 text-green-700 border-green-200',
  'CLOSED': 'bg-gray-100 text-gray-700 border-gray-200',
  'ON_HOLD': 'bg-purple-100 text-purple-700 border-purple-200'
} as const

// ============================================================================
// COLORES PARA PRIORIDADES
// ============================================================================

export const TICKET_PRIORITY_COLORS = {
  'URGENT': 'bg-red-500',
  'HIGH': 'bg-orange-500',
  'MEDIUM': 'bg-yellow-500',
  'LOW': 'bg-green-500'
} as const

// ============================================================================
// CAMPOS DE BÚSQUEDA
// ============================================================================

export const TECHNICIAN_SEARCH_FIELDS = [
  'name',
  'email',
  'phone',
  'department.name'
] as const

export const TICKET_SEARCH_FIELDS = [
  'title',
  'description',
  'createdBy.name',
  'createdBy.email'
] as const

// ============================================================================
// CONFIGURACIÓN DE ESTADÍSTICAS
// ============================================================================

export const TECHNICIAN_STATS_CONFIG = [
  {
    key: 'total',
    label: 'Total Técnicos',
    icon: Users,
    color: 'bg-blue-50 border-blue-200',
    textColor: 'text-blue-700'
  },
  {
    key: 'active',
    label: 'Activos',
    icon: UserCheck,
    color: 'bg-green-50 border-green-200',
    textColor: 'text-green-700'
  },
  {
    key: 'inactive',
    label: 'Inactivos',
    icon: UserX,
    color: 'bg-red-50 border-red-200',
    textColor: 'text-red-700'
  },
  {
    key: 'totalTickets',
    label: 'Tickets Asignados',
    icon: Ticket,
    color: 'bg-purple-50 border-purple-200',
    textColor: 'text-purple-700'
  },
  {
    key: 'departments',
    label: 'Departamentos',
    icon: Building,
    color: 'bg-orange-50 border-orange-200',
    textColor: 'text-orange-700'
  }
] as const

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Obtiene el label de un estado de técnico
 */
export function getTechnicianStatusLabel(status: TechnicianStatus): string {
  const option = TECHNICIAN_STATUS_FILTER_OPTIONS.find(o => o.value === status)
  return option?.label || status
}

/**
 * Obtiene el color de un estado de técnico
 */
export function getTechnicianStatusColor(status: TechnicianStatus): string {
  if (status === 'true' || status === 'false') {
    return TECHNICIAN_STATUS_COLORS[status as 'true' | 'false']
  }
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

/**
 * Obtiene el icono de un estado de técnico
 */
export function getTechnicianStatusIcon(status: string): LucideIcon {
  return TECHNICIAN_STATUS_ICONS[status] || Users
}

/**
 * Obtiene el label de un estado de ticket
 */
export function getTicketStatusLabel(status: TicketStatus): string {
  const option = TICKET_STATUS_FILTER_OPTIONS.find(o => o.value === status)
  return option?.label || status
}

/**
 * Obtiene el color de un estado de ticket
 */
export function getTicketStatusColor(status: TicketStatus): string {
  if (status !== 'all' && status in TICKET_STATUS_COLORS) {
    return TICKET_STATUS_COLORS[status as keyof typeof TICKET_STATUS_COLORS]
  }
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

/**
 * Obtiene el label de una prioridad
 */
export function getTicketPriorityLabel(priority: TicketPriority): string {
  const option = TICKET_PRIORITY_FILTER_OPTIONS.find(o => o.value === priority)
  return option?.label || priority
}

/**
 * Obtiene el color de una prioridad
 */
export function getTicketPriorityColor(priority: TicketPriority): string {
  if (priority !== 'all' && priority in TICKET_PRIORITY_COLORS) {
    return TICKET_PRIORITY_COLORS[priority as keyof typeof TICKET_PRIORITY_COLORS]
  }
  return 'bg-gray-500'
}

/**
 * Obtiene el label de un filtro de fecha
 */
export function getDateFilterLabel(dateFilter: DateFilter): string {
  const option = DATE_FILTER_OPTIONS.find(o => o.value === dateFilter)
  return option?.label || dateFilter
}

/**
 * Valida si un valor es un estado de técnico válido
 */
export function isValidTechnicianStatus(value: any): value is TechnicianStatus {
  return Object.values(TECHNICIAN_STATUSES).includes(value)
}

/**
 * Valida si un valor es un estado de ticket válido
 */
export function isValidTicketStatus(value: any): value is TicketStatus {
  return Object.values(TICKET_STATUSES).includes(value)
}

/**
 * Valida si un valor es una prioridad válida
 */
export function isValidTicketPriority(value: any): value is TicketPriority {
  return Object.values(TICKET_PRIORITIES).includes(value)
}