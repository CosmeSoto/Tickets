/**
 * Configuración visual y filtros de tipos de notificación.
 * Alineado con el enum NotificationType de Prisma.
 */

import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Info,
  Package,
  Route,
  ArrowLeftRight,
  WifiOff,
} from 'lucide-react'

export type NotificationTypeId =
  | 'INFO'
  | 'SUCCESS'
  | 'WARNING'
  | 'ERROR'
  | 'INVENTORY'
  | 'TICKET_FAMILY_CHANGE'
  | 'PATROL_MISSED'
  | 'PATROL_INCOMPLETE'
  | 'PATROL_ASSIGNED'
  | 'OFFLINE_SYNC_REJECTED'

export interface NotificationTypeConfig {
  icon: LucideIcon
  borderColor: string
  bgColor: string
  textColor: string
  label: string
  /** Grupo de filtro en la UI del inbox */
  filterGroup: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR' | 'INVENTORY' | 'PATROL' | 'TICKET'
  /** Severidad visual (colores del dashboard/campana) */
  severity: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR'
}

export const TYPE_CONFIG: Record<string, NotificationTypeConfig> = {
  SUCCESS: {
    icon: CheckCircle,
    borderColor: 'border-l-emerald-500 dark:border-l-emerald-400',
    bgColor: 'bg-emerald-50/40 dark:bg-emerald-950/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    label: 'Éxito',
    filterGroup: 'SUCCESS',
    severity: 'SUCCESS',
  },
  INFO: {
    icon: Info,
    borderColor: 'border-l-blue-500 dark:border-l-blue-400',
    bgColor: 'bg-blue-50/40 dark:bg-blue-950/20',
    textColor: 'text-blue-600 dark:text-blue-400',
    label: 'Info',
    filterGroup: 'INFO',
    severity: 'INFO',
  },
  WARNING: {
    icon: Clock,
    borderColor: 'border-l-amber-500 dark:border-l-amber-400',
    bgColor: 'bg-amber-50/40 dark:bg-amber-950/20',
    textColor: 'text-amber-600 dark:text-amber-400',
    label: 'Atención',
    filterGroup: 'WARNING',
    severity: 'WARNING',
  },
  ERROR: {
    icon: AlertCircle,
    borderColor: 'border-l-red-500 dark:border-l-red-400',
    bgColor: 'bg-red-50/40 dark:bg-red-950/20',
    textColor: 'text-red-600 dark:text-red-400',
    label: 'Error',
    filterGroup: 'ERROR',
    severity: 'ERROR',
  },
  INVENTORY: {
    icon: Package,
    borderColor: 'border-l-violet-500 dark:border-l-violet-400',
    bgColor: 'bg-violet-50/40 dark:bg-violet-950/20',
    textColor: 'text-violet-600 dark:text-violet-400',
    label: 'Inventario',
    filterGroup: 'INVENTORY',
    severity: 'WARNING',
  },
  TICKET_FAMILY_CHANGE: {
    icon: ArrowLeftRight,
    borderColor: 'border-l-sky-500 dark:border-l-sky-400',
    bgColor: 'bg-sky-50/40 dark:bg-sky-950/20',
    textColor: 'text-sky-600 dark:text-sky-400',
    label: 'Familia',
    filterGroup: 'TICKET',
    severity: 'INFO',
  },
  PATROL_MISSED: {
    icon: Route,
    borderColor: 'border-l-red-500 dark:border-l-red-400',
    bgColor: 'bg-red-50/40 dark:bg-red-950/20',
    textColor: 'text-red-600 dark:text-red-400',
    label: 'Ronda omitida',
    filterGroup: 'PATROL',
    severity: 'ERROR',
  },
  PATROL_INCOMPLETE: {
    icon: Route,
    borderColor: 'border-l-amber-500 dark:border-l-amber-400',
    bgColor: 'bg-amber-50/40 dark:bg-amber-950/20',
    textColor: 'text-amber-600 dark:text-amber-400',
    label: 'Ronda incompleta',
    filterGroup: 'PATROL',
    severity: 'WARNING',
  },
  PATROL_ASSIGNED: {
    icon: Route,
    borderColor: 'border-l-teal-500 dark:border-l-teal-400',
    bgColor: 'bg-teal-50/40 dark:bg-teal-950/20',
    textColor: 'text-teal-600 dark:text-teal-400',
    label: 'Ronda asignada',
    filterGroup: 'PATROL',
    severity: 'INFO',
  },
  OFFLINE_SYNC_REJECTED: {
    icon: WifiOff,
    borderColor: 'border-l-orange-500 dark:border-l-orange-400',
    bgColor: 'bg-orange-50/40 dark:bg-orange-950/20',
    textColor: 'text-orange-600 dark:text-orange-400',
    label: 'Sync rechazado',
    filterGroup: 'PATROL',
    severity: 'WARNING',
  },
}

export const FILTER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'SUCCESS', label: 'Éxito' },
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Atención' },
  { value: 'ERROR', label: 'Error' },
  { value: 'INVENTORY', label: 'Inventario' },
  { value: 'PATROL', label: 'Rondas' },
  { value: 'TICKET', label: 'Tickets' },
]

export function getTypeConfig(type: string): NotificationTypeConfig {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.INFO
}

/** Coincide filtro de UI (incluye grupos PATROL / TICKET) con el tipo real. */
export function matchesTypeFilter(type: string, filterType: string): boolean {
  if (filterType === 'all') return true
  const cfg = getTypeConfig(type)
  if (filterType === 'PATROL' || filterType === 'TICKET' || filterType === 'INVENTORY') {
    return cfg.filterGroup === filterType
  }
  // Severidad clásica: solo el tipo exacto (PATROL_MISSED no aparece en "Error")
  if (['SUCCESS', 'INFO', 'WARNING', 'ERROR'].includes(filterType)) {
    return type === filterType
  }
  return type === filterType || cfg.filterGroup === filterType
}

export type DashboardRole = 'ADMIN' | 'TECHNICIAN' | 'CLIENT'

/**
 * Relevancia de una notificación para la tira del dashboard según rol.
 * Prioriza alertas operativas; deja fuera ruido genérico ya leído.
 */
export function isRelevantForDashboard(
  notification: {
    type: string
    isRead: boolean
    ticketId?: string | null
    metadata?: Record<string, any>
  },
  role: DashboardRole
): boolean {
  const type = notification.type
  const cfg = getTypeConfig(type)

  // Dashboard: priorizar no leídas; leídas solo si son críticas recientes (se filtra afuera)
  if (role === 'ADMIN') {
    if (cfg.severity === 'ERROR' || cfg.severity === 'WARNING') return true
    if (cfg.filterGroup === 'INVENTORY' || cfg.filterGroup === 'PATROL') return true
    if (type === 'TICKET_FAMILY_CHANGE') return true
    if (!notification.isRead) return true
    return false
  }

  if (role === 'TECHNICIAN') {
    if (cfg.filterGroup === 'PATROL') return true
    if (cfg.severity === 'ERROR' || cfg.severity === 'WARNING') return true
    if (notification.ticketId || notification.metadata?.ticketId) return true
    if (!notification.isRead) return true
    return false
  }

  // CLIENT
  if (notification.ticketId || notification.metadata?.ticketId) return true
  if (cfg.severity === 'SUCCESS' || cfg.severity === 'WARNING' || cfg.severity === 'ERROR')
    return true
  if (!notification.isRead) return true
  return false
}

/** Orden de prioridad para la tira del dashboard (mayor = más arriba). */
export function dashboardPriority(
  notification: { type: string; isRead: boolean; createdAt: string | Date },
  role: DashboardRole
): number {
  const cfg = getTypeConfig(notification.type)
  let score = 0
  if (!notification.isRead) score += 100
  if (cfg.severity === 'ERROR') score += 50
  else if (cfg.severity === 'WARNING') score += 30
  else if (cfg.severity === 'SUCCESS') score += 10

  if (role === 'ADMIN') {
    if (cfg.filterGroup === 'PATROL' || cfg.filterGroup === 'INVENTORY') score += 20
  }
  if (role === 'TECHNICIAN' && cfg.filterGroup === 'PATROL') score += 25
  if (role === 'CLIENT' && notification.type === 'SUCCESS') score += 15

  // Más recientes ligeramente por encima dentro del mismo bucket
  const ageMs = Date.now() - new Date(notification.createdAt).getTime()
  score += Math.max(0, 10 - ageMs / (1000 * 60 * 60 * 6)) // -1 cada 6h aprox

  return score
}
