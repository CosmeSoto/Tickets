'use client'

import { useCallback, useMemo } from 'react'
import { useDashboardData } from './use-dashboard-data'
import { useAdminProtection, useTechnicianProtection, useClientProtection } from './use-role-protection'
import { dashboardCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/dashboard-cache'

type Role = 'ADMIN' | 'TECHNICIAN' | 'CLIENT'

interface UseUnifiedDashboardOptions {
  role: Role
}

interface UseUnifiedDashboardReturn {
  // Datos del usuario
  session: any
  userName: string | undefined
  userRole: Role
  
  // Estados
  isLoading: boolean
  isAuthorized: boolean
  error: string | null
  
  // Datos del dashboard
  stats: any
  tickets: any[]
  recentActivity: any[]
  
  // Funciones
  refetch: () => void
}

export function useUnifiedDashboard({ role }: UseUnifiedDashboardOptions): UseUnifiedDashboardReturn {
  // Seleccionar el hook de protección según el rol
  const protectionHook = 
    role === 'ADMIN' ? useAdminProtection() :
    role === 'TECHNICIAN' ? useTechnicianProtection() :
    useClientProtection()
  
  const { session, isAuthorized, isLoading: authLoading } = protectionHook
  
  // Cargar datos del dashboard con cache
  const { 
    stats, 
    tickets, 
    recentActivity, 
    isLoading: dataLoading, 
    error, 
    refetch: originalRefetch 
  } = useDashboardData(role)
  
  // Combinar estados de carga
  const isLoading = authLoading || dataLoading
  
  // Extraer nombre de usuario
  const userName = session?.user?.name
  
  // Refetch mejorado que invalida cache
  const refetch = useCallback(() => {
    // Invalidar cache del dashboard específico
    const cacheKey = 
      role === 'ADMIN' ? CACHE_KEYS.ADMIN_STATS :
      role === 'TECHNICIAN' ? CACHE_KEYS.TECHNICIAN_STATS :
      CACHE_KEYS.CLIENT_STATS
    
    dashboardCache.invalidate(cacheKey)
    
    // Invalidar cache de tickets relacionados
    dashboardCache.invalidatePattern(`tickets:${role}`)
    
    // Llamar al refetch original
    originalRefetch()
  }, [role, originalRefetch])
  
  // Memoizar stats para evitar re-renders innecesarios
  const memoizedStats = useMemo(() => stats, [stats])
  const memoizedTickets = useMemo(() => tickets, [tickets])
  const memoizedActivity = useMemo(() => recentActivity, [recentActivity])
  
  return {
    session,
    userName,
    userRole: role,
    isLoading,
    isAuthorized,
    error,
    stats: memoizedStats,
    tickets: memoizedTickets,
    recentActivity: memoizedActivity,
    refetch
  }
}
