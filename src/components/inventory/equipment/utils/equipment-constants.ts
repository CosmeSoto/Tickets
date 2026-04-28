/**
 * Constants and labels for Equipment module
 * All with dark mode support
 */

export const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  MAINTENANCE: 'Mantenimiento',
  DAMAGED: 'Dañado',
  RETIRED: 'Retirado',
}

export const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-emerald-500 dark:bg-emerald-600',
  ASSIGNED: 'bg-blue-500 dark:bg-blue-600',
  MAINTENANCE: 'bg-amber-500 dark:bg-amber-600',
  DAMAGED: 'bg-red-500 dark:bg-red-600',
  RETIRED: 'bg-muted-foreground',
}

export const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como Nuevo',
  GOOD: 'Bueno',
  FAIR: 'Regular',
  POOR: 'Malo',
}

export const TYPE_LABELS: Record<string, string> = {
  LAPTOP: 'Laptop',
  DESKTOP: 'Desktop',
  MONITOR: 'Monitor',
  PRINTER: 'Impresora',
  PHONE: 'Teléfono',
  TABLET: 'Tablet',
  KEYBOARD: 'Teclado',
  MOUSE: 'Mouse',
  HEADSET: 'Audífonos',
  WEBCAM: 'Webcam',
  DOCKING_STATION: 'Docking Station',
  UPS: 'UPS',
  ROUTER: 'Router',
  SWITCH: 'Switch',
  OTHER: 'Otro',
}

export const OWNERSHIP_LABELS: Record<string, string> = {
  FIXED_ASSET: 'Activo Fijo',
  RENTAL: 'Alquiler',
  LOAN: 'Préstamo',
}

export const MAINTENANCE_STATUS_BADGE: Record<string, string> = {
  REQUESTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  SCHEDULED: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  ACCEPTED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  CANCELLED: 'bg-muted text-muted-foreground',
}

export const MAINTENANCE_STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Solicitado',
  SCHEDULED: 'Programado',
  ACCEPTED: 'Aceptado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
}

export const MAINTENANCE_TYPE_LABEL: Record<string, string> = {
  PREVENTIVE: 'Preventivo',
  CORRECTIVE: 'Correctivo',
}
