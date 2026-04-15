/**
 * Hook para filtros de tickets
 * Usa debounce solo para la búsqueda, igual que el módulo de técnicos
 */

import { useState, useCallback, useMemo } from 'react'
import { useDebounce } from '@/hooks/common/use-debounce'
import type { StatusFilter, PriorityFilter, DateFilter } from '@/lib/constants/filter-options'

export interface TicketFilters {
  search: string
  status: StatusFilter
  priority: PriorityFilter
  category: string
  assignee: string
  dateRange: DateFilter
  family: string
}

export interface UseTicketFiltersOptions {
  debounceMs?: number
  onFiltersChange?: (filters: TicketFilters) => void
}

export interface UseTicketFiltersReturn {
  filters: TicketFilters
  debouncedFilters: TicketFilters
  setFilter: <K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) => void
  clearFilters: () => void
  clearFilter: (key: keyof TicketFilters) => void
  activeFiltersCount: number
  hasActiveFilters: boolean
  isSearchActive: boolean
}

const DEFAULT_FILTERS: TicketFilters = {
  search: '',
  status: 'all',
  priority: 'all',
  category: 'all',
  assignee: 'all',
  dateRange: 'all',
  family: 'all',
}

export function useTicketFilters(options: UseTicketFiltersOptions = {}): UseTicketFiltersReturn {
  const { debounceMs = 500, onFiltersChange } = options
  
  const [filters, setFilters] = useState<TicketFilters>(DEFAULT_FILTERS)
  
  // Debounce solo la búsqueda
  const debouncedSearch = useDebounce(filters.search, debounceMs)
  
  // Crear filtros debounced
  const debouncedFilters = useMemo(() => ({
    ...filters,
    search: debouncedSearch
  }), [filters, debouncedSearch])

  // Callback para setFilter
  const setFilter = useCallback(<K extends keyof TicketFilters>(
    key: K, 
    value: TicketFilters[K]
  ) => {
    setFilters(prev => {
      if (prev[key] === value) return prev
      
      const newFilters = { ...prev, [key]: value }
      
      // Llamar onFiltersChange solo para filtros no-search
      if (key !== 'search' && onFiltersChange) {
        onFiltersChange(newFilters)
      }
      
      return newFilters
    })
  }, [onFiltersChange])

  // Callback para clearFilters
  const clearFilters = useCallback(() => {
    setFilters(prev => {
      const hasChanges = Object.keys(prev).some(key => 
        prev[key as keyof TicketFilters] !== DEFAULT_FILTERS[key as keyof TicketFilters]
      )
      
      if (!hasChanges) return prev
      
      if (onFiltersChange) {
        onFiltersChange(DEFAULT_FILTERS)
      }
      
      return DEFAULT_FILTERS
    })
  }, [onFiltersChange])

  // Callback para clearFilter
  const clearFilter = useCallback((key: keyof TicketFilters) => {
    setFilter(key, DEFAULT_FILTERS[key])
  }, [setFilter])

  // Calcular filtros activos
  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'search') return value.trim().length > 0
      return value !== 'all'
    }).length
  }, [filters])

  const hasActiveFilters = useMemo(() => activeFiltersCount > 0, [activeFiltersCount])
  const isSearchActive = useMemo(() => filters.search.trim().length > 0, [filters.search])

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