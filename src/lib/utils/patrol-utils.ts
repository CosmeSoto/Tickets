/**
 * Utilidades de exportación y etiquetas para el módulo de patrullas.
 * Sigue el mismo patrón que ticket-utils.ts.
 */

import type { ExportColumn } from '@/lib/utils/export'

// Re-exportar helper de formateo para uso en componentes (client-safe)
export { formatDurationMinutes } from '@/lib/patrol/patrol-format'

// ── Mapas de etiquetas en español ─────────────────────────────────────────────

export const PATROL_STATUS_LABELS_ES: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En Progreso',
  COMPLETED: 'Completado',
  MISSED: 'Omitida',
  INCOMPLETE: 'Incompleta',
}

export const CHECK_IN_METHOD_LABELS_ES: Record<string, string> = {
  QR_DYNAMIC: 'QR Dinámico',
  QR_STATIC: 'QR Estático',
  OFFLINE_SYNC: 'Sincronización Offline',
}

export const CHECK_IN_VALIDATION_LABELS_ES: Record<string, string> = {
  VALID: 'Válido',
  QR_TOKEN_INVALID: 'Token QR Inválido',
  GPS_OUT_OF_GEOFENCE: 'Fuera de Geofence',
  OFFLINE_SYNC_REJECTED: 'Sync Offline Rechazado',
}

export const PATROL_RECURRENCE_LABELS_ES: Record<string, string> = {
  NONE: 'Una sola vez',
  DAILY: 'Todos los días',
  // WEEKLY y CUSTOM tienen el mismo comportamiento (mismos días de semana configurables).
  // El formulario siempre guarda CUSTOM. WEEKLY se mantiene por compatibilidad con datos existentes.
  WEEKLY: 'Días de la semana',
  CUSTOM: 'Días de la semana',
}

export const QR_TYPE_LABELS_ES: Record<string, string> = {
  DYNAMIC: 'QR Dinámico',
  STATIC: 'QR Estático',
}

// ── Helpers de color para badges ──────────────────────────────────────────────

export function getPatrolStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    MISSED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    INCOMPLETE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  }
  return map[status] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
}

export function getValidationResultColor(result: string): string {
  const map: Record<string, string> = {
    VALID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    QR_TOKEN_INVALID: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    GPS_OUT_OF_GEOFENCE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    OFFLINE_SYNC_REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  return map[result] ?? 'bg-gray-100 text-gray-800'
}

// ── Columnas de exportación ───────────────────────────────────────────────────

/** Historial de patrullas (admin) */
export const PATROL_HISTORY_EXPORT_COLUMNS: ExportColumn[] = [
  {
    key: 'id',
    label: 'ID',
    format: (_v: any, r: any) => r?.id?.slice(-8)?.toUpperCase() ?? '',
  },
  { key: 'route', label: 'Ruta', format: (v: any) => v?.name ?? '' },
  { key: 'agent', label: 'Agente', format: (v: any) => v?.name ?? '' },
  { key: 'family', label: 'Área', format: (v: any) => v?.name ?? '' },
  {
    key: 'scheduledStart',
    label: 'Inicio Programado',
    format: (v: any) => (v ? new Date(v).toLocaleString('es-EC') : ''),
  },
  {
    key: 'startedAt',
    label: 'Inicio Real',
    format: (v: any) => (v ? new Date(v).toLocaleString('es-EC') : '—'),
  },
  {
    key: 'completedAt',
    label: 'Completado',
    format: (v: any) => (v ? new Date(v).toLocaleString('es-EC') : '—'),
  },
  {
    key: 'status',
    label: 'Estado',
    format: (v: string) => PATROL_STATUS_LABELS_ES[v] ?? v,
  },
  {
    key: 'completionPercentage',
    label: 'Completitud %',
    format: (v: any) => (v != null ? `${Math.round(v)}%` : '—'),
  },
]

/** Timeline de check-ins */
export const PATROL_CHECKINS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'checkpoint', label: 'Checkpoint', format: (v: any) => v?.name ?? '' },
  { key: 'checkpoint', label: 'Ubicación', format: (v: any) => v?.location ?? '' },
  {
    key: 'createdAt',
    label: 'Registrado',
    format: (v: any) => (v ? new Date(v).toLocaleString('es-EC') : ''),
  },
  {
    key: 'method',
    label: 'Método',
    format: (v: string) => CHECK_IN_METHOD_LABELS_ES[v] ?? v,
  },
  {
    key: 'validationResult',
    label: 'Resultado',
    format: (v: string) => CHECK_IN_VALIDATION_LABELS_ES[v] ?? v,
  },
  {
    key: 'gpsLat',
    label: 'GPS Validado',
    format: (_v: any, r: any) => (r?.gpsLat != null ? 'Sí' : 'No'),
  },
  {
    key: 'distanceFromCheckpointMeters',
    label: 'Distancia (m)',
    format: (v: any) => (v != null ? `${Math.round(v)} m` : '—'),
  },
]

/** Reporte de cumplimiento por personal */
export const PATROL_COMPLIANCE_AGENT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'agentName', label: 'Agente' },
  { key: 'assigned', label: 'Asignadas' },
  { key: 'completed', label: 'Completadas' },
  { key: 'missed', label: 'Omitidas' },
  { key: 'incomplete', label: 'Incompletas' },
  {
    key: 'avgCompletion',
    label: 'Completitud Promedio %',
    format: (v: any) => (v != null ? `${Math.round(v)}%` : '—'),
  },
]

/** Checkpoints */
export const PATROL_CHECKPOINTS_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'location', label: 'Ubicación' },
  { key: 'family', label: 'Área', format: (v: any) => v?.name ?? '—' },
  {
    key: 'qrType',
    label: 'Tipo QR',
    format: (v: string) => QR_TYPE_LABELS_ES[v] ?? v,
  },
  {
    key: 'hasConnectivity',
    label: 'Conectividad',
    format: (v: boolean) => (v ? 'Sí' : 'No'),
  },
  {
    key: 'isSensitive',
    label: 'Sensible',
    format: (v: boolean) => (v ? 'Sí' : 'No'),
  },
  {
    key: 'isActive',
    label: 'Estado',
    format: (v: boolean) => (v ? 'Activo' : 'Inactivo'),
  },
  {
    key: 'createdAt',
    label: 'Creado',
    format: (v: any) => (v ? new Date(v).toLocaleString('es-EC') : ''),
  },
]

/** Rutas */
export const PATROL_ROUTES_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'name', label: 'Nombre' },
  {
    key: 'family',
    label: 'Área',
    format: (v: any) => v?.name ?? '—',
  },
  {
    key: 'estimatedDurationMinutes',
    label: 'Duración (min)',
  },
  {
    key: '_count',
    label: 'Checkpoints',
    format: (v: any) => (v && typeof v === 'object' ? (v.routeCheckpoints ?? 0) : 0),
  },
  {
    key: 'isActive',
    label: 'Estado',
    format: (v: boolean) => (v ? 'Activa' : 'Inactiva'),
  },
  {
    key: 'createdAt',
    label: 'Creado',
    format: (v: any) => (v ? new Date(v).toLocaleString('es-EC') : ''),
  },
]

/** Programaciones */
export const PATROL_SCHEDULES_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'route', label: 'Ruta', format: (v: any) => v?.name ?? '' },
  { key: 'family', label: 'Área', format: (v: any) => v?.name ?? '—' },
  { key: 'agent', label: 'Agente', format: (v: any) => v?.name ?? '' },
  {
    key: 'scheduledStart',
    label: 'Inicio',
    format: (v: any) => (v ? new Date(v).toLocaleString('es-EC') : ''),
  },
  {
    key: 'scheduledEnd',
    label: 'Fin',
    format: (v: any) => (v ? new Date(v).toLocaleString('es-EC') : ''),
  },
  {
    key: 'recurrence',
    label: 'Frecuencia',
    format: (v: string) => PATROL_RECURRENCE_LABELS_ES[v] ?? v,
  },
  {
    key: 'recurrenceDays',
    label: 'Días',
    format: (v: any) => {
      if (!Array.isArray(v) || v.length === 0) return '—'
      const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      return v.map((d: number) => names[d] ?? d).join(', ')
    },
  },
  {
    key: 'overrideTimeValidation',
    label: 'Validación Horario',
    format: (v: boolean | null) =>
      v === null || v === undefined ? 'Default del área' : v ? 'Estricto' : 'Flexible',
  },
  {
    key: 'isActive',
    label: 'Estado',
    format: (v: boolean) => (v ? 'Activa' : 'Inactiva'),
  },
  {
    key: 'createdAt',
    label: 'Creado',
    format: (v: any) => (v ? new Date(v).toLocaleString('es-EC') : ''),
  },
]

/** Reporte de cumplimiento por ruta */
export const PATROL_COMPLIANCE_ROUTE_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'routeName', label: 'Ruta' },
  { key: 'executions', label: 'Ejecuciones' },
  {
    key: 'completionRate',
    label: 'Tasa de Completitud %',
    format: (v: any) => (v != null ? `${Math.round(v)}%` : '—'),
  },
  {
    key: 'avgDurationMinutes',
    label: 'Duración Promedio (min)',
    format: (v: any) => (v != null ? `${Math.round(v)} min` : '—'),
  },
  {
    key: 'mostMissedCheckpoints',
    label: 'Checkpoint Más Omitido',
    format: (v: any) => (Array.isArray(v) && v.length > 0 ? (v[0]?.name ?? '—') : '—'),
  },
]

// ── Novedades (Incidentes) ────────────────────────────────────────────────────

const INCIDENT_SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

const INCIDENT_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierta',
  RESOLVED: 'Resuelta',
  ESCALATED: 'Escalada',
}

/**
 * Columnas de exportación para novedades — vista AGENTE.
 * No incluye columna "Agente" porque es el propio usuario.
 */
export const PATROL_INCIDENTS_AGENT_EXPORT_COLUMNS: ExportColumn[] = [
  {
    key: 'createdAt',
    label: 'Fecha de Reporte',
    format: (v: any) =>
      v
        ? new Date(v).toLocaleString('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '',
  },
  { key: 'checkpoint', label: 'Checkpoint', format: (v: any) => v?.name ?? '' },
  { key: 'checkpoint', label: 'Ubicación', format: (v: any) => v?.location ?? '' },
  { key: 'patrol', label: 'Ruta', format: (v: any) => v?.route?.name ?? '' },
  { key: 'severity', label: 'Severidad', format: (v: string) => INCIDENT_SEVERITY_LABELS[v] ?? v },
  { key: 'status', label: 'Estado', format: (v: string) => INCIDENT_STATUS_LABELS[v] ?? v },
  { key: 'description', label: 'Descripción' },
  {
    key: 'resolvedAt',
    label: 'Fecha Resolución',
    format: (v: any) =>
      v
        ? new Date(v).toLocaleString('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—',
  },
  {
    key: 'ticket',
    label: 'Ticket (si escalada)',
    format: (v: any) => (v?.ticketCode ? `#${v.ticketCode}` : '—'),
  },
]

/**
 * Columnas de exportación para novedades — vista ADMIN/SUPERVISOR.
 * Incluye todos los campos temporales: fecha de reporte, inicio de ronda,
 * fecha de resolución/escalado, tiempo de atención calculado, y datos del ticket.
 */
export const PATROL_INCIDENTS_ADMIN_EXPORT_COLUMNS: ExportColumn[] = [
  // ── Identificación ────────────────────────────────────────────────────────
  {
    key: 'createdAt',
    label: 'Fecha de Reporte',
    format: (v: any) =>
      v
        ? new Date(v).toLocaleString('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '',
  },
  { key: 'agent', label: 'Agente', format: (v: any) => v?.name ?? '' },
  { key: 'patrol', label: 'Área', format: (v: any) => v?.family?.name ?? '' },
  { key: 'patrol', label: 'Ruta', format: (v: any) => v?.route?.name ?? '' },
  {
    key: 'patrol',
    label: 'Inicio de Ronda',
    format: (v: any) =>
      v?.scheduledStart
        ? new Date(v.scheduledStart).toLocaleString('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—',
  },
  { key: 'checkpoint', label: 'Checkpoint', format: (v: any) => v?.name ?? '' },
  { key: 'checkpoint', label: 'Ubicación', format: (v: any) => v?.location ?? '' },

  // ── Clasificación ─────────────────────────────────────────────────────────
  { key: 'severity', label: 'Severidad', format: (v: string) => INCIDENT_SEVERITY_LABELS[v] ?? v },
  { key: 'status', label: 'Estado', format: (v: string) => INCIDENT_STATUS_LABELS[v] ?? v },
  { key: 'description', label: 'Descripción' },

  // ── Tiempos de cierre ─────────────────────────────────────────────────────
  {
    key: 'resolvedAt',
    label: 'Fecha de Resolución / Escalado',
    format: (v: any) =>
      v
        ? new Date(v).toLocaleString('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—',
  },
  {
    // Tiempo de atención = resolvedAt - createdAt en minutos
    key: 'createdAt',
    label: 'Tiempo de Atención (min)',
    format: (_v: any, row: any) => {
      if (!row?.resolvedAt) return '—'
      const diff = Math.round(
        (new Date(row.resolvedAt).getTime() - new Date(row.createdAt).getTime()) / 60000
      )
      return diff >= 0 ? String(diff) : '—'
    },
  },
  { key: 'resolvedBy', label: 'Resuelto / Escalado por', format: (v: any) => v?.name ?? '—' },

  // ── Escalado a ticket ─────────────────────────────────────────────────────
  {
    key: 'ticket',
    label: 'N° Ticket',
    format: (v: any) => (v?.ticketCode ? `#${v.ticketCode}` : '—'),
  },
  {
    key: 'ticket',
    label: 'Estado del Ticket',
    format: (v: any) => {
      if (!v?.status) return '—'
      const labels: Record<string, string> = {
        OPEN: 'Abierto',
        IN_PROGRESS: 'En Progreso',
        RESOLVED: 'Resuelto',
        CLOSED: 'Cerrado',
        WAITING: 'En Espera',
      }
      return labels[v.status] ?? v.status
    },
  },
]

// ── PDF profesional de novedades ──────────────────────────────────────────────

/**
 * Genera un PDF de novedades de rondas con diseño profesional:
 * colores de severidad, badges de estado, sección por área, y resumen ejecutivo.
 * Incluye todos los timestamps disponibles: reporte, inicio de ronda, resolución/escalado,
 * tiempo de atención calculado, y datos del ticket escalado.
 * Llamar solo en cliente (usa window.open).
 */
export function exportIncidentsToPDF(
  incidents: any[],
  subtitle: string,
  filters: {
    familyName?: string
    agentName?: string
    dateFrom?: string
    dateTo?: string
  } = {}
): void {
  const date = new Date().toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const SEV_COLOR: Record<string, string> = {
    CRITICAL: '#dc2626',
    HIGH: '#ea580c',
    MEDIUM: '#d97706',
    LOW: '#16a34a',
  }
  const SEV_BG: Record<string, string> = {
    CRITICAL: '#fef2f2',
    HIGH: '#fff7ed',
    MEDIUM: '#fffbeb',
    LOW: '#f0fdf4',
  }
  const STATUS_COLOR: Record<string, string> = {
    OPEN: '#2563eb',
    RESOLVED: '#16a34a',
    ESCALATED: '#7c3aed',
  }
  const STATUS_BG: Record<string, string> = {
    OPEN: '#eff6ff',
    RESOLVED: '#f0fdf4',
    ESCALATED: '#f5f3ff',
  }
  const TICKET_STATUS_COLOR: Record<string, string> = {
    OPEN: '#2563eb',
    IN_PROGRESS: '#d97706',
    RESOLVED: '#16a34a',
    CLOSED: '#6b7280',
  }
  const TICKET_STATUS_BG: Record<string, string> = {
    OPEN: '#eff6ff',
    IN_PROGRESS: '#fffbeb',
    RESOLVED: '#f0fdf4',
    CLOSED: '#f9fafb',
  }
  const TICKET_STATUS_LABELS: Record<string, string> = {
    OPEN: 'Abierto',
    IN_PROGRESS: 'En Progreso',
    RESOLVED: 'Resuelto',
    CLOSED: 'Cerrado',
  }

  // Resumen ejecutivo
  const total = incidents.length
  const open = incidents.filter(i => i.status === 'OPEN').length
  const resolved = incidents.filter(i => i.status === 'RESOLVED').length
  const escalated = incidents.filter(i => i.status === 'ESCALATED').length
  const critical = incidents.filter(i => i.severity === 'CRITICAL').length
  const high = incidents.filter(i => i.severity === 'HIGH').length

  // Tiempo promedio de atención (solo novedades resueltas/escaladas)
  const closed = incidents.filter(i => i.resolvedAt)
  const avgMinutes =
    closed.length > 0
      ? Math.round(
          closed.reduce((acc, i) => {
            return (
              acc + (new Date(i.resolvedAt).getTime() - new Date(i.createdAt).getTime()) / 60000
            )
          }, 0) / closed.length
        )
      : null

  const formatTs = (v: any) =>
    v
      ? new Date(v).toLocaleString('es-EC', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'

  const esc = (s: any) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const badge = (text: string, color: string, bg: string) =>
    `<span style="display:inline-block;padding:1px 7px;border-radius:10px;font-size:9px;font-weight:600;color:${color};background:${bg};border:1px solid ${color}30;">${esc(text)}</span>`

  const sevLabel: Record<string, string> = {
    CRITICAL: 'Crítica',
    HIGH: 'Alta',
    MEDIUM: 'Media',
    LOW: 'Baja',
  }
  const stLabel: Record<string, string> = {
    OPEN: 'Abierta',
    RESOLVED: 'Resuelta',
    ESCALATED: 'Escalada',
  }

  const tableRows = incidents
    .map((inc, idx) => {
      const attMin = inc.resolvedAt
        ? Math.round(
            (new Date(inc.resolvedAt).getTime() - new Date(inc.createdAt).getTime()) / 60000
          )
        : null
      const attStr =
        attMin !== null
          ? attMin < 60
            ? `${attMin} min`
            : `${Math.floor(attMin / 60)}h ${attMin % 60}min`
          : '—'

      const ticketBadge = inc.ticket?.ticketCode
        ? `<span style="font-family:monospace;font-size:9px;font-weight:600;background:#f3f4f6;padding:1px 5px;border-radius:4px;">#${esc(inc.ticket.ticketCode)}</span>` +
          (inc.ticket.status
            ? ` ${badge(TICKET_STATUS_LABELS[inc.ticket.status] ?? inc.ticket.status, TICKET_STATUS_COLOR[inc.ticket.status] ?? '#111', TICKET_STATUS_BG[inc.ticket.status] ?? '#f3f4f6')}`
            : '')
        : '—'

      return `
    <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
      <td style="font-size:9px;color:#374151;white-space:nowrap;">${formatTs(inc.createdAt)}</td>
      <td><strong style="font-size:10px;">${esc(inc.agent?.name ?? '—')}</strong></td>
      <td style="font-size:9px;">${esc(inc.patrol?.family?.name ?? '—')}</td>
      <td style="font-size:9px;">${esc(inc.patrol?.route?.name ?? '—')}</td>
      <td style="font-size:9px;color:#6b7280;white-space:nowrap;">${formatTs(inc.patrol?.scheduledStart)}</td>
      <td>${esc(inc.checkpoint?.name ?? '—')}</td>
      <td style="font-size:9px;color:#6b7280;">${esc(inc.checkpoint?.location ?? '—')}</td>
      <td>${badge(sevLabel[inc.severity] ?? inc.severity, SEV_COLOR[inc.severity] ?? '#111', SEV_BG[inc.severity] ?? '#f3f4f6')}</td>
      <td>${badge(stLabel[inc.status] ?? inc.status, STATUS_COLOR[inc.status] ?? '#111', STATUS_BG[inc.status] ?? '#f3f4f6')}</td>
      <td style="max-width:180px;word-break:break-word;font-size:9px;">${esc(inc.description)}</td>
      <td style="font-size:9px;color:#374151;white-space:nowrap;">${formatTs(inc.resolvedAt)}</td>
      <td style="font-size:9px;text-align:center;font-weight:600;color:${attMin !== null && attMin > 60 ? '#dc2626' : attMin !== null ? '#16a34a' : '#9ca3af'};">${attStr}</td>
      <td style="font-size:9px;">${esc(inc.resolvedBy?.name ?? '—')}</td>
      <td>${ticketBadge}</td>
    </tr>`
    })
    .join('')

  const activeFilters = [
    filters.familyName ? `Área: <strong>${esc(filters.familyName)}</strong>` : '',
    filters.agentName ? `Agente: <strong>${esc(filters.agentName)}</strong>` : '',
    filters.dateFrom ? `Desde: <strong>${esc(filters.dateFrom)}</strong>` : '',
    filters.dateTo ? `Hasta: <strong>${esc(filters.dateTo)}</strong>` : '',
  ]
    .filter(Boolean)
    .join(' &nbsp;·&nbsp; ')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Novedades de Rondas</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 10px; color: #111827; padding: 28px; background: #fff; }
    .report-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 3px solid #f59e0b; }
    .report-header h1 { font-size: 20px; font-weight: 800; color: #111827; }
    .report-header .subtitle { font-size: 11px; color: #6b7280; margin-top: 3px; }
    .report-header .meta { text-align: right; font-size: 10px; color: #9ca3af; }
    .filters-bar { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 6px 12px; font-size: 10px; color: #92400e; margin-bottom: 14px; }
    .summary { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 18px; }
    .summary-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 6px; text-align: center; }
    .summary-card .val { font-size: 20px; font-weight: 800; line-height: 1; }
    .summary-card .lbl { font-size: 8px; color: #6b7280; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.04em; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    thead tr { background: #1f2937; }
    th { text-align: left; padding: 7px 7px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #f9fafb; white-space: nowrap; }
    td { padding: 5px 7px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
    .footer { margin-top: 18px; font-size: 9px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    @media print {
      body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 1cm; size: A4 landscape; }
      thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div>
      <h1>Novedades de Rondas</h1>
      <div class="subtitle">${esc(subtitle)}</div>
    </div>
    <div class="meta">
      <div>Generado el ${date}</div>
      <div style="margin-top:4px;font-size:11px;font-weight:700;">${total} novedad${total !== 1 ? 'es' : ''}</div>
    </div>
  </div>

  ${activeFilters ? `<div class="filters-bar">🔍 Filtros activos: ${activeFilters}</div>` : ''}

  <div class="summary">
    <div class="summary-card">
      <div class="val">${total}</div>
      <div class="lbl">Total</div>
    </div>
    <div class="summary-card" style="border-color:#bfdbfe;">
      <div class="val" style="color:#1d4ed8;">${open}</div>
      <div class="lbl">Abiertas</div>
    </div>
    <div class="summary-card" style="border-color:#bbf7d0;">
      <div class="val" style="color:#15803d;">${resolved}</div>
      <div class="lbl">Resueltas</div>
    </div>
    <div class="summary-card" style="border-color:#ddd6fe;">
      <div class="val" style="color:#6d28d9;">${escalated}</div>
      <div class="lbl">Escaladas</div>
    </div>
    <div class="summary-card" style="border-color:#fecaca;">
      <div class="val" style="color:#dc2626;">${critical}</div>
      <div class="lbl">Críticas</div>
    </div>
    <div class="summary-card" style="border-color:#fed7aa;">
      <div class="val" style="color:#c2410c;">${high}</div>
      <div class="lbl">Altas</div>
    </div>
    <div class="summary-card" style="border-color:#e5e7eb;">
      <div class="val" style="color:#374151;">${avgMinutes !== null ? (avgMinutes < 60 ? `${avgMinutes}m` : `${Math.floor(avgMinutes / 60)}h${avgMinutes % 60}m`) : '—'}</div>
      <div class="lbl">Prom. Atención</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Fecha Reporte</th>
        <th>Agente</th>
        <th>Área</th>
        <th>Ruta</th>
        <th>Inicio Ronda</th>
        <th>Checkpoint</th>
        <th>Ubicación</th>
        <th>Severidad</th>
        <th>Estado</th>
        <th>Descripción</th>
        <th>Fecha Resolución/Escalado</th>
        <th>T. Atención</th>
        <th>Resuelto por</th>
        <th>Ticket</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="footer">Sistema de Tickets — Novedades de Rondas — ${date}</div>
  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }</script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1300,height=800')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
