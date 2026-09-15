/**
 * Utilidades para tickets
 * Funciones compartidas para manejo de tickets, prioridades, estados, etc.
 */

import { TICKET_PRIORITY_LABELS, TICKET_PRIORITY_COLORS } from '@/lib/constants/ticket-labels'
import { formatDateTimeShort } from '@/lib/utils/date-utils'
import { formatDuration } from '@/lib/tickets/sla-countdown'

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ON_HOLD'

/**
 * Obtiene las clases de color para una prioridad.
 * Reusa TICKET_PRIORITY_COLORS (src/lib/constants/ticket-labels.ts, única
 * fuente de verdad) en vez de una paleta propia — antes esta función tenía
 * su propia paleta verde/amarillo/naranja/rojo, distinta de la que usa
 * PriorityBadge (el componente que realmente se ve en la mayoría de la UI).
 */
export const getPriorityColor = (priority: Priority | string): string => {
  const base = TICKET_PRIORITY_COLORS[priority]
  return base
    ? `${base} border border-current border-opacity-20`
    : 'bg-muted text-muted-foreground border border-border'
}

/**
 * Obtiene las clases de color para un estado.
 * Debe coincidir con TICKET_STATUSES en `@/hooks/use-ticket-data` (única fuente
 * de verdad para el color de cada estado) — no reordenar sin actualizar ambos.
 */
export const getStatusColor = (status: Status | string): string => {
  const colors: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40',
    IN_PROGRESS:
      'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/40',
    RESOLVED:
      'bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40',
    CLOSED:
      'bg-muted text-muted-foreground border border-border dark:bg-muted/60 dark:text-muted-foreground',
    ON_HOLD:
      'bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40',
  }
  return colors[status] || 'bg-muted text-muted-foreground border border-border'
}

/**
 * Obtiene la etiqueta en español para una prioridad
 */
export const getPriorityLabel = (priority: Priority | string): string =>
  TICKET_PRIORITY_LABELS[priority] ?? priority

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

// ── Columnas de exportación centralizadas ────────────────────────────────────
// Evita duplicar la misma definición en admin/tickets, client/tickets y technician/tickets

import type { ExportColumn } from '@/lib/utils/export'

/**
 * Formatea una fecha para exportación con fecha Y hora (antes usaba
 * `toLocaleDateString('es-ES')` sin `hour`/`minute` ni zona horaria —
 * mostraba solo "14/9/2026", a diferencia de las tablas en pantalla que sí
 * muestran hora vía formatTimeAgo).
 */
const formatExportDateTime = (v: any): string => (v ? formatDateTimeShort(v) : '')

/** "2h 15min" desde que se creó el ticket hasta la primera respuesta; "Sin respuesta aún" si no la tiene. */
const formatFirstResponseTime = (v: any, row: any): string => {
  if (!v || !row?.createdAt) return 'Sin respuesta aún'
  return formatDuration(new Date(v).getTime() - new Date(row.createdAt).getTime())
}

/** Calificación (1-5) que dejó el cliente, si ya calificó. */
const formatRating = (v: any): string => (v?.rating ? `${v.rating}/5` : 'Sin calificar')

/** Columnas base compartidas por todos los roles */
const BASE_TICKET_EXPORT_COLUMNS: ExportColumn[] = [
  {
    key: 'ticketCode',
    label: 'Código',
    format: (v: any, r: any) => v ?? r?.id?.slice(-8)?.toUpperCase() ?? '',
  },
  { key: 'title', label: 'Título' },
  { key: 'status', label: 'Estado', format: (v: string) => getStatusLabel(v) },
  { key: 'priority', label: 'Prioridad', format: (v: string) => getPriorityLabel(v) },
  { key: 'category', label: 'Categoría', format: (v: any) => v?.name ?? '' },
  { key: 'family', label: 'Área', format: (v: any) => v?.name ?? '' },
  { key: 'createdAt', label: 'Creado', format: formatExportDateTime },
  { key: 'updatedAt', label: 'Actualizado', format: formatExportDateTime },
  { key: 'firstResponseAt', label: 'Primera respuesta', format: formatFirstResponseTime },
  { key: 'resolvedAt', label: 'Resuelto', format: formatExportDateTime },
  { key: 'closedAt', label: 'Cerrado', format: formatExportDateTime },
  { key: 'ticket_ratings', label: 'Calificación', format: formatRating },
]

const BASE_BY_KEY: Record<string, ExportColumn> = Object.fromEntries(
  BASE_TICKET_EXPORT_COLUMNS.map(c => [c.key, c])
)

/** Columnas de exportación para TECHNICIAN (incluye cliente, sin técnico asignado) */
export const TECHNICIAN_TICKET_EXPORT_COLUMNS: ExportColumn[] = [
  BASE_BY_KEY.ticketCode,
  BASE_BY_KEY.title,
  BASE_BY_KEY.status,
  BASE_BY_KEY.priority,
  { key: 'client', label: 'Cliente', format: (v: any) => v?.name ?? '' },
  BASE_BY_KEY.category,
  BASE_BY_KEY.family,
  BASE_BY_KEY.createdAt,
  BASE_BY_KEY.firstResponseAt,
  BASE_BY_KEY.resolvedAt,
  BASE_BY_KEY.closedAt,
  BASE_BY_KEY.ticket_ratings,
]

/** Columnas de exportación para CLIENT (sin cliente, incluye técnico asignado) */
export const CLIENT_TICKET_EXPORT_COLUMNS: ExportColumn[] = [
  BASE_BY_KEY.ticketCode,
  BASE_BY_KEY.title,
  BASE_BY_KEY.status,
  BASE_BY_KEY.priority,
  { key: 'assignee', label: 'Técnico', format: (v: any) => v?.name ?? 'Sin asignar' },
  BASE_BY_KEY.category,
  BASE_BY_KEY.family,
  BASE_BY_KEY.createdAt,
  BASE_BY_KEY.updatedAt,
  BASE_BY_KEY.resolvedAt,
  BASE_BY_KEY.closedAt,
  BASE_BY_KEY.ticket_ratings,
]

/**
 * Mapa de columnas de exportación para el datatable de Admin, keyed igual que
 * las columnas visibles de la tabla (`ticket-columns.tsx`) — permite exportar
 * exactamente las columnas visibles/ordenadas que el usuario eligió en el
 * selector de columnas ("lo que ves es lo que exportas").
 */
export const ADMIN_TICKET_EXPORT_COLUMN_MAP: Record<string, ExportColumn | null> = {
  title: BASE_BY_KEY.title,
  family: BASE_BY_KEY.family,
  status: BASE_BY_KEY.status,
  priority: BASE_BY_KEY.priority,
  sla: null, // la cuenta regresiva de SLA no tiene sentido fuera de la pantalla en vivo
  client: { key: 'client', label: 'Cliente', format: (v: any) => v?.name ?? '' },
  assignee: {
    key: 'assignee',
    label: 'Técnico',
    format: (v: any) => v?.name ?? 'Sin asignar',
  },
  category: BASE_BY_KEY.category,
  createdAt: BASE_BY_KEY.createdAt,
  updatedAt: { ...BASE_BY_KEY.updatedAt, label: 'Actividad' },
  firstResponseAt: BASE_BY_KEY.firstResponseAt,
  resolvedAt: BASE_BY_KEY.resolvedAt,
  closedAt: BASE_BY_KEY.closedAt,
  rating: BASE_BY_KEY.ticket_ratings,
  ticketCode: BASE_BY_KEY.ticketCode,
}
