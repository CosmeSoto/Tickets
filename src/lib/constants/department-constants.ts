/**
 * Constantes centralizadas para el módulo de departamentos
 * Evita duplicación y asegura consistencia visual
 */

import { Building, Users, FolderTree, LucideIcon } from 'lucide-react'

// ============================================================================
// ESTADOS DE DEPARTAMENTOS
// ============================================================================

export const DEPARTMENT_STATUSES = {
  ALL: 'all',
  ACTIVE: 'active',
  INACTIVE: 'inactive'
} as const

export type DepartmentStatus = typeof DEPARTMENT_STATUSES[keyof typeof DEPARTMENT_STATUSES]

// ============================================================================
// OPCIONES DE FILTRO DE ESTADO
// ============================================================================

export const DEPARTMENT_STATUS_FILTER_OPTIONS = [
  { value: DEPARTMENT_STATUSES.ALL, label: 'Todos los estados' },
  { value: DEPARTMENT_STATUSES.ACTIVE, label: 'Solo activos' },
  { value: DEPARTMENT_STATUSES.INACTIVE, label: 'Solo inactivos' }
] as const

export type DepartmentStatusFilterOption = typeof DEPARTMENT_STATUS_FILTER_OPTIONS[number]

// ============================================================================
// MODOS DE VISTA
// ============================================================================

export const DEPARTMENT_VIEW_MODES = {
  LIST: 'list',
  TABLE: 'table',
  CARDS: 'cards'
} as const

export type DepartmentViewMode = typeof DEPARTMENT_VIEW_MODES[keyof typeof DEPARTMENT_VIEW_MODES]

// ============================================================================
// COLORES PARA ESTADOS
// ============================================================================

export const DEPARTMENT_STATUS_COLORS = {
  'active': 'bg-green-100 text-green-700 border-green-200',
  'inactive': 'bg-red-100 text-red-700 border-red-200'
} as const

// ============================================================================
// ICONOS PARA DEPARTAMENTOS
// ============================================================================

export const DEPARTMENT_ICONS = {
  MAIN: Building,
  USERS: Users,
  CATEGORIES: FolderTree
} as const

// ============================================================================
// CAMPOS DE BÚSQUEDA
// ============================================================================

export const DEPARTMENT_SEARCH_FIELDS = [
  'name',
  'description'
] as const

// ============================================================================
// CONFIGURACIÓN DE ESTADÍSTICAS
// ============================================================================

export const DEPARTMENT_STATS_CONFIG = [
  {
    key: 'total',
    label: 'Total Departamentos',
    icon: Building,
    color: 'bg-blue-50 border-blue-200',
    textColor: 'text-blue-700'
  },
  {
    key: 'active',
    label: 'Activos',
    icon: Building,
    color: 'bg-green-50 border-green-200',
    textColor: 'text-green-700'
  },
  {
    key: 'inactive',
    label: 'Inactivos',
    icon: Building,
    color: 'bg-red-50 border-red-200',
    textColor: 'text-red-700'
  },
  {
    key: 'totalUsers',
    label: 'Técnicos Asignados',
    icon: Users,
    color: 'bg-purple-50 border-purple-200',
    textColor: 'text-purple-700'
  },
  {
    key: 'totalCategories',
    label: 'Categorías Asociadas',
    icon: FolderTree,
    color: 'bg-orange-50 border-orange-200',
    textColor: 'text-orange-700'
  }
] as const

// ============================================================================
// COLORES POR DEFECTO PARA DEPARTAMENTOS
// ============================================================================

export const DEPARTMENT_DEFAULT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280'  // Gray
] as const

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Obtiene el label de un estado de departamento
 */
export function getDepartmentStatusLabel(status: DepartmentStatus): string {
  const option = DEPARTMENT_STATUS_FILTER_OPTIONS.find(o => o.value === status)
  return option?.label || status
}

/**
 * Obtiene el color de un estado de departamento
 */
export function getDepartmentStatusColor(status: DepartmentStatus): string {
  if (status === 'active' || status === 'inactive') {
    return DEPARTMENT_STATUS_COLORS[status as 'active' | 'inactive']
  }
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

/**
 * Obtiene un color aleatorio para un nuevo departamento
 */
export function getRandomDepartmentColor(): string {
  return DEPARTMENT_DEFAULT_COLORS[Math.floor(Math.random() * DEPARTMENT_DEFAULT_COLORS.length)]
}

/**
 * Valida si un valor es un estado de departamento válido
 */
export function isValidDepartmentStatus(value: any): value is DepartmentStatus {
  return Object.values(DEPARTMENT_STATUSES).includes(value)
}

/**
 * Valida si un valor es un modo de vista válido
 */
export function isValidDepartmentViewMode(value: any): value is DepartmentViewMode {
  return Object.values(DEPARTMENT_VIEW_MODES).includes(value)
}

/**
 * Obtiene el siguiente orden disponible para un nuevo departamento
 */
export function getNextDepartmentOrder(departments: Array<{ order: number }>): number {
  if (departments.length === 0) return 0
  return Math.max(...departments.map(d => d.order)) + 1
}