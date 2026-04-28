/**
 * Formatting utilities for Reports module
 */

export function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function priorityLabel(p: string): string {
  const map: Record<string, string> = {
    LOW: 'Baja',
    MEDIUM: 'Media',
    HIGH: 'Alta',
    URGENT: 'Urgente',
  }
  return map[p] ?? p
}

export function priorityColor(p: string): string {
  const map: Record<string, string> = {
    LOW: 'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300',
    MEDIUM: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    HIGH: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
    URGENT: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  }
  return map[p] ?? 'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300'
}

export function slaColor(rate: number): string {
  if (rate >= 90) return 'text-emerald-600 dark:text-emerald-400'
  if (rate >= 70) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export function getTabLabel(tab: string, granularity?: string): string {
  const labels: Record<string, string> = {
    executive: 'Resumen Ejecutivo',
    technicians: 'Rendimiento de Técnicos',
    trends: `Tendencias Temporales${granularity ? ` (${granularity === 'day' ? 'Diario' : granularity === 'week' ? 'Semanal' : 'Mensual'})` : ''}`,
    sla: 'Cumplimiento de SLA',
    satisfaction: 'Satisfacción del Cliente',
  }
  return labels[tab] ?? tab
}
