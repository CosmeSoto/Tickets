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
import {
  DEFAULT_AUDIT_COLUMN_ORDER,
  DEFAULT_AUDIT_VISIBLE_COLUMNS,
  SENSITIVE_AUDIT_COLUMNS,
  resolveAuditExportKeys,
} from '@/components/audit/utils/audit-export-columns'

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

  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_AUDIT_COLUMN_ORDER)
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_AUDIT_VISIBLE_COLUMNS)
  const [includeSensitive, setIncludeSensitive] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleIncludeSensitiveChange = useCallback((value: boolean) => {
    setIncludeSensitive(value)
    setVisibleColumns(prev => {
      const next = value
        ? [...new Set([...prev, ...SENSITIVE_AUDIT_COLUMNS])]
        : prev.filter(k => !(SENSITIVE_AUDIT_COLUMNS as string[]).includes(k))
      // Mantener sync con menú Columnas (localStorage)
      try {
        const raw = localStorage.getItem('audit-export-columns-v1')
        const stored = raw ? (JSON.parse(raw) as { order?: string[] }) : {}
        localStorage.setItem(
          'audit-export-columns-v1',
          JSON.stringify({
            order: stored.order?.length ? stored.order : DEFAULT_AUDIT_COLUMN_ORDER,
            visible: next,
          })
        )
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

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
  // history.replaceState evita remount de la página (router.replace con ?qs sí remonta)
  useEffect(() => {
    if (!initializedRef.current) return

    saveAuditFilters(filters)
    const params = auditFiltersToUrlParams(filters)
    const qs = params.toString()
    const desired = qs ? `/admin/audit?${qs}` : '/admin/audit'
    if (typeof window === 'undefined') return
    const current = `${window.location.pathname}${window.location.search}`
    if (current !== desired) {
      window.history.replaceState(window.history.state, '', desired)
    }
  }, [filters])

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

  const exportKeys = useCallback(() => {
    return resolveAuditExportKeys(
      columnOrder.filter(k => visibleColumns.includes(k)),
      includeSensitive
    )
  }, [columnOrder, visibleColumns, includeSensitive])

  const runExport = useCallback(
    (
      format: 'csv' | 'json' | 'excel' | 'pdf',
      onSuccess: (message: string) => void,
      onError: (error: string) => void
    ) => {
      setExporting(true)
      void exportAuditReport(
        format,
        filters,
        {
          columns: exportKeys(),
          includeSensitive,
          maskPii: true,
        },
        msg => {
          setExporting(false)
          onSuccess(msg)
        },
        err => {
          setExporting(false)
          onError(err)
        }
      )
    },
    [filters, exportKeys, includeSensitive]
  )

  const handleExportCSV = useCallback(
    (onSuccess: (message: string) => void, onError: (error: string) => void) => {
      runExport('csv', onSuccess, onError)
    },
    [runExport]
  )

  const handleExportExcel = useCallback(
    (onSuccess: (message: string) => void, onError: (error: string) => void) => {
      runExport('excel', onSuccess, onError)
    },
    [runExport]
  )

  const handleExportJSON = useCallback(
    (onSuccess: (message: string) => void, onError: (error: string) => void) => {
      runExport('json', onSuccess, onError)
    },
    [runExport]
  )

  const handleExportPDFFull = useCallback(
    (onSuccess: (message: string) => void, onError: (error: string) => void) => {
      runExport('pdf', onSuccess, onError)
    },
    [runExport]
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
    exporting,
    isDialogOpen,
    pagination,
    filters,
    hasActiveFilters,
    activePresetId,
    criticalActionsCount,
    columnOrder,
    visibleColumns,
    includeSensitive,
    setColumnOrder,
    setVisibleColumns,
    setIncludeSensitive: handleIncludeSensitiveChange,
    loadAuditData,
    updateFilter,
    clearFilters,
    applyPreset,
    openLogDetails,
    closeLogDetails,
    handlePageChange,
    handleLimitChange,
    handleExportCSV,
    handleExportExcel,
    handleExportJSON,
    handleExportPDFFull,
  }
}
