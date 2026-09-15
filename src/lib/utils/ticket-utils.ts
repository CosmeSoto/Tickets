/**
 * Utilidades para tickets
 * Funciones compartidas para manejo de tickets, prioridades, estados, etc.
 */

import { TICKET_PRIORITY_LABELS, TICKET_PRIORITY_COLORS } from '@/lib/constants/ticket-labels'

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
  status: { key: 'status', label: 'Estado', format: (v: string) => getStatusLabel(v) },
  priority: {
    key: 'priority',
    label: 'Prioridad',
    format: (v: string) => getPriorityLabel(v),
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
  resolvedAt: {
    key: 'resolvedAt',
    label: 'Resuelto',
    format: (v: any) => (v ? new Date(v).toLocaleDateString('es-ES') : ''),
  },
  closedAt: {
    key: 'closedAt',
    label: 'Cerrado',
    format: (v: any) => (v ? new Date(v).toLocaleDateString('es-ES') : ''),
  },
  ticketCode: {
    key: 'ticketCode',
    label: 'Código',
    format: (v: any, r: any) => v ?? r?.id?.slice(-8)?.toUpperCase() ?? '',
  },
}
