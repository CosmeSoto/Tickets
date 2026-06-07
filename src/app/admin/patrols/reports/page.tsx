'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  Search,
  Loader2,
  RefreshCw,
  User,
  ClipboardList,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/ui/data-table'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import { usePagination } from '@/hooks/common/use-pagination'
import { Badge } from '@/components/ui/badge'
import {
  PATROL_COMPLIANCE_AGENT_EXPORT_COLUMNS,
  PATROL_COMPLIANCE_ROUTE_EXPORT_COLUMNS,
  formatDurationMinutes,
} from '@/lib/utils/patrol-utils'
import { createAgentColumns, createReportRouteColumns } from '@/components/patrols/patrol-columns'

interface AgentRow {
  agentId: string
  agentName: string
  assigned: number
  completed: number
  missed: number
  incomplete: number
  avgCompletion: number
}

interface RouteRow {
  routeId: string
  routeName: string
  executions: number
  completionRate: number
  avgDurationMinutes: number
  mostMissedCheckpoints: Array<{ checkpointId: string; name: string; missCount: number }>
}

interface Family {
  id: string
  name: string
  code: string
}
interface Agent {
  id: string
  name: string
}
interface PatrolRoute {
  id: string
  name: string
}

// Default date range: last 30 days
function defaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 16)
}
function defaultTo() {
  return new Date().toISOString().slice(0, 16)
}

export default function PatrolReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [groupBy, setGroupBy] = useState<'agent' | 'route'>('agent')
  const [familyId, setFamilyId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [routeId, setRouteId] = useState('')
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)

  const [families, setFamilies] = useState<Family[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [routes, setRoutes] = useState<PatrolRoute[]>([])

  const [agentRows, setAgentRows] = useState<AgentRow[]>([])
  const [routeRows, setRouteRows] = useState<RouteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Pagination
  const activeRows = useMemo(() => {
    return groupBy === 'agent' ? agentRows : routeRows
  }, [groupBy, agentRows, routeRows])

  const pagination = usePagination(activeRows as any[], { pageSize: 20 })

  const agentExport = useExport({
    filename: 'cumplimiento-personal',
    title: 'Cumplimiento por Personal',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')} • ${agentRows.length} personas`,
    columns: PATROL_COMPLIANCE_AGENT_EXPORT_COLUMNS,
    getData: () => agentRows,
  })

  const routeExport = useExport({
    filename: 'cumplimiento-rutas',
    title: 'Cumplimiento por Ruta',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')} • ${routeRows.length} rutas`,
    columns: PATROL_COMPLIANCE_ROUTE_EXPORT_COLUMNS,
    getData: () => routeRows,
  })

  const fetchReport = useCallback(async () => {
    if (!from || !to) return
    setLoading(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams({
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        groupBy,
        limit: '100',
        ...(familyId ? { familyId } : {}),
        ...(agentId ? { agentId } : {}),
        ...(routeId ? { routeId } : {}),
      })
      const res = await fetch(`/api/patrols/reports/compliance?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar reporte')

      if (groupBy === 'agent') {
        setAgentRows(data.data?.byAgent ?? [])
        setRouteRows([])
      } else {
        setRouteRows(data.data?.byRoute ?? [])
        setAgentRows([])
      }
      pagination.goToPage(1)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [from, to, groupBy, familyId, agentId, routeId, pagination])

  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch('/api/families?includeInactive=false&module=patrols')
      const data = await res.json()
      if (data.success) setFamilies(data.data)
    } catch {
      /* silencioso */
    }
  }, [])

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/users?patrolsEnabled=true&limit=100')
      const data = await res.json()
      if (data.data) setAgents(data.data)
    } catch {
      /* silencioso */
    }
  }, [])

  const fetchRoutes = useCallback(async () => {
    try {
      const params = familyId ? `?familyId=${familyId}&limit=100` : '?limit=100'
      const res = await fetch(`/api/patrols/routes${params}`)
      const data = await res.json()
      setRoutes(data.data ?? [])
    } catch {
      /* silencioso */
    }
  }, [familyId])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    fetchFamilies()
    fetchAgents()
  }, [session, status, router, fetchFamilies, fetchAgents])

  useEffect(() => {
    fetchRoutes()
  }, [fetchRoutes])

  if (status === 'loading' || !session) return null

  const hasData = activeRows.length > 0
  const columns = groupBy === 'agent' ? createAgentColumns() : createReportRouteColumns()

  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: activeRows.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  return (
    <ModuleLayout
      title='Reportes de Cumplimiento'
      subtitle='Análisis de cumplimiento de rondas por personal o por ruta'
      loading={loading && !hasSearched}
    >
      {/* ── Filtros ── */}
      <div className='mb-6 rounded-lg border bg-card p-4'>
        <div className='flex items-center gap-2 mb-4'>
          <Search className='h-4 w-4 text-muted-foreground' />
          <h3 className='text-sm font-medium'>Filtros del reporte</h3>
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
          {/* Agrupar por */}
          <div className='space-y-1.5'>
            <Label className='text-xs'>Agrupar por</Label>
            <div className='flex gap-2'>
              <Button
                size='sm'
                variant={groupBy === 'agent' ? 'default' : 'outline'}
                onClick={() => setGroupBy('agent')}
                className='flex-1'
              >
                <User className='h-3.5 w-3.5 mr-1.5' />
                Personal
              </Button>
              <Button
                size='sm'
                variant={groupBy === 'route' ? 'default' : 'outline'}
                onClick={() => setGroupBy('route')}
                className='flex-1'
              >
                <ClipboardList className='h-3.5 w-3.5 mr-1.5' />
                Ruta
              </Button>
            </div>
          </div>

          {/* Área */}
          <div className='space-y-1.5'>
            <Label className='text-xs'>Área</Label>
            <Select
              value={familyId}
              onValueChange={setFamilyId}
            >
              <SelectTrigger className='h-9'>
                <SelectValue placeholder='Todas las áreas' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=''>Todas las áreas</SelectItem>
                {families.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Personal (solo en modo personal) */}
          {groupBy === 'agent' && (
            <div className='space-y-1.5'>
              <Label className='text-xs'>Personal</Label>
              <Select
                value={agentId}
                onValueChange={setAgentId}
              >
                <SelectTrigger className='h-9'>
                  <SelectValue placeholder='Todo el personal' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=''>Todo el personal</SelectItem>
                  {agents.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Ruta (solo en modo route) */}
          {groupBy === 'route' && (
            <div className='space-y-1.5'>
              <Label className='text-xs'>Ruta</Label>
              <Select
                value={routeId}
                onValueChange={setRouteId}
              >
                <SelectTrigger className='h-9'>
                  <SelectValue placeholder='Todas las rutas' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=''>Todas las rutas</SelectItem>
                  {routes.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Desde */}
          <div className='space-y-1.5'>
            <Label className='text-xs'>Desde</Label>
            <DateTimePicker
              value={from}
              onChange={setFrom}
              className='h-9'
            />
          </div>

          {/* Hasta */}
          <div className='space-y-1.5'>
            <Label className='text-xs'>Hasta</Label>
            <DateTimePicker
              value={to}
              onChange={setTo}
              className='h-9'
            />
          </div>
        </div>

        <div className='flex justify-end mt-4'>
          <Button onClick={fetchReport} disabled={loading}>
            {loading ? (
              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
            ) : (
              <RefreshCw className='h-4 w-4 mr-2' />
            )}
            Generar reporte
          </Button>
        </div>
      </div>

      {/* ── DataTable ── */}
      <DataTable
        title={groupBy === 'agent' ? 'Cumplimiento por Personal' : 'Cumplimiento por Ruta'}
        description={`Resultados del período: ${new Date(from).toLocaleDateString('es-EC')} - ${new Date(to).toLocaleDateString('es-EC')}`}
        data={activeRows as any[]}
        columns={columns as any}
        loading={loading}
        searchable
        searchPlaceholder={
          groupBy === 'agent' ? 'Buscar por nombre de agente...' : 'Buscar por nombre de ruta...'
        }
        pagination={paginationConfig}
        onRefresh={fetchReport}
        actions={
          hasData ? (
            <ExportButton
              onExportCSV={groupBy === 'agent' ? agentExport.exportCSV : routeExport.exportCSV}
              onExportExcel={
                groupBy === 'agent' ? agentExport.exportExcel : routeExport.exportExcel
              }
              onExportPDF={groupBy === 'agent' ? agentExport.exportPDF : routeExport.exportPDF}
              loading={agentExport.exporting || routeExport.exporting}
            />
          ) : undefined
        }
        emptyState={{
          icon: <BarChart3 className='h-12 w-12 text-muted-foreground mx-auto mb-4' />,
          title: !hasSearched
            ? 'Configura los filtros y genera el reporte'
            : 'Sin datos para el período seleccionado',
          description: !hasSearched
            ? 'Selecciona los filtros y haz clic en "Generar reporte"'
            : 'Intenta ajustar los filtros de fecha o área',
        }}
      />
    </ModuleLayout>
  )
}
