/**
 * Hook unificado para filtros de categorías
 * Centraliza toda la lógica de filtrado para evitar duplicación
 */

import { useState, useCallback, useMemo } from 'react'
import { useDebounce } from '@/hooks/common/use-debounce'
import type { 
  CategoryLevel, 
  CategoryStatus,
  CategoryViewMode
} from '@/lib/constants/category-constants'

// ============================================================================
// INTERFACES PARA FILTROS DE CATEGORÍAS
// ============================================================================

export interface CategoryFilters {
  search: string
  level: CategoryLevel
  status: CategoryStatus
  viewMode: CategoryViewMode
}

// ============================================================================
// OPCIONES DE CONFIGURACIÓN
// ============================================================================

export interface UseCategoryFiltersOptions {
  debounceMs?: number
  onFiltersChange?: (filters: CategoryFilters) => void
}

// ============================================================================
// TIPOS DE RETORNO
// ============================================================================

export interface UseCategoryFiltersReturn {
  filters: CategoryFilters
  debouncedFilters: CategoryFilters
  setFilter: <K extends keyof CategoryFilters>(key: K, value: CategoryFilters[K]) => void
  clearFilters: () => void
  clearFilter: (key: keyof CategoryFilters) => void
  activeFiltersCount: number
  hasActiveFilters: boolean
  isSearchActive: boolean
}

// ============================================================================
// VALORES POR DEFECTO
// ============================================================================

const DEFAULT_CATEGORY_FILTERS: CategoryFilters = {
  search: '',
  level: 'all',
  status: 'all',
  viewMode: 'table'
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useCategoryFilters(
  options: UseCategoryFiltersOptions = {}
): UseCategoryFiltersReturn {
  const { debounceMs = 300, onFiltersChange } = options
  
  const [filters, setFilters] = useState<CategoryFilters>(DEFAULT_CATEGORY_FILTERS)
  
  // Debounce solo la búsqueda para mejor UX
  const debouncedSearch = useDebounce(filters.search, debounceMs)
  
  const debouncedFilters = useMemo(() => ({
    ...filters,
    search: debouncedSearch
  }), [filters, debouncedSearch])

  // Notificar cambios de filtros
  const handleFiltersChange = useCallback((newFilters: CategoryFilters) => {
    onFiltersChange?.(newFilters)
  }, [onFiltersChange])

  // Función para establecer un filtro específico
  const setFilter = useCallback(<K extends keyof CategoryFilters>(
    key: K, 
    value: CategoryFilters[K]
  ) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value }
      handleFiltersChange(newFilters)
      return newFilters
    })
  }, [handleFiltersChange])

  // Función para limpiar todos los filtros
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_CATEGORY_FILTERS)
    handleFiltersChange(DEFAULT_CATEGORY_FILTERS)
  }, [handleFiltersChange])

  // Función para limpiar un filtro específico
  const clearFilter = useCallback((key: keyof CategoryFilters) => {
    const defaultValue = DEFAULT_CATEGORY_FILTERS[key]
    setFilter(key, defaultValue)
  }, [setFilter])

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'viewMode') return false // No contar viewMode como filtro activo
      const defaultValue = DEFAULT_CATEGORY_FILTERS[key as keyof CategoryFilters]
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
 * Aplica filtros de categorías a un array de datos
 */
export function applyCategoryFilters<T extends {
  name: string
  description?: string
  level: number
  isActive: boolean
  parent?: { name: string } | null
}>(
  data: T[],
  filters: CategoryFilters
): T[] {
  return data.filter(item => {
    // Filtro de búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = 
        item.name.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower)) ||
        (item.parent?.name.toLowerCase().includes(searchLower))
      
      if (!matchesSearch) return false
    }

    // Filtro de nivel
    if (filters.level !== 'all') {
      const levelNumber = parseInt(filters.level)
      if (item.level !== levelNumber) return false
    }

    // Filtro de estado
    if (filters.status !== 'all') {
      const isActive = filters.status === 'true'
      if (item.isActive !== isActive) return false
    }

    return true
  })
}

/**
 * Obtiene badges de filtros activos para mostrar en la UI
 */
export function getActiveFilterBadges(
  filters: CategoryFilters,
  onRemoveFilter: (key: keyof CategoryFilters) => void
) {
  const badges = []
  
  if (filters.search) {
    badges.push({
      label: `Búsqueda: ${filters.search}`,
      onRemove: () => onRemoveFilter('search')
    })
  }
  
  if (filters.level !== 'all') {
    const levelLabels = {
      '1': 'Nivel 1 (Raíz)',
      '2': 'Nivel 2',
      '3': 'Nivel 3',
      '4': 'Nivel 4'
    }
    badges.push({
      label: `Nivel: ${levelLabels[filters.level as keyof typeof levelLabels] || filters.level}`,
      onRemove: () => onRemoveFilter('level')
    })
  }
  
  if (filters.status !== 'all') {
    const statusLabels = {
      'true': 'Activas',
      'false': 'Inactivas'
    }
    badges.push({
      label: `Estado: ${statusLabels[filters.status as keyof typeof statusLabels] || filters.status}`,
      onRemove: () => onRemoveFilter('status')
    })
  }
  
  return badges
}