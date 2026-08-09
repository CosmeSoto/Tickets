/**
 * Catálogo de columnas de auditoría (tabla + exportación).
 * LOPDP: por defecto minimiza PII; columnas sensibles requieren opt-in.
 */

import type { ExportColumn } from '@/lib/utils/export'
import type { TableColumnDef } from '@/components/common/table-columns-menu'
import { translateAction, translateEntityType } from '@/lib/services/audit-export-helpers'
import { getAppTimezone } from '@/lib/utils/date-utils'

const ROLES: Record<string, string> = {
  ADMIN: 'Administrador',
  TECHNICIAN: 'Técnico',
  CLIENT: 'Cliente',
}

export type AuditColumnKey =
  | 'fecha'
  | 'hora'
  | 'action'
  | 'entityType'
  | 'entityId'
  | 'usuario'
  | 'email'
  | 'rol'
  | 'descripcion'
  | 'cambios'
  | 'severity'
  | 'ip'
  | 'dispositivo'
  | 'navegador'
  | 'userAgent'
  | 'id'

export type AuditColumnMeta = TableColumnDef & {
  key: AuditColumnKey
  /** Contiene PII o detalle sensible (LOPDP) */
  sensitive?: boolean
  defaultVisible?: boolean
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email ? '***' : ''
  const [user, domain] = email.split('@')
  if (!user) return `***@${domain}`
  const keep = user.slice(0, Math.min(2, user.length))
  return `${keep}***@${domain}`
}

function maskIp(ip: string): string {
  if (!ip || ip === 'Unknown') return ''
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.***`
  if (ip.includes(':')) return `${ip.slice(0, 8)}…`
  return '***'
}

function redactChangesText(text: string): string {
  return text
    .replace(/(password|token|secret|authorization|api[_-]?key)\s*[:=]\s*[^\s|]+/gi, '$1: [REDACTADO]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, m => maskEmail(m))
}

function deviceLabel(ua: string): string {
  const u = (ua || '').toLowerCase()
  if (u.includes('mobile') || u.includes('android') || u.includes('iphone')) return 'Móvil'
  if (u.includes('tablet') || u.includes('ipad')) return 'Tablet'
  if (u.includes('mozilla') || u.includes('chrome') || u.includes('safari') || u.includes('firefox'))
    return 'Escritorio'
  return ua ? 'Otro' : ''
}

function browserLabel(ua: string): string {
  const u = (ua || '').toLowerCase()
  if (u.includes('edg/')) return 'Edge'
  if (u.includes('chrome')) return 'Chrome'
  if (u.includes('firefox')) return 'Firefox'
  if (u.includes('safari')) return 'Safari'
  return ''
}

function severityLabel(action: string): string {
  const a = (action || '').toLowerCase()
  if (a.includes('delete') || a.includes('role_changed') || a.includes('login_failed'))
    return 'Crítica'
  if (a.includes('update') || a.includes('export') || a.includes('backup')) return 'Alta'
  if (a.includes('create') || a.includes('login')) return 'Media'
  return 'Baja'
}

function buildDescription(row: any): string {
  const d = row.details || {}
  if (typeof d.descripcion === 'string' && d.descripcion.trim()) return d.descripcion
  if (d.ticketTitle) return `Ticket: ${d.ticketTitle}`
  if (d.userName && d.userEmail) return `Usuario: ${d.userName}`
  if (d.userName) return `Usuario: ${d.userName}`
  if (d.categoryName) return `Categoría: ${d.categoryName}`
  if (d.familyName) return `Familia: ${d.familyName}`
  if (d.targetUserName) return `Usuario: ${d.targetUserName}`
  if (d.changes && typeof d.changes === 'object') {
    const keys = Object.keys(d.changes)
    if (keys.length > 0) {
      return 'Cambió: ' + keys.map((k: string) => d.changes[k]?.field || k).join(', ')
    }
  }
  return ''
}

function buildChanges(row: any, maskPii: boolean): string {
  const d = row.details || {}
  let text = ''
  if (d.changes && typeof d.changes === 'object') {
    text = Object.entries(d.changes)
      .map(([, v]: [string, any]) => {
        const field = v.field || ''
        const old = v.old ?? '(vacío)'
        const nuevo = v.new ?? '(vacío)'
        return `${field}: ${old} → ${nuevo}`
      })
      .join(' | ')
  } else if (d.oldValues && d.newValues) {
    text = Object.keys(d.newValues)
      .filter((k: string) => d.oldValues[k] !== d.newValues[k])
      .map((k: string) => `${k}: ${d.oldValues[k] ?? '(vacío)'} → ${d.newValues[k] ?? '(vacío)'}`)
      .join(' | ')
  }
  return maskPii ? redactChangesText(text) : text
}

export type AuditAccessorOpts = { maskPii?: boolean }

export const AUDIT_COLUMN_CATALOG: AuditColumnMeta[] = [
  { key: 'fecha', label: 'Fecha', required: true, defaultVisible: true },
  { key: 'hora', label: 'Hora', required: true, defaultVisible: true },
  { key: 'action', label: 'Acción', required: true, defaultVisible: true },
  { key: 'entityType', label: 'Módulo', defaultVisible: true },
  { key: 'usuario', label: 'Usuario', defaultVisible: true },
  { key: 'rol', label: 'Rol', defaultVisible: true },
  { key: 'descripcion', label: 'Descripción', defaultVisible: true },
  { key: 'severity', label: 'Severidad', defaultVisible: false },
  { key: 'entityId', label: 'ID entidad', defaultVisible: false },
  { key: 'id', label: 'ID registro', defaultVisible: false },
  { key: 'dispositivo', label: 'Dispositivo', defaultVisible: false },
  { key: 'navegador', label: 'Navegador', defaultVisible: false },
  // Sensibles (LOPDP) — off por defecto
  { key: 'email', label: 'Email', sensitive: true, defaultVisible: false },
  { key: 'ip', label: 'Dirección IP', sensitive: true, defaultVisible: false },
  { key: 'cambios', label: 'Cambios (detalle)', sensitive: true, defaultVisible: false },
  { key: 'userAgent', label: 'User-Agent', sensitive: true, defaultVisible: false },
]

export const AUDIT_COLUMN_DEFS: TableColumnDef[] = AUDIT_COLUMN_CATALOG.map(
  ({ key, label, required }) => ({ key, label, required })
)

export const DEFAULT_AUDIT_COLUMN_ORDER = AUDIT_COLUMN_CATALOG.map(c => c.key)

/** Visibles por defecto: minimización LOPDP (sin email/IP/cambios/UA) */
export const DEFAULT_AUDIT_VISIBLE_COLUMNS = AUDIT_COLUMN_CATALOG.filter(c => c.defaultVisible).map(
  c => c.key
)

export const SENSITIVE_AUDIT_COLUMNS = AUDIT_COLUMN_CATALOG.filter(c => c.sensitive).map(c => c.key)

export function getAuditExportAccessor(
  key: AuditColumnKey,
  opts: AuditAccessorOpts = {}
): (row: any) => string {
  const maskPii = opts.maskPii !== false

  switch (key) {
    case 'fecha':
      return (row: any) =>
        new Date(row.createdAt).toLocaleDateString('es-EC', { timeZone: getAppTimezone() })
    case 'hora':
      return (row: any) =>
        new Date(row.createdAt).toLocaleTimeString('es-EC', {
          timeZone: getAppTimezone(),
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
    case 'action':
      return (row: any) => translateAction(row.action)
    case 'entityType':
      return (row: any) => translateEntityType(row.entityType)
    case 'entityId':
      return (row: any) => row.entityId || ''
    case 'usuario':
      return (row: any) => row.users?.name || row.userEmail || 'Sistema'
    case 'email':
      return (row: any) => {
        const email = row.users?.email || row.userEmail || ''
        return maskPii ? maskEmail(email) : email
      }
    case 'rol':
      return (row: any) => ROLES[row.users?.role] || (row.users ? '—' : 'Sistema')
    case 'descripcion':
      return (row: any) => {
        const desc = buildDescription(row)
        return maskPii ? redactChangesText(desc) : desc
      }
    case 'cambios':
      return (row: any) => buildChanges(row, maskPii)
    case 'severity':
      return (row: any) => severityLabel(row.action)
    case 'ip':
      return (row: any) => {
        const ip = row.ipAddress || row.details?.metadata?.ip || ''
        if (!ip || ip === 'Unknown') return ''
        return maskPii ? maskIp(String(ip)) : String(ip)
      }
    case 'dispositivo':
      return (row: any) => deviceLabel(row.userAgent || '')
    case 'navegador':
      return (row: any) => browserLabel(row.userAgent || '')
    case 'userAgent':
      return (row: any) => (maskPii ? '[OCULTO]' : row.userAgent || '')
    case 'id':
      return (row: any) => row.id || ''
    default:
      return () => ''
  }
}

/** Columnas ExportColumn para useExport / CSV servidor */
export function buildAuditExportColumns(
  keys: string[],
  opts: AuditAccessorOpts = {}
): ExportColumn[] {
  const byKey = new Map(AUDIT_COLUMN_CATALOG.map(c => [c.key, c]))
  return keys
    .map(key => {
      const meta = byKey.get(key as AuditColumnKey)
      if (!meta) return null
      return {
        key: meta.key,
        header: meta.label,
        accessor: getAuditExportAccessor(meta.key, opts),
      } satisfies ExportColumn
    })
    .filter((c): c is ExportColumn => c !== null)
}

/** Compat: todas las columnas (legacy imports) */
export const AUDIT_EXPORT_COLUMNS = buildAuditExportColumns(DEFAULT_AUDIT_COLUMN_ORDER, {
  maskPii: true,
})

export function resolveAuditExportKeys(
  requested: string[] | undefined,
  includeSensitive: boolean
): AuditColumnKey[] {
  const allowed = new Set(
    AUDIT_COLUMN_CATALOG.filter(c => includeSensitive || !c.sensitive).map(c => c.key)
  )
  const base =
    requested && requested.length > 0
      ? requested.filter((k): k is AuditColumnKey => allowed.has(k as AuditColumnKey))
      : DEFAULT_AUDIT_VISIBLE_COLUMNS.filter(k => allowed.has(k as AuditColumnKey))

  // Siempre incluir required
  const required = AUDIT_COLUMN_CATALOG.filter(c => c.required).map(c => c.key)
  return [...new Set([...required, ...base])] as AuditColumnKey[]
}

export function flattenAuditRows(
  logs: any[],
  keys: AuditColumnKey[],
  opts: AuditAccessorOpts = {}
): Record<string, string>[] {
  const accessors = keys.map(k => ({
    key: k,
    get: getAuditExportAccessor(k, opts),
  }))
  return logs.map(log => {
    const row: Record<string, string> = {}
    for (const a of accessors) row[a.key] = a.get(log) ?? ''
    return row
  })
}
