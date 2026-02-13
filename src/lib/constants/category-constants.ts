/**
 * Constantes centralizadas para el módulo de categorías
 * Evita duplicación y asegura consistencia visual
 */

import { FolderTree, Folder, Tag, LucideIcon } from 'lucide-react'

// ============================================================================
// NIVELES DE CATEGORÍAS
// ============================================================================

export const CATEGORY_LEVELS = {
  ALL: 'all',
  LEVEL_1: '1',
  LEVEL_2: '2', 
  LEVEL_3: '3',
  LEVEL_4: '4'
} as const

export type CategoryLevel = typeof CATEGORY_LEVELS[keyof typeof CATEGORY_LEVELS]

// ============================================================================
// OPCIONES DE FILTRO DE NIVEL
// ============================================================================

export const CATEGORY_LEVEL_FILTER_OPTIONS = [
  { value: CATEGORY_LEVELS.ALL, label: 'Todos los niveles' },
  { value: CATEGORY_LEVELS.LEVEL_1, label: 'Nivel 1 (Raíz)' },
  { value: CATEGORY_LEVELS.LEVEL_2, label: 'Nivel 2' },
  { value: CATEGORY_LEVELS.LEVEL_3, label: 'Nivel 3' },
  { value: CATEGORY_LEVELS.LEVEL_4, label: 'Nivel 4' }
] as const

export type CategoryLevelFilterOption = typeof CATEGORY_LEVEL_FILTER_OPTIONS[number]

// ============================================================================
// ESTADOS DE CATEGORÍAS
// ============================================================================

export const CATEGORY_STATUSES = {
  ALL: 'all',
  ACTIVE: 'true',
  INACTIVE: 'false'
} as const

export type CategoryStatus = typeof CATEGORY_STATUSES[keyof typeof CATEGORY_STATUSES]

export const CATEGORY_STATUS_FILTER_OPTIONS = [
  { value: CATEGORY_STATUSES.ALL, label: 'Todas' },
  { value: CATEGORY_STATUSES.ACTIVE, label: 'Activas' },
  { value: CATEGORY_STATUSES.INACTIVE, label: 'Inactivas' }
] as const

// ============================================================================
// MODOS DE VISTA
// ============================================================================

export const CATEGORY_VIEW_MODES = {
  TABLE: 'table',
  TREE: 'tree'
} as const

export type CategoryViewMode = typeof CATEGORY_VIEW_MODES[keyof typeof CATEGORY_VIEW_MODES]

// ============================================================================
// COLORES E ICONOS PARA NIVELES
// ============================================================================

export const CATEGORY_LEVEL_COLORS = {
  [CATEGORY_LEVELS.LEVEL_1]: 'bg-blue-500',
  [CATEGORY_LEVELS.LEVEL_2]: 'bg-green-500',
  [CATEGORY_LEVELS.LEVEL_3]: 'bg-yellow-500',
  [CATEGORY_LEVELS.LEVEL_4]: 'bg-red-500'
} as const

export const CATEGORY_LEVEL_ICONS: Record<string, LucideIcon> = {
  [CATEGORY_LEVELS.ALL]: FolderTree,
  [CATEGORY_LEVELS.LEVEL_1]: FolderTree,
  [CATEGORY_LEVELS.LEVEL_2]: Folder,
  [CATEGORY_LEVELS.LEVEL_3]: Tag,
  [CATEGORY_LEVELS.LEVEL_4]: Tag
} as const

// ============================================================================
// COLORES PARA ESTADOS
// ============================================================================

export const CATEGORY_STATUS_COLORS = {
  'true': 'bg-green-100 text-green-700 border-green-200',
  'false': 'bg-red-100 text-red-700 border-red-200'
} as const

// ============================================================================
// CAMPOS DE BÚSQUEDA
// ============================================================================

export const CATEGORY_SEARCH_FIELDS = [
  'name',
  'description',
  'parent.name'
] as const

// ============================================================================
// CONFIGURACIÓN DE ESTADÍSTICAS
// ============================================================================

export const CATEGORY_STATS_CONFIG = [
  {
    key: 'total',
    label: 'Total Categorías',
    icon: FolderTree,
    color: 'bg-blue-50 border-blue-200',
    textColor: 'text-blue-700'
  },
  {
    key: 'active',
    label: 'Activas',
    icon: FolderTree,
    color: 'bg-green-50 border-green-200',
    textColor: 'text-green-700'
  },
  {
    key: 'inactive',
    label: 'Inactivas',
    icon: Folder,
    color: 'bg-red-50 border-red-200',
    textColor: 'text-red-700'
  },
  {
    key: 'totalTickets',
    label: 'Tickets Asociados',
    icon: Tag,
    color: 'bg-purple-50 border-purple-200',
    textColor: 'text-purple-700'
  },
  {
    key: 'totalTechnicians',
    label: 'Técnicos Asignados',
    icon: FolderTree,
    color: 'bg-orange-50 border-orange-200',
    textColor: 'text-orange-700'
  }
] as const

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Obtiene el label de un nivel de categoría
 */
export function getCategoryLevelLabel(level: CategoryLevel): string {
  const option = CATEGORY_LEVEL_FILTER_OPTIONS.find(o => o.value === level)
  return option?.label || level
}

/**
 * Obtiene el color de un nivel de categoría
 */
export function getCategoryLevelColor(level: string): string {
  if (level in CATEGORY_LEVEL_COLORS) {
    return CATEGORY_LEVEL_COLORS[level as keyof typeof CATEGORY_LEVEL_COLORS]
  }
  return 'bg-gray-500'
}

/**
 * Obtiene el icono de un nivel de categoría
 */
export function getCategoryLevelIcon(level: string): LucideIcon {
  return CATEGORY_LEVEL_ICONS[level] || FolderTree
}

/**
 * Obtiene el color de un estado de categoría
 */
export function getCategoryStatusColor(status: CategoryStatus): string {
  if (status === 'true' || status === 'false') {
    return CATEGORY_STATUS_COLORS[status as 'true' | 'false']
  }
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

/**
 * Valida si un valor es un nivel de categoría válido
 */
export function isValidCategoryLevel(value: any): value is CategoryLevel {
  return Object.values(CATEGORY_LEVELS).includes(value)
}

/**
 * Valida si un valor es un estado de categoría válido
 */
export function isValidCategoryStatus(value: any): value is CategoryStatus {
  return Object.values(CATEGORY_STATUSES).includes(value)
}

/**
 * Valida si un valor es un modo de vista válido
 */
export function isValidCategoryViewMode(value: any): value is CategoryViewMode {
  return Object.values(CATEGORY_VIEW_MODES).includes(value)
}