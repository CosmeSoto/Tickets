/**
 * Custom hook for Audit module
 * Centralizes all business logic and state management
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useFamilies } from '@/contexts/families-context'
import type {
  AuditLog,
  AuditStats,
  AuditPagination,
  AuditFilters,
} from '@/components/audit/utils/audit-types'
import { exportAuditReport } from '@/components/audit/utils/audit-exporters'
import {
  DEFAULT_AUDIT_FILTERS,
  auditFiltersToUrlParams,
  loadStoredAuditFilters,
  saveAuditFilters,
  getPresetFilters,
  type AuditQuickPresetId,
} from '@/components/audit/utils/audit-filter-presets'

function mergeAuditFilters(
  base: AuditFilters,
  partial?: Partial<AuditFilters> | null
): AuditFilters {
  if (!partial) return base
  return { ...base, ...partial }
}

function buildLogsQuery(filters: AuditFilters, page: number, limit: number): string {
  const params = auditFiltersToUrlParams(filters)
  params.set('limit', String(limit))
  params.set('offset', String((page - 1) * limit))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

function buildStatsQuery(filters: AuditFilters): string {
  const params = auditFiltersToUrlParams(filters)
  if (filters.days) params.set('days', filters.days)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useAudit() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { families } = useFamilies()
  const initializedRef = useRef(false)

  // ── State ──
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [activePresetId, setActivePresetId] = useState<AuditQuickPresetId | null>(null)

  const [pagination, setPagination] = useState<AuditPagination>({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
  })

  const [filters, setFilters] = useState<AuditFilters>(DEFAULT_AUDIT_FILTERS)

  // ── Init filters from URL or localStorage ──
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const fromUrl: Partial<AuditFilters> = {}
    const urlKeys: (keyof AuditFilters)[] = [
      'search',
      'entityType',
      'action',
      'userId',
      'days',
      'familyId',
      'configModule',
      'actionPreset',
    ]
    let hasUrlFilters = false
    for (const key of urlKeys) {
      const v = searchParams.get(key)
      if (v) {
        fromUrl[key] = v
        hasUrlFilters = true
      }
    }

    const initial = hasUrlFilters
      ? mergeAuditFilters(DEFAULT_AUDIT_FILTERS, fromUrl)
      : mergeAuditFilters(DEFAULT_AUDIT_FILTERS, loadStoredAuditFilters())

    setFilters(initial)
  }, [searchParams])

  // ── Sync URL + localStorage when filters change ──
  useEffect(() => {
    if (!initializedRef.current) return

    saveAuditFilters(filters)
    const params = auditFiltersToUrlParams(filters)
    const qs = params.toString()
    router.replace(qs ? `/admin/audit?${qs}` : '/admin/audit', { scroll: false })
  }, [filters, router])

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

    if (!(session.user as { isSuperAdmin?: boolean }).isSuperAdmin) {
      router.push('/unauthorized')
    }
  }, [session, status, router])

  // ── Load audit data ──
  const loadAuditData = useCallback(
    async (page = 1, limit = 20) => {
      if (!initializedRef.current) return

      try {
        setLoading(true)

        const logsResponse = await fetch(
          `/api/admin/audit/logs${buildLogsQuery(filters, page, limit)}`
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

        if (page === 1) {
          const statsResponse = await fetch(`/api/admin/audit/stats${buildStatsQuery(filters)}`)
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

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'ADMIN' && initializedRef.current) {
      loadAuditData()
    }
  }, [filters, status, session, loadAuditData])

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

  const clearFilters = useCallback(() => {
    setActivePresetId(null)
    setFilters({ ...DEFAULT_AUDIT_FILTERS })
  }, [])

  const updateFilter = useCallback((key: keyof AuditFilters, value: string) => {
    setActivePresetId(null)
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const applyPreset = useCallback((presetId: AuditQuickPresetId) => {
    setActivePresetId(presetId)
    setFilters(getPresetFilters(presetId))
  }, [])

  const openLogDetails = useCallback((log: AuditLog) => {
    setSelectedLog(log)
    setIsDialogOpen(true)
  }, [])

  const closeLogDetails = useCallback(() => {
    setIsDialogOpen(false)
    setSelectedLog(null)
  }, [])

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

  const isSuperAdmin = (session?.user as { isSuperAdmin?: boolean })?.isSuperAdmin === true

  const hasActiveFilters =
    filters.search !== '' ||
    filters.entityType !== 'all' ||
    filters.action !== '' ||
    filters.days !== '30' ||
    filters.familyId !== '' ||
    filters.configModule !== 'all' ||
    Boolean(filters.actionPreset)

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
    session,
    status,
    isSuperAdmin,
    logs,
    stats,
    families,
    selectedLog,
    loading,
    isDialogOpen,
    pagination,
    filters,
    hasActiveFilters,
    activePresetId,
    criticalActionsCount,
    loadAuditData,
    updateFilter,
    clearFilters,
    applyPreset,
    openLogDetails,
    closeLogDetails,
    handlePageChange,
    handleLimitChange,
    handleExportCSV,
    handleExportJSON,
  }
}
