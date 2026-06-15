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
 * Genera un PDF de novedades de rondas.
 * Diseño: header con período y filtros activos + tabla completa con toda la información.
 * Sin tarjetas de resumen — el foco es que los datos de la tabla sean completos y legibles.
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

  // Colores de severidad
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
  const SEV_LABELS: Record<string, string> = {
    CRITICAL: 'Crítica',
    HIGH: 'Alta',
    MEDIUM: 'Media',
    LOW: 'Baja',
  }
  const ST_LABELS: Record<string, string> = {
    OPEN: 'Abierta',
    RESOLVED: 'Resuelta',
    ESCALATED: 'Escalada',
  }

  const total = incidents.length

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

  const tableRows = incidents
    .map((inc, idx) => {
      // Tiempo de atención desde reporte hasta resolución/escalado
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
      const attColor = attMin === null ? '#9ca3af' : attMin > 60 ? '#dc2626' : '#16a34a'

      // Ticket badge: código + estado del ticket
      const ticketCell = inc.ticket?.ticketCode
        ? `<span style="font-family:monospace;font-size:9px;font-weight:700;background:#f3f4f6;padding:2px 6px;border-radius:4px;">#${esc(inc.ticket.ticketCode)}</span>` +
          (inc.ticket.status
            ? `<br/>${badge(
                TICKET_STATUS_LABELS[inc.ticket.status] ?? inc.ticket.status,
                TICKET_STATUS_COLOR[inc.ticket.status] ?? '#111',
                TICKET_STATUS_BG[inc.ticket.status] ?? '#f3f4f6'
              )}`
            : '')
        : '—'

      return `<tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="white-space:nowrap;">${formatTs(inc.createdAt)}</td>
      <td><strong>${esc(inc.agent?.name ?? '—')}</strong></td>
      <td>${esc(inc.patrol?.family?.name ?? '—')}</td>
      <td>${esc(inc.patrol?.route?.name ?? '—')}</td>
      <td style="color:#6b7280;white-space:nowrap;">${formatTs(inc.patrol?.scheduledStart)}</td>
      <td><strong>${esc(inc.checkpoint?.name ?? '—')}</strong></td>
      <td style="color:#6b7280;">${esc(inc.checkpoint?.location ?? '—')}</td>
      <td>${badge(SEV_LABELS[inc.severity] ?? inc.severity, SEV_COLOR[inc.severity] ?? '#111', SEV_BG[inc.severity] ?? '#f3f4f6')}</td>
      <td>${badge(ST_LABELS[inc.status] ?? inc.status, STATUS_COLOR[inc.status] ?? '#111', STATUS_BG[inc.status] ?? '#f3f4f6')}</td>
      <td style="max-width:200px;word-break:break-word;">${esc(inc.description)}</td>
      <td style="white-space:nowrap;">${formatTs(inc.resolvedAt)}</td>
      <td style="text-align:center;font-weight:600;color:${attColor};">${attStr}</td>
      <td>${esc(inc.resolvedBy?.name ?? '—')}</td>
      <td>${ticketCell}</td>
    </tr>`
    })
    .join('')

  // Chips de filtros activos
  const filterChips = [
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
  <meta charset="UTF-8"/>
  <title>Novedades de Rondas</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 10px; color: #111827; padding: 24px; background: #fff;
    }
    /* Header */
    .header {
      display: flex; justify-content: space-between; align-items: flex-end;
      border-bottom: 3px solid #f59e0b; padding-bottom: 12px; margin-bottom: 12px;
    }
    .header h1 { font-size: 18px; font-weight: 800; color: #111827; }
    .header .sub { font-size: 10px; color: #6b7280; margin-top: 2px; }
    .header .right { text-align: right; font-size: 10px; color: #9ca3af; }
    .header .right strong { font-size: 12px; color: #374151; display: block; margin-bottom: 2px; }
    /* Filtros activos */
    .filters {
      background: #fffbeb; border: 1px solid #fde68a; border-radius: 5px;
      padding: 5px 10px; font-size: 9px; color: #92400e; margin-bottom: 12px;
    }
    /* Tabla */
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #1e293b; }
    th {
      text-align: left; padding: 7px 8px; font-size: 8.5px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.05em; color: #f1f5f9;
      white-space: nowrap; border-right: 1px solid #334155;
    }
    th:last-child { border-right: none; }
    td {
      padding: 5px 8px; border-bottom: 1px solid #f1f5f9;
      border-right: 1px solid #f1f5f9; vertical-align: middle;
    }
    td:last-child { border-right: none; }
    /* Footer */
    .footer {
      margin-top: 14px; font-size: 9px; color: #9ca3af;
      text-align: center; border-top: 1px solid #e5e7eb; padding-top: 8px;
    }
    @media print {
      body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 1cm; size: A4 landscape; }
      thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Novedades de Rondas</h1>
      <div class="sub">${esc(subtitle)}</div>
    </div>
    <div class="right">
      <strong>${total} novedad${total !== 1 ? 'es' : ''}</strong>
      Generado el ${date}
    </div>
  </div>

  ${filterChips ? `<div class="filters">🔍 Filtros: ${filterChips}</div>` : ''}

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
        <th>Fecha Res./Escalado</th>
        <th>T. Atención</th>
        <th>Resuelto por</th>
        <th>Ticket</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="footer">Sistema de Tickets — Novedades de Rondas — ${date}</div>
  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1300,height=800')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
