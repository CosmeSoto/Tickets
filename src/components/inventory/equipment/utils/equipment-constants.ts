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
  FOR_SALE: 'En venta',
  SOLD: 'Vendido',
}

export const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-emerald-500 dark:bg-emerald-600',
  ASSIGNED: 'bg-blue-500 dark:bg-blue-600',
  MAINTENANCE: 'bg-amber-500 dark:bg-amber-600',
  DAMAGED: 'bg-red-500 dark:bg-red-600',
  RETIRED: 'bg-muted-foreground',
  FOR_SALE: 'bg-amber-500 dark:bg-amber-600',
  SOLD: 'bg-muted-foreground',
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
  REQUESTED: 'bg-primary/10 text-primary border border-primary/30',
  SCHEDULED: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30',
  ACCEPTED: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border border-violet-500/30',
  COMPLETED:
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
  CANCELLED: 'bg-muted text-muted-foreground border border-border',
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
