/**
 * Hook unificado para filtros de técnicos
 * Centraliza toda la lógica de filtrado para evitar duplicación
 */

import { useState, useCallback, useMemo } from 'react'
import { useDebounce } from '@/hooks/common/use-debounce'
import type { 
  TechnicianStatus, 
  TicketStatus, 
  TicketPriority, 
  DateFilter 
} from '@/lib/constants/technician-constants'

// ============================================================================
// INTERFACES PARA FILTROS DE TÉCNICOS
// ============================================================================

export interface TechnicianFilters {
  search: string
  status: TechnicianStatus
  department: string
}

export interface TechnicianTicketFilters {
  search: string
  status: TicketStatus
  priority: TicketPriority
  category: string
  dateFilter: DateFilter
}

// ============================================================================
// OPCIONES DE CONFIGURACIÓN
// ============================================================================

export interface UseTechnicianFiltersOptions {
  debounceMs?: number
  onFiltersChange?: (filters: TechnicianFilters) => void
}

export interface UseTechnicianTicketFiltersOptions {
  debounceMs?: number
  onFiltersChange?: (filters: TechnicianTicketFilters) => void
}

// ============================================================================
// TIPOS DE RETORNO
// ============================================================================

export interface UseTechnicianFiltersReturn {
  filters: TechnicianFilters
  debouncedFilters: TechnicianFilters
  setFilter: <K extends keyof TechnicianFilters>(key: K, value: TechnicianFilters[K]) => void
  clearFilters: () => void
  clearFilter: (key: keyof TechnicianFilters) => void
  activeFiltersCount: number
  hasActiveFilters: boolean
  isSearchActive: boolean
}

export interface UseTechnicianTicketFiltersReturn {
  filters: TechnicianTicketFilters
  debouncedFilters: TechnicianTicketFilters
  setFilter: <K extends keyof TechnicianTicketFilters>(key: K, value: TechnicianTicketFilters[K]) => void
  clearFilters: () => void
  clearFilter: (key: keyof TechnicianTicketFilters) => void
  activeFiltersCount: number
  hasActiveFilters: boolean
  isSearchActive: boolean
}

// ============================================================================
// VALORES POR DEFECTO
// ============================================================================

const DEFAULT_TECHNICIAN_FILTERS: TechnicianFilters = {
  search: '',
  status: 'all',
  department: 'all'
}

const DEFAULT_TECHNICIAN_TICKET_FILTERS: TechnicianTicketFilters = {
  search: '',
  status: 'all',
  priority: 'all',
  category: 'all',
  dateFilter: 'all'
}

// ============================================================================
// HOOK PARA FILTROS DE TÉCNICOS
// ============================================================================

export function useTechnicianFilters(
  options: UseTechnicianFiltersOptions = {}
): UseTechnicianFiltersReturn {
  const { debounceMs = 300, onFiltersChange } = options
  
  const [filters, setFilters] = useState<TechnicianFilters>(DEFAULT_TECHNICIAN_FILTERS)
  
  // Debounce solo la búsqueda para mejor UX
  const debouncedSearch = useDebounce(filters.search, debounceMs)
  
  const debouncedFilters = useMemo(() => ({
    ...filters,
    search: debouncedSearch
  }), [filters, debouncedSearch])

  // Notificar cambios de filtros
  const handleFiltersChange = useCallback((newFilters: TechnicianFilters) => {
    onFiltersChange?.(newFilters)
  }, [onFiltersChange])

  // Función para establecer un filtro específico
  const setFilter = useCallback(<K extends keyof TechnicianFilters>(
    key: K, 
    value: TechnicianFilters[K]
  ) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value }
      handleFiltersChange(newFilters)
      return newFilters
    })
  }, [handleFiltersChange])

  // Función para limpiar todos los filtros
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_TECHNICIAN_FILTERS)
    handleFiltersChange(DEFAULT_TECHNICIAN_FILTERS)
  }, [handleFiltersChange])

  // Función para limpiar un filtro específico
  const clearFilter = useCallback((key: keyof TechnicianFilters) => {
    const defaultValue = DEFAULT_TECHNICIAN_FILTERS[key]
    setFilter(key, defaultValue)
  }, [setFilter])

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      const defaultValue = DEFAULT_TECHNICIAN_FILTERS[key as keyof TechnicianFilters]
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
// HOOK PARA FILTROS DE TICKETS DE TÉCNICOS
// ============================================================================

export function useTechnicianTicketFilters(
  options: UseTechnicianTicketFiltersOptions = {}
): UseTechnicianTicketFiltersReturn {
  const { debounceMs = 300, onFiltersChange } = options
  
  const [filters, setFilters] = useState<TechnicianTicketFilters>(DEFAULT_TECHNICIAN_TICKET_FILTERS)
  
  // Debounce solo la búsqueda para mejor UX
  const debouncedSearch = useDebounce(filters.search, debounceMs)
  
  const debouncedFilters = useMemo(() => ({
    ...filters,
    search: debouncedSearch
  }), [filters, debouncedSearch])

  // Notificar cambios de filtros
  const handleFiltersChange = useCallback((newFilters: TechnicianTicketFilters) => {
    onFiltersChange?.(newFilters)
  }, [onFiltersChange])

  // Función para establecer un filtro específico
  const setFilter = useCallback(<K extends keyof TechnicianTicketFilters>(
    key: K, 
    value: TechnicianTicketFilters[K]
  ) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value }
      handleFiltersChange(newFilters)
      return newFilters
    })
  }, [handleFiltersChange])

  // Función para limpiar todos los filtros
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_TECHNICIAN_TICKET_FILTERS)
    handleFiltersChange(DEFAULT_TECHNICIAN_TICKET_FILTERS)
  }, [handleFiltersChange])

  // Función para limpiar un filtro específico
  const clearFilter = useCallback((key: keyof TechnicianTicketFilters) => {
    const defaultValue = DEFAULT_TECHNICIAN_TICKET_FILTERS[key]
    setFilter(key, defaultValue)
  }, [setFilter])

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      const defaultValue = DEFAULT_TECHNICIAN_TICKET_FILTERS[key as keyof TechnicianTicketFilters]
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
 * Aplica filtros de técnicos a un array de datos
 */
export function applyTechnicianFilters<T extends {
  name: string
  email: string
  phone?: string
  isActive: boolean
  departmentId?: string
  department?: { name: string } | string
}>(
  data: T[],
  filters: TechnicianFilters
): T[] {
  return data.filter(item => {
    // Filtro de búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = 
        item.name.toLowerCase().includes(searchLower) ||
        item.email.toLowerCase().includes(searchLower) ||
        (item.phone && item.phone.toLowerCase().includes(searchLower)) ||
        (typeof item.department === 'string' && item.department.toLowerCase().includes(searchLower)) ||
        (typeof item.department === 'object' && item.department?.name.toLowerCase().includes(searchLower))
      
      if (!matchesSearch) return false
    }

    // Filtro de estado
    if (filters.status !== 'all') {
      const isActive = filters.status === 'true'
      if (item.isActive !== isActive) return false
    }

    // Filtro de departamento
    if (filters.department !== 'all') {
      if (item.departmentId !== filters.department) return false
    }

    return true
  })
}

/**
 * Aplica filtros de tickets a un array de datos
 */
export function applyTechnicianTicketFilters<T extends {
  title: string
  description?: string
  status: string
  priority: string
  categoryId?: string
  createdAt: string
  createdBy?: { name: string; email: string }
}>(
  data: T[],
  filters: TechnicianTicketFilters
): T[] {
  return data.filter(item => {
    // Filtro de búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = 
        item.title.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower)) ||
        (item.createdBy?.name.toLowerCase().includes(searchLower)) ||
        (item.createdBy?.email.toLowerCase().includes(searchLower))
      
      if (!matchesSearch) return false
    }

    // Filtro de estado
    if (filters.status !== 'all' && item.status !== filters.status) {
      return false
    }

    // Filtro de prioridad
    if (filters.priority !== 'all' && item.priority !== filters.priority) {
      return false
    }

    // Filtro de categoría
    if (filters.category !== 'all' && item.categoryId !== filters.category) {
      return false
    }

    // Filtro de fecha
    if (filters.dateFilter !== 'all') {
      const itemDate = new Date(item.createdAt)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

      switch (filters.dateFilter) {
        case 'today':
          if (itemDate < today) return false
          break
        case 'yesterday':
          if (itemDate < yesterday || itemDate >= today) return false
          break
        case 'week':
          if (itemDate < weekAgo) return false
          break
        case 'month':
          if (itemDate < monthAgo) return false
          break
        case 'older':
          if (itemDate >= monthAgo) return false
          break
      }
    }

    return true
  })
}