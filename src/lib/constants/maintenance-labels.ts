/**
 * Labels y colores de mantenimiento — compartidos entre la lista
 * (/inventory/maintenance) y el detalle (/inventory/maintenance/[id]), que
 * antes duplicaban el mismo mapa de estados cada uno por su lado, con
 * colores que solo contemplaban tema claro (mismo problema que ya se había
 * corregido en tickets — ver ticket-labels.ts, de donde sale esta misma
 * convención bg-*-100/dark:bg-*-900).
 */

export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Solicitado',
  SCHEDULED: 'Programado',
  ACCEPTED: 'Aceptado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
}

export const MAINTENANCE_STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  SCHEDULED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  ACCEPTED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  CANCELLED: 'bg-muted text-muted-foreground',
}

export const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  PREVENTIVE: 'Preventivo',
  CORRECTIVE: 'Correctivo',
}

/** Pasos del flujo, en orden, para la barra de progreso del detalle. */
export const MAINTENANCE_FLOW_STEPS: string[] = ['REQUESTED', 'SCHEDULED', 'ACCEPTED', 'COMPLETED']
