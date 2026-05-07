/**
 * Utilidades para solicitudes de activos
 * Funciones compartidas para manejo de estados, tipos, badges y exportación
 */

import { AssetRequestStatus, AssetType } from '@prisma/client'
import type { ExportColumn } from '@/lib/utils/export'

// ── Etiquetas en español ──────────────────────────────────────────────────────

export const ASSET_REQUEST_STATUS_LABELS: Record<AssetRequestStatus, string> = {
  PENDING: 'Pendiente',
  UNDER_REVIEW: 'En Revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  FULFILLED: 'Entregada',
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  EQUIPMENT: 'Equipo',
  LICENSE: 'Licencia',
  OTHER: 'Otro',
}

// ── Variantes de Badge para estados ───────────────────────────────────────────

/**
 * Tabla de variantes semánticas de Badge según el estado.
 * Usa SOLO variantes de shadcn Badge — NO colores hexadecimales hardcodeados.
 */
const STATUS_BADGE_VARIANTS: Record<
  AssetRequestStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  PENDING: {
    variant: 'secondary',
  },
  UNDER_REVIEW: {
    variant: 'outline',
    className: 'border-blue-500 text-blue-700 dark:text-blue-300',
  },
  APPROVED: {
    variant: 'default',
  },
  REJECTED: {
    variant: 'destructive',
  },
  FULFILLED: {
    variant: 'default',
    className: 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800',
  },
}

/**
 * Obtiene la variante y className del Badge para un estado de solicitud.
 * Usa variantes semánticas de shadcn Badge.
 */
export function getAssetRequestStatusBadgeVariant(status: AssetRequestStatus): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className?: string
} {
  return STATUS_BADGE_VARIANTS[status] || { variant: 'secondary' }
}

// ── Columnas de exportación ───────────────────────────────────────────────────

/**
 * Columnas de exportación para solicitudes de activos.
 * Usadas en CSV, Excel y PDF exports.
 */
export const ASSET_REQUEST_EXPORT_COLUMNS: ExportColumn[] = [
  {
    key: 'code',
    label: 'Código',
  },
  {
    key: 'assetType',
    label: 'Tipo de Activo',
    format: (v: AssetType) => ASSET_TYPE_LABELS[v] ?? v,
  },
  {
    key: 'description',
    label: 'Descripción',
  },
  {
    key: 'familyName',
    label: 'Familia',
  },
  {
    key: 'status',
    label: 'Estado',
    format: (v: AssetRequestStatus) => ASSET_REQUEST_STATUS_LABELS[v] ?? v,
  },
  {
    key: 'requesterName',
    label: 'Solicitante',
  },
  {
    key: 'quantity',
    label: 'Cantidad',
    format: (v: number) => v?.toString() ?? '1',
  },
  {
    key: 'createdAt',
    label: 'Fecha de Creación',
    format: (v: any) => (v ? new Date(v).toLocaleDateString('es-ES') : ''),
  },
  {
    key: 'updatedAt',
    label: 'Última Actualización',
    format: (v: any) => (v ? new Date(v).toLocaleDateString('es-ES') : ''),
  },
]

// ── Opciones para selects ─────────────────────────────────────────────────────

/**
 * Obtiene las opciones de estado para selects
 */
export const getAssetRequestStatusOptions = () => [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'UNDER_REVIEW', label: 'En Revisión' },
  { value: 'APPROVED', label: 'Aprobada' },
  { value: 'REJECTED', label: 'Rechazada' },
  { value: 'FULFILLED', label: 'Entregada' },
]

/**
 * Obtiene las opciones de tipo de activo para selects
 */
export const getAssetTypeOptions = () => [
  { value: 'EQUIPMENT', label: 'Equipo' },
  { value: 'LICENSE', label: 'Licencia' },
  { value: 'OTHER', label: 'Otro' },
]

// ── Helpers de formato ────────────────────────────────────────────────────────

/**
 * Formatea la fecha de necesidad de forma legible
 */
export const formatNeededByDate = (date: string | Date | null | undefined): string => {
  if (!date) return 'Sin fecha límite'

  const neededDate = new Date(date)
  const now = new Date()
  const diffTime = neededDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'Fecha vencida'
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Mañana'
  if (diffDays <= 7) return `En ${diffDays} días`

  return neededDate.toLocaleDateString('es-ES')
}

/**
 * Verifica si una solicitud está vencida (neededBy pasó y aún no está FULFILLED)
 */
export const isAssetRequestOverdue = (
  neededBy: string | Date | null | undefined,
  status: AssetRequestStatus
): boolean => {
  if (!neededBy || status === 'FULFILLED' || status === 'REJECTED') return false

  const neededDate = new Date(neededBy)
  const now = new Date()

  return neededDate < now
}

/**
 * Obtiene el color del icono según el tipo de activo
 */
export const getAssetTypeIconColor = (assetType: AssetType): string => {
  const colors: Record<AssetType, string> = {
    EQUIPMENT: 'text-blue-600 dark:text-blue-400',
    LICENSE: 'text-purple-600 dark:text-purple-400',
    OTHER: 'text-gray-600 dark:text-gray-400',
  }
  return colors[assetType] || 'text-muted-foreground'
}

/**
 * Obtiene el color del icono según el estado
 */
export const getAssetRequestStatusIconColor = (status: AssetRequestStatus): string => {
  const colors: Record<AssetRequestStatus, string> = {
    PENDING: 'text-yellow-600 dark:text-yellow-400',
    UNDER_REVIEW: 'text-blue-600 dark:text-blue-400',
    APPROVED: 'text-green-600 dark:text-green-400',
    REJECTED: 'text-red-600 dark:text-red-400',
    FULFILLED: 'text-emerald-600 dark:text-emerald-400',
  }
  return colors[status] || 'text-muted-foreground'
}
