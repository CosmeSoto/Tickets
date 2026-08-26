/**
 * Definiciones de columnas de exportación para las pestañas de Reportes.
 *
 * Reemplaza a `report-exporters.ts` (CSV/PDF hechos a mano con `downloadCSV`
 * propio y HTML+`window.print()` propio): en vez de reinventar la exportación,
 * cada pestaña define su `ExportColumn[]` y usa el trío genérico
 * `exportToCSV`/`exportToExcel`/`exportToPDF` de `@/lib/utils/export` (el
 * mismo que ya usan Tickets e Inventario) — así se gana Excel real gratis y
 * se deja de duplicar lógica de descarga/escape HTML.
 */

import type { ExportColumn } from '@/lib/utils/export'
import type { SatisfactionReport } from './report-types'
import { formatMinutes, priorityLabel } from './report-formatters'

export const EXECUTIVE_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'familyName', label: 'Familia' },
  { key: 'familyCode', label: 'Código' },
  { key: 'totalTickets', label: 'Total Tickets' },
  { key: 'openTickets', label: 'Abiertos' },
  { key: 'inProgressTickets', label: 'En Progreso' },
  { key: 'resolvedTickets', label: 'Resueltos' },
  { key: 'closedTickets', label: 'Cerrados' },
  {
    key: 'avgResolutionTimeMinutes',
    label: 'Tiempo Prom. Resolución',
    format: v => formatMinutes(v),
  },
  { key: 'slaComplianceRate', label: 'Cumplimiento SLA (%)' },
]

export const TECHNICIANS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'technicianName', label: 'Técnico' },
  { key: 'technicianEmail', label: 'Email' },
  { key: 'assignedTickets', label: 'Tickets Asignados' },
  { key: 'resolvedTickets', label: 'Tickets Resueltos' },
  {
    key: 'avgResolutionTimeMinutes',
    label: 'Tiempo Prom. Resolución',
    format: v => formatMinutes(v),
  },
  { key: 'avgRating', label: 'Calificación Promedio', format: v => (v !== null ? String(v) : '—') },
]

export const TRENDS_EXPORT_COLUMNS = (familyName: string): ExportColumn[] => [
  { key: 'period', label: 'Período' },
  { key: 'familyName', label: 'Familia', format: v => v ?? familyName },
  { key: 'count', label: 'Cantidad de Tickets' },
]

export const SLA_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'familyName', label: 'Familia' },
  { key: 'priority', label: 'Prioridad', format: v => priorityLabel(v) },
  { key: 'total', label: 'Total' },
  { key: 'compliant', label: 'Cumplidos' },
  { key: 'breached', label: 'Incumplidos' },
  { key: 'complianceRate', label: 'Tasa de Cumplimiento (%)' },
]

export const SATISFACTION_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'familyName', label: 'Familia' },
  { key: 'totalRatings', label: 'Total Calificaciones' },
  {
    key: 'avgRating',
    label: 'Promedio',
    format: v => (v !== null && v !== undefined ? String(v) : '—'),
  },
  {
    key: 'satisfactionRate',
    label: 'Tasa Satisfacción (%)',
    format: v => (v !== null && v !== undefined ? String(v) : '—'),
  },
  { key: 'star1', label: '★1' },
  { key: 'star2', label: '★2' },
  { key: 'star3', label: '★3' },
  { key: 'star4', label: '★4' },
  { key: 'star5', label: '★5' },
]

/**
 * Normaliza `SatisfactionReport` a filas planas para exportar: una fila por
 * familia si hay desglose, o una sola fila global con la distribución de
 * estrellas (mismo criterio que ya usaba `exportSatisfactionCSV`).
 */
export function satisfactionExportRows(data: SatisfactionReport, familyName: string) {
  if (data.byFamily.length > 0) {
    return data.byFamily.map(r => ({
      familyName: r.familyName,
      totalRatings: r.totalRatings,
      avgRating: r.avgRating,
      satisfactionRate: r.satisfactionRate,
      star1: '—',
      star2: '—',
      star3: '—',
      star4: '—',
      star5: '—',
    }))
  }
  return [
    {
      familyName,
      totalRatings: data.totalRatings,
      avgRating: data.avgRating,
      satisfactionRate: data.satisfactionRate,
      star1: data.distribution[1] ?? 0,
      star2: data.distribution[2] ?? 0,
      star3: data.distribution[3] ?? 0,
      star4: data.distribution[4] ?? 0,
      star5: data.distribution[5] ?? 0,
    },
  ]
}
