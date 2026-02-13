/**
 * Tipos compartidos para componentes de vistas y sistema de estandarización de UI
 * Consolidado de common.ts y views.ts - Fase 11.1.3
 */

import { ReactNode } from 'react'

// ============================================================================
// TIPOS DE VISTA
// ============================================================================

/**
 * Tipos de vista disponibles
 */
export type ViewType = 'table' | 'list' | 'cards' | 'tree'

/**
 * Modo de vista (para cambio entre tabla/tarjetas)
 */
export type ViewMode = 'table' | 'cards' | 'list'

/**
 * Header descriptivo para vistas
 */
export interface ViewHeader {
  title: string
  description?: string
  icon?: ReactNode
}

/**
 * Estado vacío personalizado
 */
export interface EmptyState {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
}

/**
 * Props base para todos los componentes de vista
 */
export interface BaseViewProps<T> {
  // Datos
  data: T[]
  loading?: boolean
  error?: string | null
  
  // Header
  header?: ViewHeader
  
  // Estados vacíos
  emptyState?: EmptyState
  
  // Paginación
  pagination?: PaginationConfig
  
  // Callbacks
  onRefresh?: () => void
}

// ============================================================================
// TIPOS DE PAGINACIÓN
// ============================================================================

/**
 * Configuración de paginación
 */
export interface PaginationConfig {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  options?: number[] // Default: [10, 20, 50, 100]
}

/**
 * Información de paginación (para display)
 */
export interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  startIndex: number
  endIndex: number
}

// ============================================================================
// TIPOS DE COLUMNAS Y TABLAS
// ============================================================================

/**
 * Configuración de columna para tablas
 */
export interface Column<T> {
  key: keyof T | string
  label: string
  render?: (item: T) => ReactNode
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  className?: string
}

/**
 * Configuración de columnas (alias para compatibilidad)
 */
export interface ColumnConfig<T> {
  id: string
  header: string
  accessor: keyof T | ((item: T) => ReactNode)
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  className?: string
}

/**
 * Configuración de ordenamiento
 */
export interface SortConfig<T> {
  key: keyof T | null
  direction: 'asc' | 'desc' | null
}

// ============================================================================
// TIPOS DE FILTROS
// ============================================================================

/**
 * Configuración de filtro
 */
export interface Filter {
  key: string
  label: string
  type: 'select' | 'input' | 'date'
  options?: { value: string; label: string }[]
  placeholder?: string
}

// ============================================================================
// TIPOS DE ESTADÍSTICAS
// ============================================================================

/**
 * Estadística para StatsBar
 */
export interface Stat {
  label: string
  value: number | string
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'red' | 'gray'
  icon?: ReactNode
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  onClick?: () => void
  tooltip?: string
}

// ============================================================================
// TIPOS DE ACCIONES
// ============================================================================

/**
 * Acción para ActionBar
 */
export interface Action {
  label: string
  icon?: ReactNode
  onClick: () => void
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  disabled?: boolean
  loading?: boolean
}

/**
 * Props para acciones de items
 */
export interface ItemActionsProps<T> {
  item: T
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  onView?: (item: T) => void
  canEdit?: boolean
  canDelete?: boolean
}

// ============================================================================
// TIPOS DE RENDERIZADO
// ============================================================================

/**
 * Props para renderizado de items
 */
export interface ItemRenderProps<T> {
  item: T
  index: number
}

/**
 * Configuración de grid para tarjetas
 */
export interface GridConfig {
  columns?: 1 | 2 | 3 | 4 | 5 | 6
  gap?: 2 | 3 | 4 | 6 | 8
}

// ============================================================================
// TIPOS DE SELECCIÓN
// ============================================================================

/**
 * Props para selección múltiple
 */
export interface SelectionProps<T> {
  selectable?: boolean
  selectedItems?: T[]
  onSelectionChange?: (selected: T[]) => void
  getItemId?: (item: T) => string
}

// ============================================================================
// TIPOS BASE
// ============================================================================

/**
 * Tipo base para entidades con ID
 */
export interface BaseEntity {
  id: string
  createdAt?: Date | string
  updatedAt?: Date | string
}

/**
 * Estado de carga
 */
export interface LoadingState {
  loading: boolean
  error: string | null
  success: boolean
}

/**
 * Respuesta de API estándar
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

/**
 * Configuración de módulo
 */
export interface ModuleConfig<T> {
  name: string
  endpoint: string
  defaultView?: ViewMode
  availableViews?: ViewMode[]
  pageSize?: number
  enableCache?: boolean
  cacheTTL?: number
}
