/**
 * Hook para obtener el estado real del sistema
 * Proporciona información en tiempo real sobre base de datos, cache, email, backup, etc.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

interface DatabaseStatus {
  status: 'active' | 'error' | 'maintenance'
  type: string
  responseTime?: string
  connections?: {
    active: number
    max: number
    percentage: number
  }
  size?: string
  tables?: number
  activeQueries?: number
  error?: string
  lastCheck: string
}

interface CacheStatus {
  status: 'active' | 'error' | 'unknown'
  type: string
  usage?: {
    percentage: number
    used: string
    total: string
  }
  hitRate?: number
  keys?: number
  error?: string
  lastCheck: string
}

interface EmailStatus {
  status: 'active' | 'error' | 'maintenance'
  type: string
  emailsSent?: {
    today: number
    thisWeek: number
    thisMonth: number
  }
  queue?: number
  lastSent?: string
  provider?: string
  error?: string
  lastCheck: string
}

interface BackupStatus {
  status: 'scheduled' | 'overdue' | 'error' | 'running'
  type: string
  lastBackup?: {
    time: string
    timeAgo: string
    size: string
    records: number
  }
  nextBackup?: string
  frequency?: string
  retention?: string
  location?: string
  error?: string
  lastCheck: string
}

interface ServerStatus {
  status: 'running' | 'error' | 'maintenance'
  uptime?: {
    seconds: number
    formatted: string
  }
  memory?: {
    used: number
    total: number
    percentage: number
  }
  cpu?: {
    usage: number
    cores: number
  }
  nodeVersion?: string
  platform?: string
  error?: string
  lastCheck: string
}

interface SystemStatus {
  database: DatabaseStatus
  cache: CacheStatus
  email: EmailStatus
  backup: BackupStatus
  server: ServerStatus
  lastUpdated: string
}

interface UseSystemStatusReturn {
  systemStatus: SystemStatus | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  lastUpdated: Date | null
}

/**
 * Hook para obtener el estado real del sistema
 * Solo disponible para administradores
 * 
 * @example
 * ```tsx
 * function SystemStatusPanel() {
 *   const { systemStatus, isLoading, error, refetch } = useSystemStatus()
 *   
 *   if (isLoading) return <Loading />
 *   if (error) return <Error onRetry={refetch} />
 *   
 *   return (
 *     <div>
 *       <StatusCard 
 *         title="Base de Datos"
 *         status={systemStatus.database.status}
 *         details={systemStatus.database}
 *       />
 *     </div>
 *   )
 * }
 * ```
 */
export function useSystemStatus(): UseSystemStatusReturn {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadSystemStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

      const response = await fetch('/api/system/status', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache' // Siempre obtener datos frescos
        }
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        setSystemStatus(data)
        setLastUpdated(new Date())
      } else if (response.status === 401) {
        setError('No tienes permisos para ver el estado del sistema')
      } else {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Tiempo de espera agotado al obtener estado del sistema')
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
        setError(errorMessage)
        console.error('System status error:', err)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSystemStatus()
    
    // Auto-refresh cada 2 minutos para datos del sistema
    const interval = setInterval(loadSystemStatus, 2 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [loadSystemStatus])

  return {
    systemStatus,
    isLoading,
    error,
    refetch: loadSystemStatus,
    lastUpdated
  }
}

/**
 * Hook simplificado para obtener solo el estado general del sistema
 */
export function useSystemHealth() {
  const { systemStatus, isLoading, error } = useSystemStatus()
  
  const getOverallHealth = useCallback(() => {
    if (!systemStatus) return 'unknown'
    
    const statuses = [
      systemStatus.database.status,
      systemStatus.cache.status,
      systemStatus.email.status,
      systemStatus.server.status
    ]
    
    if (statuses.some(status => status === 'error')) return 'error'
    if (statuses.some(status => status === 'maintenance')) return 'maintenance'
    if (statuses.every(status => status === 'active' || status === 'running')) return 'healthy'
    
    return 'warning'
  }, [systemStatus])

  return {
    health: getOverallHealth(),
    isLoading,
    error,
    systemStatus
  }
}