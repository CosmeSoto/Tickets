'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import { PATROL_INCIDENTS_ADMIN_EXPORT_COLUMNS } from '@/lib/utils/patrol-utils'
import { IncidentFilters } from '@/components/patrols/incidents/incident-filters'
import {
  IncidentAdminTable,
  type PatrolIncidentRow,
} from '@/components/patrols/incidents/incident-admin-table'
import { IncidentDetailDialog } from '@/components/patrols/incidents/incident-detail-dialog'

const PAGE_SIZE = 25

const INITIAL_FILTERS = {
  familyId: '',
  severity: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  agentId: '',
}

export default function AdminPatrolIncidentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  // Data state
  const [incidents, setIncidents] = useState<PatrolIncidentRow[]>([])
  const [families, setFamilies] = useState<{ id: string; name: string }[]>([])
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & pagination
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  // Detail dialog
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // ── Fetch incidents ────────────────────────────────────────────────────────
  const fetchIncidents = useCallback(
    async (currentFilters: typeof INITIAL_FILTERS, currentPage: number) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('limit', String(PAGE_SIZE))
        params.set('offset', String((currentPage - 1) * PAGE_SIZE))

        if (currentFilters.familyId) params.set('familyId', currentFilters.familyId)
        if (currentFilters.severity) params.set('severity', currentFilters.severity)
        if (currentFilters.status) params.set('status', currentFilters.status)
        if (currentFilters.dateFrom) params.set('dateFrom', currentFilters.dateFrom)
        if (currentFilters.dateTo) params.set('dateTo', currentFilters.dateTo)
        if (currentFilters.agentId) params.set('agentId', currentFilters.agentId)

        const res = await fetch(`/api/patrols/incidents?${params.toString()}`)
        if (!res.ok) throw new Error('Error al cargar novedades')

        const json = await res.json()
        const data = json.data ?? json.incidents ?? []
        setIncidents(Array.isArray(data) ? data : [])
        setTotal(json.total ?? json.pagination?.total ?? data.length ?? 0)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al cargar novedades'
        setError(msg)
        toast({ title: 'Error', description: msg, variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    },
    [toast]
  )

  // ── Fetch families ─────────────────────────────────────────────────────────
  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch('/api/families?module=patrols')
      if (res.ok) {
        const json = await res.json()
        setFamilies(json.data ?? [])
      }
    } catch {
      /* silent */
    }
  }, [])

  // ── Fetch agents ───────────────────────────────────────────────────────────
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/users?patrolsEnabled=true&limit=100')
      if (res.ok) {
        const json = await res.json()
        setAgents((json.data ?? []).map((u: any) => ({ id: u.id, name: u.name })))
      }
    } catch {
      /* silent */
    }
  }, [])

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    fetchFamilies()
    fetchAgents()
    fetchIncidents(filters, page)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refetch on filter/page change ──────────────────────────────────────────
  useEffect(() => {
    if (status !== 'authenticated') return
    fetchIncidents(filters, page)
  }, [filters, page]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter handlers ────────────────────────────────────────────────────────
  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1) // reset to page 1 on filter change
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS)
    setPage(1)
  }, [])

  // ── Row click → open detail dialog ─────────────────────────────────────────
  const handleRowClick = useCallback((incident: PatrolIncidentRow) => {
    setSelectedIncidentId(incident.id)
    setDialogOpen(true)
  }, [])

  // ── After resolve/escalate → refresh table ─────────────────────────────────
  const handleActionComplete = useCallback(() => {
    fetchIncidents(filters, page)
  }, [fetchIncidents, filters, page])

  // ── Pagination config for DataTable ────────────────────────────────────────
  const paginationConfig = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      total,
      onPageChange: (p: number) => setPage(p),
      onLimitChange: () => {}, // fixed page size
    }),
    [page, total]
  )

  // ── Export ─────────────────────────────────────────────────────────────────
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'novedades-rondas',
    title: 'Novedades de Rondas',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-CO')} • ${total} novedades`,
    getData: () => incidents,
    columns: PATROL_INCIDENTS_ADMIN_EXPORT_COLUMNS,
  })

  if (status === 'loading' || !session) return null

  return (
    <ModuleLayout
      title='Novedades de Rondas'
      subtitle='Gestión de novedades e incidentes reportados durante patrullas'
      loading={loading && incidents.length === 0}
      error={error}
      onRetry={() => fetchIncidents(filters, page)}
      headerActions={
        incidents.length > 0 ? (
          <ExportButton
            onExportCSV={exportCSV}
            onExportExcel={exportExcel}
            onExportPDF={exportPDF}
            loading={exporting}
          />
        ) : undefined
      }
    >
      <IncidentFilters
        families={families}
        agents={agents}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      <div className='mt-4'>
        <IncidentAdminTable
          incidents={incidents}
          loading={loading}
          pagination={paginationConfig}
          onRowClick={handleRowClick}
          onRefresh={() => fetchIncidents(filters, page)}
        />
      </div>

      <IncidentDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        incidentId={selectedIncidentId}
        onActionComplete={handleActionComplete}
      />
    </ModuleLayout>
  )
}
