/**
 * Hook unificado para filtros de usuarios
 * Centraliza toda la lógica de filtrado para evitar duplicación
 */

import { useState, useCallback, useMemo } from 'react'
import { useDebounce } from '@/hooks/common/use-debounce'
import type { UserRole, UserStatus } from '@/lib/constants/user-constants'

export interface UserFilters {
  search: string
  role: UserRole | 'all'
  status: 'all' | 'true' | 'false'
  department: string
}

export interface UseUserFiltersOptions {
  debounceMs?: number
  onFiltersChange?: (filters: UserFilters) => void
}

export interface UseUserFiltersReturn {
  filters: UserFilters
  debouncedFilters: UserFilters
  setFilter: <K extends keyof UserFilters>(key: K, value: UserFilters[K]) => void
  clearFilters: () => void
  clearFilter: (key: keyof UserFilters) => void
  activeFiltersCount: number
  hasActiveFilters: boolean
  isSearchActive: boolean
}

const DEFAULT_FILTERS: UserFilters = {
  search: '',
  role: 'all',
  status: 'all',
  department: 'all'
}

export function useUserFilters(options: UseUserFiltersOptions = {}): UseUserFiltersReturn {
  const { debounceMs = 300, onFiltersChange } = options
  
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_FILTERS)
  
  // Debounce solo la búsqueda para mejor UX
  const debouncedSearch = useDebounce(filters.search, debounceMs)
  
  const debouncedFilters = useMemo(() => ({
    ...filters,
    search: debouncedSearch
  }), [filters, debouncedSearch])

  const setFilter = useCallback(<K extends keyof UserFilters>(
    key: K, 
    value: UserFilters[K]
  ) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value }
      onFiltersChange?.(newFilters)
      return newFilters
    })
  }, [onFiltersChange])

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    onFiltersChange?.(DEFAULT_FILTERS)
  }, [onFiltersChange])

  const clearFilter = useCallback((key: keyof UserFilters) => {
    setFilter(key, DEFAULT_FILTERS[key])
  }, [setFilter])

  // Calcular filtros activos
  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'search') return value.trim().length > 0
      return value !== 'all'
    }).length
  }, [filters])

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