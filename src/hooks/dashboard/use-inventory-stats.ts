'use client'

import { useState, useEffect, useCallback } from 'react'

export interface InventoryDashboardStats {
  role: string
  // Equipos
  totalAssets: number
  availableAssets: number
  assignedAssets: number
  maintenanceAssets: number
  retiredAssets: number
  // Consumibles
  totalConsumables: number
  lowStockConsumables: number
  outOfStockConsumables: number
  // Licencias
  totalLicenses: number
  expiredLicenses: number
  expiringLicenses: number
  // Actas pendientes
  pendingDeliveryActs: number
  pendingReturnActs: number
  pendingDecommissions: number
  // Familias
  activeFamilyCount: number
  // Cliente sin gestión
  assignedEquipment?: number
  maintenanceEquipment?: number
  pendingMaintenance?: number
}

interface UseInventoryStatsReturn {
  stats: InventoryDashboardStats | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Hook para cargar métricas de inventario del dashboard.
 * Devuelve null si el usuario no tiene acceso al módulo de inventario.
 */
export function useInventoryStats(): UseInventoryStatsReturn {
  const [stats, setStats] = useState<InventoryDashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/stats/inventory', { cache: 'no-store' })
      if (!res.ok) throw new Error('Error al cargar métricas de inventario')
      const data = await res.json()
      setStats(data) // null si no tiene acceso
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setStats(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, isLoading, error, refetch: fetchStats }
}
