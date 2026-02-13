/**
 * Hook optimizado para gestión de tickets con performance mejorada
 * Implementa debounce, caching, y error handling granular
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'

export interface Ticket {
  id: string
  title: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  client: { id: string; name: string; email: string }
  assignee?: { id: string; name: string; email: string }
  category: { id: string; name: string; color: string }
  createdAt: string
  updatedAt: string
  _count: { comments: number; attachments: number }
}

export interface TicketFilters {
  search?: string
  status?: string
  priority?: string
  assigneeId?: string
  categoryId?: string
  clientId?: string
  dateFrom?: string
  dateTo?: string
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface TicketError {
  type: 'network' | 'permission' | 'validation' | 'server' | 'unknown'
  message: string
  code?: number
}

interface UseTicketsOptions {
  initialFilters?: TicketFilters
  pageSize?: number
  debounceMs?: number
  enableCache?: boolean
}

interface UseTicketsReturn {
  tickets: Ticket[]
  loading: boolean
  error: TicketError | null
  pagination: PaginationInfo
  filters: TicketFilters
  setFilters: (filters: Partial<TicketFilters>) => void
  clearFilters: () => void
  refresh: () => void
  goToPage: (page: number) => void
  hasActiveFilters: boolean
}

// Cache simple para mejorar performance
const ticketCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

export function useTickets(options: UseTicketsOptions = {}): UseTicketsReturn {
  const {
    initialFilters = {},
    pageSize = 25,
    debounceMs = 300,
    enableCache = true
  } = options

  const { data: session } = useSession()
  
  // Estados principales
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<TicketError | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 1
  })

  // Filtros con debounce
  const [filters, setFiltersState] = useState<TicketFilters>(initialFilters)
  const [debouncedFilters, setDebouncedFilters] = useState<TicketFilters>(initialFilters)

  // Debounce para filtros
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [filters, debounceMs])

  // Función para crear clave de cache
  const createCacheKey = useCallback((filters: TicketFilters, page: number) => {
    return JSON.stringify({ filters, page, limit: pageSize })
  }, [pageSize])

  // Función para obtener datos del cache
  const getCachedData = useCallback((key: string) => {
    if (!enableCache) return null
    
    const cached = ticketCache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }
    
    // Limpiar cache expirado
    if (cached) {
      ticketCache.delete(key)
    }
    
    return null
  }, [enableCache])

  // Función para guardar en cache
  const setCachedData = useCallback((key: string, data: any) => {
    if (!enableCache) return
    
    ticketCache.set(key, {
      data,
      timestamp: Date.now()
    })
    
    // Limpiar cache viejo si hay muchas entradas
    if (ticketCache.size > 50) {
      const oldestKey = ticketCache.keys().next().value
      if (oldestKey) {
        ticketCache.delete(oldestKey)
      }
    }
  }, [enableCache])

  // Función para crear error tipado
  const createError = useCallback((error: any, response?: Response): TicketError => {
    if (response) {
      switch (response.status) {
        case 401:
          return { type: 'permission', message: 'No tienes permisos para ver los tickets', code: 401 }
        case 403:
          return { type: 'permission', message: 'Acceso denegado a los tickets', code: 403 }
        case 404:
          return { type: 'validation', message: 'No se encontraron tickets', code: 404 }
        case 422:
          return { type: 'validation', message: 'Los filtros aplicados no son válidos', code: 422 }
        case 429:
          return { type: 'network', message: 'Demasiadas solicitudes. Intenta de nuevo en unos momentos', code: 429 }
        case 500:
        case 502:
        case 503:
          return { type: 'server', message: 'Error del servidor. Intenta de nuevo en unos momentos', code: response.status }
        default:
          return { type: 'unknown', message: `Error ${response.status}: ${response.statusText}`, code: response.status }
      }
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { type: 'network', message: 'Error de conexión. Verifica tu conexión a internet' }
    }

    if (error instanceof Error) {
      return { type: 'unknown', message: error.message }
    }

    return { type: 'unknown', message: 'Error inesperado al cargar los tickets' }
  }, [])

  // Función principal para cargar tickets
  const loadTickets = useCallback(async (page: number = pagination.page) => {
    if (!session?.user) {
      setTickets([])
      setPagination(prev => ({ ...prev, total: 0, totalPages: 1, page: 1 }))
      setLoading(false)
      return
    }

    // Verificar cache primero
    const cacheKey = createCacheKey(debouncedFilters, page)
    const cachedData = getCachedData(cacheKey)
    
    if (cachedData) {
      setTickets(cachedData.tickets)
      setPagination(cachedData.pagination)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      })

      // Agregar filtros solo si tienen valor
      Object.entries(debouncedFilters).forEach(([key, value]) => {
        if (value && value.toString().trim() && value !== 'all') {
          params.append(key, value.toString().trim())
        }
      })

      const response = await fetch(`/api/tickets?${params}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw createError(null, response)
      }

      const data = await response.json()

      // Procesar respuesta
      let ticketsData: Ticket[] = []
      let paginationData: PaginationInfo = {
        page,
        limit: pageSize,
        total: 0,
        totalPages: 1
      }

      if (data.success && data.data) {
        ticketsData = Array.isArray(data.data) ? data.data : []
        paginationData = {
          page: data.meta?.pagination?.page || page,
          limit: data.meta?.pagination?.limit || pageSize,
          total: data.meta?.pagination?.total || ticketsData.length,
          totalPages: data.meta?.pagination?.totalPages || 1
        }
      } else if (data.tickets) {
        ticketsData = Array.isArray(data.tickets) ? data.tickets : []
        paginationData = {
          page: data.currentPage || page,
          limit: pageSize,
          total: data.total || ticketsData.length,
          totalPages: data.pages || 1
        }
      }

      // Guardar en cache
      const cacheData = { tickets: ticketsData, pagination: paginationData }
      setCachedData(cacheKey, cacheData)

      setTickets(ticketsData)
      setPagination(paginationData)
      setError(null)

    } catch (error) {
      const ticketError: TicketError = {
        type: 'unknown',
        message: error instanceof Error ? error.message : 'Error al cargar tickets'
      }
      setError(ticketError)
      setTickets([])
      setPagination(prev => ({ ...prev, total: 0, totalPages: 1 }))
    } finally {
      setLoading(false)
    }
  }, [session, debouncedFilters, pageSize, createCacheKey, getCachedData, setCachedData, createError, pagination.page])

  // Efecto para cargar tickets cuando cambian los filtros
  useEffect(() => {
    loadTickets(1)
  }, [debouncedFilters, session])

  // Funciones de utilidad
  const setFilters = useCallback((newFilters: Partial<TicketFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
  }, [])

  const clearFilters = useCallback(() => {
    setFiltersState({})
  }, [])

  const refresh = useCallback(() => {
    // Limpiar cache para forzar recarga
    if (enableCache) {
      ticketCache.clear()
    }
    loadTickets(pagination.page)
  }, [loadTickets, pagination.page, enableCache])

  const goToPage = useCallback((page: number) => {
    if (page !== pagination.page && page >= 1 && page <= pagination.totalPages) {
      loadTickets(page)
    }
  }, [loadTickets, pagination.page, pagination.totalPages])

  // Computed values
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(value => 
      value && value.toString().trim() && value !== 'all'
    )
  }, [filters])

  return {
    tickets,
    loading,
    error,
    pagination,
    filters,
    setFilters,
    clearFilters,
    refresh,
    goToPage,
    hasActiveFilters
  }
}

// Utilidades adicionales
export const TICKET_STATUS_LABELS = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En Progreso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
} as const

export const TICKET_STATUS_COLORS = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
} as const

export const TICKET_PRIORITY_LABELS = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
} as const

export const TICKET_PRIORITY_COLORS = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
} as const

// Función para formatear tiempo relativo
export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (months > 0) return `${months} mes${months > 1 ? 'es' : ''}`
  if (weeks > 0) return `${weeks} semana${weeks > 1 ? 's' : ''}`
  if (days > 0) return `${days} día${days > 1 ? 's' : ''}`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}min`
  return 'Ahora'
}