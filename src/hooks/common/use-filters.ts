/**
 * Hook genérico para filtrar cualquier lista de datos
 * Soporta búsqueda, selects, checkboxes, rangos de fecha y más
 * 
 * @example
 * ```tsx
 * const filterConfig: FilterConfig<User>[] = [
 *   {
 *     id: 'search',
 *     type: 'search',
 *     searchFields: ['name', 'email'],
 *     placeholder: 'Buscar usuarios...'
 *   },
 *   {
 *     id: 'role',
 *     type: 'select',
 *     field: 'role',
 *     options: [
 *       { value: 'all', label: 'Todos' },
 *       { value: 'ADMIN', label: 'Admin' }
 *     ]
 *   }
 * ]
 * 
 * const { filteredData, filters, setFilter, clearFilters } = useFilters(users, filterConfig)
 * ```
 */

import { useState, useMemo, useCallback, useEffect } from 'react'

// Hook de debounce inline para evitar dependencia circular
function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export type FilterType = 'search' | 'select' | 'multiselect' | 'daterange' | 'checkbox' | 'range'

export interface FilterConfig<T> {
  id: string
  type: FilterType
  label?: string
  searchFields?: (keyof T)[]
  options?: Array<{ value: string; label: string }>
  field?: keyof T
  defaultValue?: any
  placeholder?: string
  min?: number
  max?: number
}

export interface UseFiltersOptions {
  debounceMs?: number
  persistInUrl?: boolean
  onFilterChange?: (filters: Record<string, any>) => void
}

export interface UseFiltersReturn<T> {
  filteredData: T[]
  filters: Record<string, any>
  setFilter: (id: string, value: any) => void
  clearFilters: () => void
  clearFilter: (id: string) => void
  activeFiltersCount: number
  hasActiveFilters: boolean
}

export function useFilters<T>(
  data: T[],
  config: FilterConfig<T>[],
  options: UseFiltersOptions = {}
): UseFiltersReturn<T> {
  const { debounceMs = 300, onFilterChange } = options

  // Inicializar filtros con valores por defecto
  const initialFilters = useMemo(() => {
    const filters: Record<string, any> = {}
    config.forEach(filter => {
      filters[filter.id] = filter.defaultValue ?? (filter.type === 'search' ? '' : 'all')
    })
    return filters
  }, [config])

  const [filters, setFilters] = useState<Record<string, any>>(initialFilters)

  // Debounce para búsqueda
  const searchFilters = useMemo(() => {
    const search: Record<string, any> = {}
    config.forEach(filter => {
      if (filter.type === 'search') {
        search[filter.id] = filters[filter.id]
      }
    })
    return search
  }, [config, filters])

  const debouncedSearchFilters = useDebounce(searchFilters, debounceMs)

  // Combinar filtros con debounce aplicado a búsqueda
  const effectiveFilters = useMemo(() => {
    return { ...filters, ...debouncedSearchFilters }
  }, [filters, debouncedSearchFilters])

  // Aplicar filtros
  const filteredData = useMemo(() => {
    return data.filter(item => {
      return config.every(filterConfig => {
        const filterValue = effectiveFilters[filterConfig.id]

        // Skip si no hay valor o es 'all'
        if (!filterValue || filterValue === 'all' || filterValue === '') {
          return true
        }

        switch (filterConfig.type) {
          case 'search': {
            const searchTerm = String(filterValue).toLowerCase()
            if (!searchTerm) return true

            return filterConfig.searchFields?.some(field => {
              const fieldValue = item[field]
              if (fieldValue == null) return false
              return String(fieldValue).toLowerCase().includes(searchTerm)
            }) ?? true
          }

          case 'select': {
            if (!filterConfig.field) return true
            const itemValue = item[filterConfig.field]
            return String(itemValue) === String(filterValue)
          }

          case 'multiselect': {
            if (!filterConfig.field) return true
            if (!Array.isArray(filterValue) || filterValue.length === 0) return true
            const itemValue = item[filterConfig.field]
            return filterValue.includes(String(itemValue))
          }

          case 'checkbox': {
            if (!filterConfig.field) return true
            const itemValue = item[filterConfig.field]
            return Boolean(itemValue) === Boolean(filterValue)
          }

          case 'range': {
            if (!filterConfig.field) return true
            const itemValue = Number(item[filterConfig.field])
            const [min, max] = filterValue as [number, number]
            return itemValue >= min && itemValue <= max
          }

          case 'daterange': {
            if (!filterConfig.field) return true
            const itemDate = new Date(item[filterConfig.field] as any)
            const [startDate, endDate] = filterValue as [Date, Date]
            return itemDate >= startDate && itemDate <= endDate
          }

          default:
            return true
        }
      })
    })
  }, [data, config, effectiveFilters])

  // Setear un filtro individual
  const setFilter = useCallback((id: string, value: any) => {
    setFilters(prev => ({ ...prev, [id]: value }))
  }, [])

  // Limpiar todos los filtros
  const clearFilters = useCallback(() => {
    setFilters(initialFilters)
  }, [initialFilters])

  // Limpiar un filtro específico
  const clearFilter = useCallback((id: string) => {
    const filterConfig = config.find(f => f.id === id)
    if (filterConfig) {
      setFilters(prev => ({
        ...prev,
        [id]: filterConfig.defaultValue ?? (filterConfig.type === 'search' ? '' : 'all')
      }))
    }
  }, [config])

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(([id, value]) => {
      const filterConfig = config.find(f => f.id === id)
      if (!filterConfig) return false

      if (filterConfig.type === 'search') {
        return value && value !== ''
      }
      return value && value !== 'all' && value !== filterConfig.defaultValue
    }).length
  }, [filters, config])

  const hasActiveFilters = activeFiltersCount > 0

  // Callback cuando cambian los filtros
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(filters)
    }
  }, [filters, onFilterChange])

  return {
    filteredData,
    filters,
    setFilter,
    clearFilters,
    clearFilter,
    activeFiltersCount,
    hasActiveFilters
  }
}
