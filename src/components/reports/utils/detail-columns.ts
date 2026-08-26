/**
 * Definiciones de columnas para la pestaña "Detalle de Tickets" — filas
 * individuales devueltas por `GET /api/reports?type=tickets` (ver
 * `ReportService.getDetailedTickets` en `ticket-report.service.ts`). No se
 * modifica el backend: las columnas de acá se ajustan exactamente a los
 * campos que ese endpoint ya devuelve.
 */

import type { TableColumnDef } from '@/components/common/table-columns-menu'
import type { ExportColumn } from '@/lib/utils/export'
import { formatDateTimeShort } from '@/lib/utils/date-utils'

export interface DetailedTicketRow {
  id: string
  title: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  resolutionTime: string | null
  slaStatus: 'COMPLIANT' | 'BREACHED' | 'AT_RISK' | 'NO_SLA'
  slaMetrics?: {
    responseSLAMet: boolean | null
    resolutionSLAMet: boolean | null
    violationsCount: number
  }
  client: { id: string; name: string; email: string } | null
  assignee: { id: string; name: string; email: string } | null
  createdBy: { id: string; name: string; email: string; role: string } | null
  category: { id: string; name: string; color: string }
  department: { id: string; name: string } | null
  rating: { score: number; comment: string | null } | null
  commentsCount: number
  attachmentsCount: number
  /** Equipo completo del ticket — técnicos/admins que acompañan al asignado principal. */
  collaborators?: Array<{ id: string; name: string; email: string }>
}

export const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En Progreso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
  ON_HOLD: 'En Espera',
}

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

export const SLA_STATUS_LABELS: Record<string, string> = {
  COMPLIANT: 'Cumplido',
  BREACHED: 'Incumplido',
  AT_RISK: 'En riesgo',
  NO_SLA: 'Sin SLA',
}

/** Selector de columnas — 'title' es la única obligatoria. Orden por defecto. */
export const DETAIL_COLUMN_DEFS: TableColumnDef[] = [
  { key: 'title', label: 'Ticket', required: true },
  { key: 'status', label: 'Estado' },
  { key: 'priority', label: 'Prioridad' },
  { key: 'category', label: 'Categoría' },
  { key: 'department', label: 'Departamento' },
  { key: 'client', label: 'Cliente' },
  { key: 'assignee', label: 'Técnico' },
  { key: 'createdAt', label: 'Creado' },
  { key: 'resolvedAt', label: 'Resuelto' },
  { key: 'resolutionTime', label: 'Tiempo de resolución' },
  { key: 'slaStatus', label: 'SLA' },
  { key: 'slaViolations', label: 'Violaciones SLA abiertas' },
  { key: 'rating', label: 'Calificación' },
  { key: 'createdBy', label: 'Creado por' },
  { key: 'collaborators', label: 'Colaboradores' },
]

/** Visibles por defecto — el resto queda disponible en el selector pero oculto. */
export const DETAIL_DEFAULT_VISIBLE = [
  'title',
  'status',
  'priority',
  'category',
  'client',
  'assignee',
  'collaborators',
  'createdAt',
  'resolutionTime',
  'slaStatus',
]

function fmtDate(v: string | null): string {
  return v ? formatDateTimeShort(v) : '—'
}

/** Mapa de columnas de exportación, keyed igual que DETAIL_COLUMN_DEFS. */
export const DETAIL_EXPORT_COLUMN_MAP: Record<string, ExportColumn> = {
  title: { key: 'title', label: 'Ticket' },
  status: { key: 'status', label: 'Estado', format: (v: string) => STATUS_LABELS[v] ?? v },
  priority: { key: 'priority', label: 'Prioridad', format: (v: string) => PRIORITY_LABELS[v] ?? v },
  category: { key: 'category', label: 'Categoría', format: (v: any) => v?.name ?? '' },
  department: { key: 'department', label: 'Departamento', format: (v: any) => v?.name ?? '—' },
  client: { key: 'client', label: 'Cliente', format: (v: any) => v?.name ?? '' },
  assignee: { key: 'assignee', label: 'Técnico', format: (v: any) => v?.name ?? 'Sin asignar' },
  createdAt: { key: 'createdAt', label: 'Creado', format: (v: string) => fmtDate(v) },
  resolvedAt: { key: 'resolvedAt', label: 'Resuelto', format: (v: string | null) => fmtDate(v) },
  resolutionTime: {
    key: 'resolutionTime',
    label: 'Tiempo de resolución',
    format: (v: any) => v ?? '—',
  },
  slaStatus: {
    key: 'slaStatus',
    label: 'SLA',
    format: (v: string) => SLA_STATUS_LABELS[v] ?? v,
  },
  slaViolations: {
    key: 'slaMetrics',
    label: 'Violaciones SLA abiertas',
    format: (v: any) => String(v?.violationsCount ?? 0),
  },
  rating: {
    key: 'rating',
    label: 'Calificación',
    format: (v: any) => (v?.score != null ? `★ ${v.score}` : '—'),
  },
  createdBy: { key: 'createdBy', label: 'Creado por', format: (v: any) => v?.name ?? '—' },
  collaborators: {
    key: 'collaborators',
    label: 'Colaboradores',
    format: (v: any) =>
      Array.isArray(v) && v.length > 0 ? v.map((c: any) => c.name).join(', ') : '—',
  },
}
