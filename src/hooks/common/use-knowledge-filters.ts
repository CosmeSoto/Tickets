import { useState, useEffect, useMemo } from 'react'
import { useDebounce } from './use-debounce'

export interface KnowledgeFilters {
  search: string
  category: string
  sortBy: 'recent' | 'views' | 'helpful'
  family: string
}

const DEFAULT_FILTERS: KnowledgeFilters = {
  search: '',
  category: 'all',
  sortBy: 'recent',
  family: 'all',
}

export function useKnowledgeFilters() {
  const [filters, setFilters] = useState<KnowledgeFilters>(DEFAULT_FILTERS)
  
  // Debounce solo para búsqueda
  const debouncedSearch = useDebounce(filters.search, 300)
  
  // Filtros con búsqueda debounced
  const debouncedFilters = useMemo(() => ({
    ...filters,
    search: debouncedSearch,
  }), [filters, debouncedSearch])

  const setFilter = <K extends keyof KnowledgeFilters>(
    key: K,
    value: KnowledgeFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS)
  }

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== DEFAULT_FILTERS.search ||
      filters.category !== DEFAULT_FILTERS.category ||
      filters.sortBy !== DEFAULT_FILTERS.sortBy ||
      filters.family !== DEFAULT_FILTERS.family
    )
  }, [filters])

  const activeFiltersCount = useMemo(() => {
    return [
      filters.search !== DEFAULT_FILTERS.search,
      filters.category !== DEFAULT_FILTERS.category,
      filters.sortBy !== DEFAULT_FILTERS.sortBy,
      filters.family !== DEFAULT_FILTERS.family,
    ].filter(Boolean).length
  }, [filters])

  return {
    filters,
    debouncedFilters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    activeFiltersCount,
  }
}
