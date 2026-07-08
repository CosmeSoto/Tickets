/**
 * Utilidades de colores para el módulo de inventario.
 * Mismo patrón que ticket-utils.ts:
 *   bg-X-100 text-X-800 dark:bg-X-900 dark:text-X-200
 */

// ── Estado de activos ─────────────────────────────────────────────────────

const ASSET_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ASSIGNED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  MAINTENANCE: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  DAMAGED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  RETIRED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  FOR_SALE: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  SOLD: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  EXPIRED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

const ASSET_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  MAINTENANCE: 'Mantenimiento',
  DAMAGED: 'Dañado',
  RETIRED: 'Retirado',
  FOR_SALE: 'En Venta',
  SOLD: 'Vendido',
  ACTIVE: 'Activo',
  EXPIRED: 'Expirado',
  PENDING: 'Pendiente',
  CANCELLED: 'Cancelado',
}

export function getAssetStatusColor(status: string): string {
  return (
    ASSET_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  )
}

export function getAssetStatusLabel(status: string): string {
  return ASSET_STATUS_LABELS[status] ?? status
}

// ── Colores de íconos de eventos del historial ────────────────────────────

const EVENT_ICON_COLORS: Record<string, string> = {
  CREATED: 'text-green-600 dark:text-green-400',
  UPDATED: 'text-blue-600 dark:text-blue-400',
  ASSIGNED: 'text-blue-600 dark:text-blue-400',
  RETURNED: 'text-amber-600 dark:text-amber-400',
  MAINTENANCE: 'text-amber-600 dark:text-amber-400',
  STATUS_CHANGE: 'text-red-600 dark:text-red-400',
  CONDITION_CHANGE: 'text-red-600 dark:text-red-400',
  FAMILY_TRANSFER: 'text-blue-600 dark:text-blue-400',
  DECOMMISSIONED: 'text-gray-600 dark:text-gray-400',
}

export function getEventIconColor(event: string): string {
  return EVENT_ICON_COLORS[event] ?? 'text-muted-foreground'
}

// ── Subtipos de activo ────────────────────────────────────────────────────

const SUBTYPE_CONFIG: Record<string, { label: string; className: string }> = {
  EQUIPMENT: {
    label: 'Equipo',
    className:
      'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800',
  },
  MRO: {
    label: 'Consumible',
    className:
      'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-800',
  },
  LICENSE: {
    label: 'Contrato/Licencia',
    className:
      'bg-green-100 text-green-800 border-green-200 hover:bg-green-100 dark:bg-green-900 dark:text-green-200 dark:border-green-800',
  },
}

export function getSubtypeConfig(subtype: string) {
  return (
    SUBTYPE_CONFIG[subtype] ?? {
      label: subtype,
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    }
  )
}

// ── Alerta de renovación ──────────────────────────────────────────────────

export function getRenewalAlertClass(isExpired: boolean): string {
  return isExpired
    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
}

// ── Condición del equipo (3 valores definitivos: NEW, USED, DAMAGED) ──────────

const ASSET_CONDITION_COLORS: Record<string, string> = {
  NEW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  USED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DAMAGED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const ASSET_CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  USED: 'Usado',
  DAMAGED: 'Dañado',
}

export function getAssetConditionColor(condition: string): string {
  return (
    ASSET_CONDITION_COLORS[condition] ??
    'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  )
}

export function getAssetConditionLabel(condition: string): string {
  return ASSET_CONDITION_LABELS[condition] ?? condition
}

// ── Tipo de propiedad ─────────────────────────────────────────────────────

const ACQUISITION_MODE_LABELS: Record<string, string> = {
  FIXED_ASSET: 'Activo Propio',
  RENTAL: 'Arrendamiento',
  LOAN: 'Activo de Tercero',
  LEASE: 'Arrendamiento Financiero',
}

/** Texto de ayuda corto para formularios (misma nomenclatura que Configuración → Inventario) */
export const ACQUISITION_MODE_HELP: Record<string, string> = {
  FIXED_ASSET: 'Compra directa — es propiedad de la empresa',
  RENTAL: 'Pago mensual al proveedor — el proveedor sigue siendo el dueño',
  LOAN: 'Préstamo sin costo — el propietario conserva la titularidad',
}

export function getAcquisitionModeLabel(mode: string): string {
  return ACQUISITION_MODE_LABELS[mode] ?? mode
}
