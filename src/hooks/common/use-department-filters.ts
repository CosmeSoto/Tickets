/**
 * Hook unificado para filtros de departamentos
 * Centraliza toda la lógica de filtrado para evitar duplicación
 */

import { useState, useCallback, useMemo } from 'react'
import { useDebounce } from '@/hooks/common/use-debounce'
import type { 
  DepartmentStatus,
  DepartmentViewMode
} from '@/lib/constants/department-constants'

// ============================================================================
// INTERFACES PARA FILTROS DE DEPARTAMENTOS
// ============================================================================

export interface DepartmentFilters {
  search: string
  status: DepartmentStatus
  viewMode: DepartmentViewMode
}

// ============================================================================
// OPCIONES DE CONFIGURACIÓN
// ============================================================================

export interface UseDepartmentFiltersOptions {
  debounceMs?: number
  onFiltersChange?: (filters: DepartmentFilters) => void
}

// ============================================================================
// TIPOS DE RETORNO
// ============================================================================

export interface UseDepartmentFiltersReturn {
  filters: DepartmentFilters
  debouncedFilters: DepartmentFilters
  setFilter: <K extends keyof DepartmentFilters>(key: K, value: DepartmentFilters[K]) => void
  clearFilters: () => void
  clearFilter: (key: keyof DepartmentFilters) => void
  activeFiltersCount: number
  hasActiveFilters: boolean
  isSearchActive: boolean
}

// ============================================================================
// VALORES POR DEFECTO
// ============================================================================

const DEFAULT_DEPARTMENT_FILTERS: DepartmentFilters = {
  search: '',
  status: 'all',
  viewMode: 'list'
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useDepartmentFilters(
  options: UseDepartmentFiltersOptions = {}
): UseDepartmentFiltersReturn {
  const { debounceMs = 300, onFiltersChange } = options
  
  const [filters, setFilters] = useState<DepartmentFilters>(DEFAULT_DEPARTMENT_FILTERS)
  
  // Debounce solo la búsqueda para mejor UX
  const debouncedSearch = useDebounce(filters.search, debounceMs)
  
  const debouncedFilters = useMemo(() => ({
    ...filters,
    search: debouncedSearch
  }), [filters, debouncedSearch])

  // Notificar cambios de filtros
  const handleFiltersChange = useCallback((newFilters: DepartmentFilters) => {
    onFiltersChange?.(newFilters)
  }, [onFiltersChange])

  // Función para establecer un filtro específico
  const setFilter = useCallback(<K extends keyof DepartmentFilters>(
    key: K, 
    value: DepartmentFilters[K]
  ) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value }
      handleFiltersChange(newFilters)
      return newFilters
    })
  }, [handleFiltersChange])

  // Función para limpiar todos los filtros
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_DEPARTMENT_FILTERS)
    handleFiltersChange(DEFAULT_DEPARTMENT_FILTERS)
  }, [handleFiltersChange])

  // Función para limpiar un filtro específico
  const clearFilter = useCallback((key: keyof DepartmentFilters) => {
    const defaultValue = DEFAULT_DEPARTMENT_FILTERS[key]
    setFilter(key, defaultValue)
  }, [setFilter])

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'viewMode') return false // No contar viewMode como filtro activo
      const defaultValue = DEFAULT_DEPARTMENT_FILTERS[key as keyof DepartmentFilters]
      return value !== defaultValue && value !== '' && value !== 'all'
    }).length
  }, [filters])

  // Verificar si hay filtros activos
  const hasActiveFilters = activeFiltersCount > 0
  const isSearchActive = filters.search.trim().length > 0

  return {
    filters,
    debouncedFilters,
    setFilter,
    clearFilters,
    clearFilter,
    activeFiltersCount,
    hasActiveFilters,
    isSearchActive
  }
}

// ============================================================================
// UTILIDADES PARA FILTRADO
// ============================================================================

/**
 * Aplica filtros de departamentos a un array de datos
 */
export function applyDepartmentFilters<T extends {
  name: string
  description?: string
  isActive: boolean
}>(
  data: T[],
  filters: DepartmentFilters
): T[] {
  return data.filter(item => {
    // Filtro de búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = 
        item.name.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower))
      
      if (!matchesSearch) return false
    }

    // Filtro de estado
    if (filters.status !== 'all') {
      const isActive = filters.status === 'active'
      if (item.isActive !== isActive) return false
    }

    return true
  })
}

/**
 * Obtiene badges de filtros activos para mostrar en la UI
 */
export function getActiveFilterBadges(
  filters: DepartmentFilters,
  onRemoveFilter: (key: keyof DepartmentFilters) => void
) {
  const badges = []
  
  if (filters.search) {
    badges.push({
      label: `Búsqueda: ${filters.search}`,
      onRemove: () => onRemoveFilter('search')
    })
  }
  
  if (filters.status !== 'all') {
    const statusLabels = {
      'active': 'Activos',
      'inactive': 'Inactivos'
    }
    badges.push({
      label: `Estado: ${statusLabels[filters.status as keyof typeof statusLabels] || filters.status}`,
      onRemove: () => onRemoveFilter('status')
    })
  }
  
  return badges
}