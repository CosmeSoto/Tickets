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
 * Incluye agente, resuelto por, y datos completos para informes de gestión.
 */
export const PATROL_INCIDENTS_ADMIN_EXPORT_COLUMNS: ExportColumn[] = [
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
  { key: 'patrol', label: 'Ruta', format: (v: any) => v?.route?.name ?? '' },
  { key: 'checkpoint', label: 'Checkpoint', format: (v: any) => v?.name ?? '' },
  { key: 'checkpoint', label: 'Ubicación', format: (v: any) => v?.location ?? '' },
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
  { key: 'resolvedBy', label: 'Resuelto por', format: (v: any) => v?.name ?? '—' },
  {
    key: 'ticket',
    label: 'Ticket Escalado',
    format: (v: any) => (v?.ticketCode ? `#${v.ticketCode} (${v.status})` : '—'),
  },
]
