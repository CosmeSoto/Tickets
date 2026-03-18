/**
 * Hook para cargar datos del dashboard según el rol
 * Centraliza la lógica de carga de estadísticas y datos recientes
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

type Role = 'ADMIN' | 'TECHNICIAN' | 'CLIENT'

interface DashboardStats {
  // Stats comunes
  totalTickets?: number
  openTickets?: number
  resolvedTickets?: number
  avgResolutionTime?: string

  // Stats de Admin
  totalUsers?: number
  inProgressTickets?: number
  closedTickets?: number
  urgentTickets?: number
  todayTickets?: number
  thisWeekTickets?: number
  resolutionRate?: number
  activeTickets?: number
  systemHealth?: string
  pendingAssignment?: number
  overdueTickets?: number

  // Stats de Técnico
  assignedTickets?: number
  completedToday?: number
  thisWeekResolved?: number
  satisfactionScore?: number
  responseTime?: string
  performance?: string
  workload?: string

  // Stats de Cliente
  thisMonthTickets?: number
  satisfactionRating?: number
  supportQuality?: string
}

interface DashboardTicket {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  client?: string
  clientEmail?: string
  assignee?: string
  assigneeEmail?: string
  category: string
  categoryColor?: string
  createdAt: string
  updatedAt?: string
  resolvedAt?: string
  timeElapsed?: string
  timeSinceUpdate?: string
  hasUnreadMessages?: boolean
  commentCount?: number
  attachmentCount?: number
  isOverdue?: boolean
  urgencyLevel?: 'low' | 'medium' | 'high' | 'critical'
}

interface RecentActivity {
  id: string
  type: string
  title: string
  description: string
  time: string
  user: string
  ticketId?: string
}

interface UseDashboardDataReturn {
  stats: DashboardStats
  tickets: DashboardTicket[]
  recentActivity: RecentActivity[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook para cargar datos del dashboard con cache y optimizaciones
 * 
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { stats, tickets, isLoading, error, refetch } = useDashboardData('ADMIN')
 *   
 *   if (isLoading) return <Loading />
 *   if (error) return <Error message={error} onRetry={refetch} />
 *   
 *   return (
 *     <div>
 *       <StatsCard value={stats.totalTickets} />
 *       <TicketList tickets={tickets} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useDashboardData(role: Role): UseDashboardDataReturn {
  const [stats, setStats] = useState<DashboardStats>({})
  const [tickets, setTickets] = useState<DashboardTicket[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Cargar estadísticas y tickets en paralelo con timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

      const [statsResponse, ticketsResponse] = await Promise.all([
        fetch(`/api/dashboard/stats?role=${role}`, { 
          signal: controller.signal,
          headers: {
            'Cache-Control': 'max-age=60' // Cache por 1 minuto
          }
        }),
        fetch(`/api/dashboard/tickets?role=${role}&limit=5`, { 
          signal: controller.signal,
          headers: {
            'Cache-Control': 'max-age=30' // Cache por 30 segundos
          }
        }),
      ])

      clearTimeout(timeoutId)

      // Procesar estadísticas
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
        
        // Si hay actividad reciente en la respuesta
        if (statsData.recentActivity) {
          setRecentActivity(statsData.recentActivity)
        }
      } else {
        throw new Error(`Error al cargar estadísticas: ${statsResponse.status}`)
      }

      // Procesar tickets
      if (ticketsResponse.ok) {
        const ticketsData = await ticketsResponse.json()
        const ticketsList = Array.isArray(ticketsData.tickets) 
          ? ticketsData.tickets 
          : Array.isArray(ticketsData) 
          ? ticketsData 
          : []
        setTickets(ticketsList)
        
        // Agregar estadísticas adicionales de tickets si existen
        if (ticketsData.pendingAssignment !== undefined) {
          setStats(prev => ({ 
            ...prev, 
            pendingAssignment: ticketsData.pendingAssignment,
            overdueTickets: ticketsData.overdueTickets 
          }))
        }
      } else {
        console.warn('Error al cargar tickets:', ticketsResponse.status)
        setTickets([])
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Tiempo de espera agotado. Por favor, intenta de nuevo.')
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
        setError(errorMessage)
        console.error('Dashboard data error:', err)
      }
    } finally {
      setIsLoading(false)
    }
  }, [role])

  useEffect(() => {
    loadData()
    
    // Auto-refresh cada 5 minutos para mantener datos actualizados
    const interval = setInterval(loadData, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [loadData])

  return {
    stats,
    tickets,
    recentActivity,
    isLoading,
    error,
    refetch: loadData,
  }
}

/**
 * Hook para cargar solo estadísticas (sin tickets) con cache optimizado
 */
export function useDashboardStats(role: Role) {
  const [stats, setStats] = useState<DashboardStats>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`/api/dashboard/stats?role=${role}`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'max-age=60'
        }
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        throw new Error(`Error al cargar estadísticas: ${response.status}`)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Tiempo de espera agotado')
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }, [role])

  useEffect(() => {
    loadStats()
    
    // Auto-refresh cada 2 minutos para stats
    const interval = setInterval(loadStats, 2 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [loadStats])

  return { stats, isLoading, error, refetch: loadStats }
}

/**
 * Hook para cargar solo tickets recientes con paginación
 */
export function useDashboardTickets(role: Role, limit: number = 5) {
  const [tickets, setTickets] = useState<DashboardTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const loadTickets = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`/api/dashboard/tickets?role=${role}&limit=${limit}`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'max-age=30'
        }
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        const ticketsList = Array.isArray(data.tickets) 
          ? data.tickets 
          : Array.isArray(data) 
          ? data 
          : []
        setTickets(ticketsList)
        setTotal(data.total || ticketsList.length)
      } else {
        throw new Error(`Error al cargar tickets: ${response.status}`)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Tiempo de espera agotado')
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
        setError(errorMessage)
      }
      setTickets([])
    } finally {
      setIsLoading(false)
    }
  }, [role, limit])

  useEffect(() => {
    loadTickets()
    
    // Auto-refresh cada 30 segundos para tickets
    const interval = setInterval(loadTickets, 30 * 1000)
    
    return () => clearInterval(interval)
  }, [loadTickets])

  return { tickets, total, isLoading, error, refetch: loadTickets }
}
