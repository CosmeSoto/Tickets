/**
 * Columnas de exportación para el módulo de Auditoría.
 * Usadas por useExport para generar CSV, Excel y PDF.
 */

import type { ExportColumn } from '@/lib/utils/export'
import { getActionLabel, getEntityLabel } from './audit-formatters'

const ROLES: Record<string, string> = {
  ADMIN: 'Administrador',
  TECHNICIAN: 'Técnico',
  CLIENT: 'Cliente',
}

export const AUDIT_EXPORT_COLUMNS: ExportColumn[] = [
  {
    key: 'fecha',
    header: 'Fecha',
    accessor: (row: any) => {
      const d = new Date(row.createdAt)
      return d.toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil' })
    },
  },
  {
    key: 'hora',
    header: 'Hora',
    accessor: (row: any) => {
      const d = new Date(row.createdAt)
      return d.toLocaleTimeString('es-EC', {
        timeZone: 'America/Guayaquil',
        hour: '2-digit',
        minute: '2-digit',
      })
    },
  },
  {
    key: 'action',
    header: 'Acción',
    accessor: (row: any) => getActionLabel(row.action),
  },
  {
    key: 'entityType',
    header: 'Módulo',
    accessor: (row: any) => getEntityLabel(row.entityType),
  },
  {
    key: 'usuario',
    header: 'Usuario',
    accessor: (row: any) => row.users?.name || 'Sistema',
  },
  {
    key: 'email',
    header: 'Email',
    accessor: (row: any) => row.users?.email || '',
  },
  {
    key: 'rol',
    header: 'Rol',
    accessor: (row: any) => ROLES[row.users?.role] || 'Sistema',
  },
  {
    key: 'descripcion',
    header: 'Descripción',
    accessor: (row: any) => {
      const d = row.details || {}
      if (d.ticketTitle) return `Ticket: ${d.ticketTitle}`
      if (d.userName && d.userEmail) return `Usuario: ${d.userName} (${d.userEmail})`
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
    },
  },
  {
    key: 'cambios',
    header: 'Cambios',
    accessor: (row: any) => {
      const d = row.details || {}
      if (d.changes && typeof d.changes === 'object') {
        return Object.entries(d.changes)
          .map(([, v]: [string, any]) => {
            const field = v.field || ''
            const old = v.old ?? '(vacío)'
            const nuevo = v.new ?? '(vacío)'
            return `${field}: ${old} → ${nuevo}`
          })
          .join(' | ')
      }
      if (d.oldValues && d.newValues) {
        return Object.keys(d.newValues)
          .filter((k: string) => d.oldValues[k] !== d.newValues[k])
          .map(
            (k: string) => `${k}: ${d.oldValues[k] ?? '(vacío)'} → ${d.newValues[k] ?? '(vacío)'}`
          )
          .join(' | ')
      }
      return ''
    },
  },
  {
    key: 'ip',
    header: 'IP',
    accessor: (row: any) => {
      const ip = row.ipAddress || row.details?.metadata?.ip
      return ip && ip !== 'Unknown' ? ip : ''
    },
  },
  {
    key: 'dispositivo',
    header: 'Dispositivo',
    accessor: (row: any) => {
      const ua = (row.userAgent || '').toLowerCase()
      if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'Móvil'
      if (ua.includes('tablet') || ua.includes('ipad')) return 'Tablet'
      if (ua.includes('mozilla') || ua.includes('chrome')) return 'Escritorio'
      return ''
    },
  },
]
