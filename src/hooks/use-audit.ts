/**
 * Custom hook for Audit module
 * Centralizes all business logic and state management
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useFamilies } from '@/contexts/families-context'
import type {
  AuditLog,
  AuditStats,
  AuditPagination,
  AuditFilters,
} from '@/components/audit/utils/audit-types'
import { exportAuditReport } from '@/components/audit/utils/audit-exporters'

export function useAudit() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { families } = useFamilies()

  // ── State ──
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const [pagination, setPagination] = useState<AuditPagination>({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
  })

  const [filters, setFilters] = useState<AuditFilters>({
    search: '',
    entityType: 'all',
    action: '',
    userId: '',
    days: '30',
    familyId: '',
  })

  // ── Authorization check ──
  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'ADMIN') {
      router.push('/unauthorized')
      return
    }

    // Solo Super Admin puede ver auditorías
    if (!(session.user as any).isSuperAdmin) {
      router.push('/unauthorized')
      return
    }
  }, [session, status, router])

  // ── Load audit data ──
  const loadAuditData = useCallback(
    async (page = 1, limit = 20) => {
      try {
        setLoading(true)

        // Cargar logs con paginación
        const logsResponse = await fetch(
          '/api/admin/audit/logs?' +
            new URLSearchParams({
              ...filters,
              limit: limit.toString(),
              offset: ((page - 1) * limit).toString(),
            })
        )

        if (logsResponse.ok) {
          const logsData = await logsResponse.json()
          setLogs(logsData.logs || [])
          setPagination({
            page,
            limit,
            total: logsData.total || 0,
            hasMore: logsData.hasMore || false,
          })
        }

        // Cargar estadísticas solo en la primera página
        if (page === 1) {
          const statsResponse = await fetch(`/api/admin/audit/stats?days=${filters.days}`)

          if (statsResponse.ok) {
            const statsData = await statsResponse.json()
            setStats(statsData)
          }
        }
      } catch (error) {
        console.error('Error loading audit data:', error)
      } finally {
        setLoading(false)
      }
    },
    [filters]
  )

  // ── Load data when filters change ──
  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'ADMIN') {
      loadAuditData()
    }
  }, [filters, status, session, loadAuditData])

  // ── Export handlers ──
  const handleExportCSV = useCallback(
    (onSuccess: (message: string) => void, onError: (error: string) => void) => {
      void exportAuditReport('csv', filters, onSuccess, onError)
    },
    [filters]
  )

  const handleExportJSON = useCallback(
    (onSuccess: (message: string) => void, onError: (error: string) => void) => {
      void exportAuditReport('json', filters, onSuccess, onError)
    },
    [filters]
  )

  // ── Clear filters ──
  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      entityType: 'all',
      action: '',
      userId: '',
      days: '30',
      familyId: '',
    })
  }, [])

  // ── Update filter ──
  const updateFilter = useCallback((key: keyof AuditFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  // ── Dialog handlers ──
  const openLogDetails = useCallback((log: AuditLog) => {
    setSelectedLog(log)
    setIsDialogOpen(true)
  }, [])

  const closeLogDetails = useCallback(() => {
    setIsDialogOpen(false)
    setSelectedLog(null)
  }, [])

  // ── Pagination handlers ──
  const handlePageChange = useCallback(
    (page: number) => {
      loadAuditData(page, pagination.limit)
    },
    [loadAuditData, pagination.limit]
  )

  const handleLimitChange = useCallback(
    (limit: number) => {
      loadAuditData(1, limit)
    },
    [loadAuditData]
  )

  // ── Computed values ──
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const hasActiveFilters =
    filters.search !== '' ||
    filters.entityType !== 'all' ||
    filters.action !== '' ||
    filters.days !== '30' ||
    filters.familyId !== ''

  const criticalActionsCount =
    stats?.actionStats
      ?.filter(
        s =>
          s.action.includes('deleted') ||
          s.action.includes('role_changed') ||
          s.action.includes('login_failed')
      )
      .reduce((acc, s) => acc + s._count.id, 0) || 0

  return {
    // Session
    session,
    status,
    isSuperAdmin,

    // Data
    logs,
    stats,
    families,
    selectedLog,

    // State
    loading,
    isDialogOpen,
    pagination,
    filters,
    hasActiveFilters,

    // Computed
    criticalActionsCount,

    // Actions
    loadAuditData,
    updateFilter,
    clearFilters,
    openLogDetails,
    closeLogDetails,
    handlePageChange,
    handleLimitChange,
    handleExportCSV,
    handleExportJSON,
  }
}
