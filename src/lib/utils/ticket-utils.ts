/**
 * Utilidades para tickets
 * Funciones compartidas para manejo de tickets, prioridades, estados, etc.
 */

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ON_HOLD'

/**
 * Obtiene las clases de color para una prioridad
 */
export const getPriorityColor = (priority: Priority | string): string => {
  const colors: Record<string, string> = {
    URGENT:
      'bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/40',
    HIGH: 'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/40',
    MEDIUM:
      'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/40',
    LOW: 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40',
  }
  return colors[priority] || 'bg-muted text-muted-foreground border border-border'
}

/**
 * Obtiene las clases de color para un estado
 */
export const getStatusColor = (status: Status | string): string => {
  const colors: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40',
    IN_PROGRESS:
      'bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40',
    RESOLVED:
      'bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40',
    CLOSED:
      'bg-muted text-muted-foreground border border-border dark:bg-muted/60 dark:text-muted-foreground',
    ON_HOLD:
      'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/40',
  }
  return colors[status] || 'bg-muted text-muted-foreground border border-border'
}

/**
 * Obtiene la etiqueta en español para una prioridad
 */
export const getPriorityLabel = (priority: Priority | string): string => {
  const labels: Record<string, string> = {
    URGENT: 'Urgente',
    HIGH: 'Alta',
    MEDIUM: 'Media',
    LOW: 'Baja',
  }
  return labels[priority] || priority
}

/**
 * Obtiene la etiqueta en español para un estado
 */
export const getStatusLabel = (status: Status | string): string => {
  const labels: Record<string, string> = {
    OPEN: 'Abierto',
    IN_PROGRESS: 'En Progreso',
    RESOLVED: 'Resuelto',
    CLOSED: 'Cerrado',
    ON_HOLD: 'En Espera',
  }
  return labels[status] || status
}

/**
 * Formatea el tiempo transcurrido desde una fecha
 */
export const formatTimeElapsed = (date: string | Date): string => {
  const now = new Date()
  const created = new Date(date)
  const diff = now.getTime() - created.getTime()

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return 'Ahora'
}

/**
 * Obtiene el color del icono según la prioridad
 */
export const getPriorityIconColor = (priority: Priority | string): string => {
  const colors: Record<string, string> = {
    URGENT: 'text-red-600 dark:text-red-400',
    HIGH: 'text-orange-600 dark:text-orange-400',
    MEDIUM: 'text-yellow-600 dark:text-yellow-400',
    LOW: 'text-green-600 dark:text-green-400',
  }
  return colors[priority] || 'text-muted-foreground'
}

/**
 * Obtiene el color del icono según el estado
 */
export const getStatusIconColor = (status: Status | string): string => {
  const colors: Record<string, string> = {
    OPEN: 'text-blue-600 dark:text-blue-400',
    IN_PROGRESS: 'text-purple-600 dark:text-purple-400',
    RESOLVED: 'text-green-600 dark:text-green-400',
    CLOSED: 'text-muted-foreground',
  }
  return colors[status] || 'text-muted-foreground'
}

/**
 * Obtiene las opciones de prioridad para selects
 */
export const getPriorityOptions = () => [
  { value: 'LOW', label: 'Baja', color: 'green' },
  { value: 'MEDIUM', label: 'Media', color: 'yellow' },
  { value: 'HIGH', label: 'Alta', color: 'orange' },
  { value: 'URGENT', label: 'Urgente', color: 'red' },
]

/**
 * Obtiene las opciones de estado para selects
 */
export const getStatusOptions = () => [
  { value: 'OPEN', label: 'Abierto', color: 'blue' },
  { value: 'IN_PROGRESS', label: 'En Progreso', color: 'purple' },
  { value: 'RESOLVED', label: 'Resuelto', color: 'green' },
  { value: 'CLOSED', label: 'Cerrado', color: 'gray' },
]

/**
 * Verifica si un ticket está vencido (más de 24h sin respuesta)
 */
export const isTicketOverdue = (createdAt: string | Date, lastUpdate?: string | Date): boolean => {
  const now = new Date()
  const reference = lastUpdate ? new Date(lastUpdate) : new Date(createdAt)
  const diff = now.getTime() - reference.getTime()
  const hours = diff / (1000 * 60 * 60)
  return hours > 24
}

/**
 * Obtiene el nivel de urgencia de un ticket (0-100)
 */
export const getTicketUrgencyScore = (
  priority: Priority | string,
  status: Status | string,
  createdAt: string | Date
): number => {
  const priorityScores: Record<string, number> = {
    URGENT: 40,
    HIGH: 30,
    MEDIUM: 20,
    LOW: 10,
  }

  const statusScores: Record<string, number> = {
    OPEN: 30,
    IN_PROGRESS: 20,
    RESOLVED: 5,
    CLOSED: 0,
  }

  const timeScore = Math.min(
    30,
    Math.floor(Number(formatTimeElapsed(createdAt).replace(/\D/g, '') || 0))
  )

  return (priorityScores[priority] || 0) + (statusScores[status] || 0) + timeScore
}

/**
 * Filtra tickets según criterios
 */
export const filterTickets = <T extends { priority: string; status: string; title: string }>(
  tickets: T[],
  filters: {
    priority?: string
    status?: string
    search?: string
  }
): T[] => {
  return tickets.filter(ticket => {
    if (filters.priority && ticket.priority !== filters.priority) return false
    if (filters.status && ticket.status !== filters.status) return false
    if (filters.search && !ticket.title.toLowerCase().includes(filters.search.toLowerCase()))
      return false
    return true
  })
}

/**
 * Ordena tickets por urgencia
 */
export const sortTicketsByUrgency = <
  T extends { priority: string; status: string; createdAt: string },
>(
  tickets: T[]
): T[] => {
  return [...tickets].sort((a, b) => {
    const scoreA = getTicketUrgencyScore(a.priority, a.status, a.createdAt)
    const scoreB = getTicketUrgencyScore(b.priority, b.status, b.createdAt)
    return scoreB - scoreA
  })
}

// ── Columnas de exportación centralizadas ────────────────────────────────────
// Evita duplicar la misma definición en admin/tickets, client/tickets y technician/tickets

import type { ExportColumn } from '@/lib/utils/export'

const STATUS_LABELS_ES: Record<string, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En Progreso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
  ON_HOLD: 'En Espera',
}
const PRIORITY_LABELS_ES: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

/** Columnas base compartidas por todos los roles */
const BASE_TICKET_EXPORT_COLUMNS: ExportColumn[] = [
  {
    key: 'ticketCode',
    label: 'Código',
    format: (v: any, r: any) => v ?? r?.id?.slice(-8)?.toUpperCase() ?? '',
  },
  { key: 'title', label: 'Título' },
  { key: 'status', label: 'Estado', format: (v: string) => STATUS_LABELS_ES[v] ?? v },
  { key: 'priority', label: 'Prioridad', format: (v: string) => PRIORITY_LABELS_ES[v] ?? v },
  { key: 'category', label: 'Categoría', format: (v: any) => v?.name ?? '' },
  { key: 'family', label: 'Área', format: (v: any) => v?.name ?? '' },
  {
    key: 'createdAt',
    label: 'Creado',
    format: (v: any) => (v ? new Date(v).toLocaleDateString('es-ES') : ''),
  },
  {
    key: 'updatedAt',
    label: 'Actualizado',
    format: (v: any) => (v ? new Date(v).toLocaleDateString('es-ES') : ''),
  },
]

/** Columnas de exportación para ADMIN (incluye cliente y técnico asignado) */
export const ADMIN_TICKET_EXPORT_COLUMNS: ExportColumn[] = [
  ...BASE_TICKET_EXPORT_COLUMNS.slice(0, 4),
  { key: 'client', label: 'Cliente', format: (v: any) => v?.name ?? '' },
  { key: 'assignee', label: 'Técnico', format: (v: any) => v?.name ?? 'Sin asignar' },
  ...BASE_TICKET_EXPORT_COLUMNS.slice(4),
]

/** Columnas de exportación para TECHNICIAN (incluye cliente, sin técnico asignado) */
export const TECHNICIAN_TICKET_EXPORT_COLUMNS: ExportColumn[] = [
  ...BASE_TICKET_EXPORT_COLUMNS.slice(0, 4),
  { key: 'client', label: 'Cliente', format: (v: any) => v?.name ?? '' },
  ...BASE_TICKET_EXPORT_COLUMNS.slice(4, -1), // sin updatedAt
  {
    key: 'resolvedAt',
    label: 'Resuelto',
    format: (v: any) => (v ? new Date(v).toLocaleDateString('es-ES') : ''),
  },
]

/** Columnas de exportación para CLIENT (sin cliente, incluye técnico asignado) */
export const CLIENT_TICKET_EXPORT_COLUMNS: ExportColumn[] = [
  ...BASE_TICKET_EXPORT_COLUMNS.slice(0, 4),
  { key: 'assignee', label: 'Técnico', format: (v: any) => v?.name ?? 'Sin asignar' },
  ...BASE_TICKET_EXPORT_COLUMNS.slice(4),
]

/**
 * Mapa de columnas de exportación para el datatable de Admin, keyed igual que
 * las columnas visibles de la tabla (`ticket-columns.tsx`) — permite exportar
 * exactamente las columnas visibles/ordenadas que el usuario eligió en el
 * selector de columnas ("lo que ves es lo que exportas").
 */
export const ADMIN_TICKET_EXPORT_COLUMN_MAP: Record<string, ExportColumn> = {
  title: { key: 'title', label: 'Título' },
  family: { key: 'family', label: 'Área', format: (v: any) => v?.name ?? '' },
  status: { key: 'status', label: 'Estado', format: (v: string) => STATUS_LABELS_ES[v] ?? v },
  priority: {
    key: 'priority',
    label: 'Prioridad',
    format: (v: string) => PRIORITY_LABELS_ES[v] ?? v,
  },
  client: { key: 'client', label: 'Cliente', format: (v: any) => v?.name ?? '' },
  assignee: {
    key: 'assignee',
    label: 'Técnico',
    format: (v: any) => v?.name ?? 'Sin asignar',
  },
  category: { key: 'category', label: 'Categoría', format: (v: any) => v?.name ?? '' },
  createdAt: {
    key: 'createdAt',
    label: 'Creado',
    format: (v: any) => (v ? new Date(v).toLocaleDateString('es-ES') : ''),
  },
  updatedAt: {
    key: 'updatedAt',
    label: 'Actividad',
    format: (v: any) => (v ? new Date(v).toLocaleDateString('es-ES') : ''),
  },
  ticketCode: {
    key: 'ticketCode',
    label: 'Código',
    format: (v: any, r: any) => v ?? r?.id?.slice(-8)?.toUpperCase() ?? '',
  },
}
