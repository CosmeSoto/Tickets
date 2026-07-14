/**
 * Utilidades de formato puras — seguras para importar en componentes cliente.
 * No importar prisma ni módulos Node-only aquí.
 */

export interface ReportSummaryItem {
  title: string
  value: string | number
  description: string
}

export interface ReportResponse<T = Record<string, unknown>> {
  summary: ReportSummaryItem[]
  data: T[]
  filters: Record<string, unknown>
  generatedAt: string
  totalCount: number
}

export const EQUIPMENT_STATUS_ES: Record<string, string> = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  MAINTENANCE: 'En mantenimiento',
  DAMAGED: 'Dañado',
  RETIRED: 'Dado de baja',
  LOST: 'Perdido',
  FOR_SALE: 'En venta',
  SOLD: 'Vendido',
}

export const CONSUMABLE_STATUS_ES: Record<string, string> = {
  ACTIVE: 'Activo',
  LOW_STOCK: 'Stock bajo',
  OUT_OF_STOCK: 'Sin stock',
  EXPIRED: 'Caducado',
  RETIRED: 'Dado de baja',
}

export const LICENSE_STATUS_ES: Record<string, string> = {
  ACTIVE: 'Activo',
  EXPIRING_SOON: 'Por vencer',
  EXPIRED: 'Vencido',
  INACTIVE: 'Inactivo',
}

export const MAINTENANCE_STATUS_ES: Record<string, string> = {
  REQUESTED: 'Solicitado',
  SCHEDULED: 'Programado',
  ACCEPTED: 'Aceptado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
}

export const DECOMMISSION_REASON_ES: Record<string, string> = {
  DAMAGED: 'Daño irreparable',
  OBSOLETE: 'Obsolescencia',
  LOST: 'Pérdida',
  STOLEN: 'Robo',
  END_OF_LIFE: 'Fin de vida útil',
  OTHER: 'Otro',
  EXPIRED: 'Caducado',
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(h => {
          const val = row[h]
          if (val == null) return ''
          const str = String(val)
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(',')
    ),
  ]
  return lines.join('\n')
}
