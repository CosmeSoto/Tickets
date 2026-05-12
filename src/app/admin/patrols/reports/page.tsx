'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import {
  PATROL_COMPLIANCE_GUARD_EXPORT_COLUMNS,
  PATROL_COMPLIANCE_ROUTE_EXPORT_COLUMNS,
} from '@/lib/utils/patrol-utils'

interface GuardRow {
  guardId: string
  guardName: string
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

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface Family {
  id: string
  name: string
  code: string
}
interface Guard {
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

  const [groupBy, setGroupBy] = useState<'guard' | 'route'>('guard')
  const [familyId, setFamilyId] = useState('')
  const [guardId, setGuardId] = useState('')
  const [routeId, setRouteId] = useState('')
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [page, setPage] = useState(1)

  const [families, setFamilies] = useState<Family[]>([])
  const [guards, setGuards] = useState<Guard[]>([])
  const [routes, setRoutes] = useState<PatrolRoute[]>([])

  const [guardRows, setGuardRows] = useState<GuardRow[]>([])
  const [routeRows, setRouteRows] = useState<RouteRow[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const guardExport = useExport({
    filename: 'cumplimiento-guardias',
    title: 'Cumplimiento por Guardia',
    columns: PATROL_COMPLIANCE_GUARD_EXPORT_COLUMNS,
    getData: () => guardRows,
  })

  const routeExport = useExport({
    filename: 'cumplimiento-rutas',
    title: 'Cumplimiento por Ruta',
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
        page: String(page),
        limit: '25',
        ...(familyId ? { familyId } : {}),
        ...(guardId ? { guardId } : {}),
        ...(routeId ? { routeId } : {}),
      })
      const res = await fetch(`/api/patrols/reports/compliance?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar reporte')

      if (groupBy === 'guard') {
        setGuardRows(data.data?.byGuard ?? [])
        setRouteRows([])
      } else {
        setRouteRows(data.data?.byRoute ?? [])
        setGuardRows([])
      }
      setPagination(data.data?.pagination ?? null)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [from, to, groupBy, page, familyId, guardId, routeId])

  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch('/api/families?includeInactive=false')
      const data = await res.json()
      if (data.success) setFamilies(data.data)
    } catch {
      /* silencioso */
    }
  }, [])

  const fetchGuards = useCallback(async () => {
    try {
      const res = await fetch('/api/users?patrolsEnabled=true&limit=100')
      const data = await res.json()
      if (data.data) setGuards(data.data)
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
    fetchGuards()
  }, [session, status, router, fetchFamilies, fetchGuards])

  useEffect(() => {
    fetchRoutes()
  }, [fetchRoutes])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [groupBy, familyId, guardId, routeId, from, to])

  // Export is handled by guardExport / routeExport hooks directly

  if (status === 'loading' || !session) return null

  const hasData = groupBy === 'guard' ? guardRows.length > 0 : routeRows.length > 0

  return (
    <ModuleLayout
      title='Reportes de Cumplimiento'
      subtitle='Análisis de cumplimiento de rondas por guardia o por ruta'
      headerActions={
        hasData ? (
          <ExportButton
            onExportCSV={groupBy === 'guard' ? guardExport.exportCSV : routeExport.exportCSV}
            onExportExcel={groupBy === 'guard' ? guardExport.exportExcel : routeExport.exportExcel}
            onExportPDF={groupBy === 'guard' ? guardExport.exportPDF : routeExport.exportPDF}
            loading={guardExport.exporting || routeExport.exporting}
            size='sm'
            variant='outline'
          />
        ) : undefined
      }
    >
      {/* ── Filtros ── */}
      <Card className='mb-6'>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm flex items-center gap-2'>
            <Search className='h-4 w-4' />
            Filtros del reporte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {/* Agrupar por */}
            <div className='space-y-1.5'>
              <Label className='text-xs'>Agrupar por</Label>
              <div className='flex gap-2'>
                <Button
                  size='sm'
                  variant={groupBy === 'guard' ? 'default' : 'outline'}
                  onClick={() => setGroupBy('guard')}
                  className='flex-1'
                >
                  <User className='h-3.5 w-3.5 mr-1.5' />
                  Guardia
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
              <select
                value={familyId}
                onChange={e => setFamilyId(e.target.value)}
                className='w-full h-9 rounded-md border border-input bg-background px-3 text-sm'
              >
                <option value=''>Todas las áreas</option>
                {families.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Guardia (solo en modo guard) */}
            {groupBy === 'guard' && (
              <div className='space-y-1.5'>
                <Label className='text-xs'>Guardia</Label>
                <select
                  value={guardId}
                  onChange={e => setGuardId(e.target.value)}
                  className='w-full h-9 rounded-md border border-input bg-background px-3 text-sm'
                >
                  <option value=''>Todos los guardias</option>
                  {guards.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Ruta (solo en modo route) */}
            {groupBy === 'route' && (
              <div className='space-y-1.5'>
                <Label className='text-xs'>Ruta</Label>
                <select
                  value={routeId}
                  onChange={e => setRouteId(e.target.value)}
                  className='w-full h-9 rounded-md border border-input bg-background px-3 text-sm'
                >
                  <option value=''>Todas las rutas</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Desde */}
            <div className='space-y-1.5'>
              <Label className='text-xs'>Desde</Label>
              <Input
                type='datetime-local'
                value={from}
                onChange={e => setFrom(e.target.value)}
                className='h-9 text-sm'
              />
            </div>

            {/* Hasta */}
            <div className='space-y-1.5'>
              <Label className='text-xs'>Hasta</Label>
              <Input
                type='datetime-local'
                value={to}
                onChange={e => setTo(e.target.value)}
                className='h-9 text-sm'
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
        </CardContent>
      </Card>

      {/* ── Resultados ── */}
      {loading ? (
        <div className='flex items-center justify-center py-16'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        </div>
      ) : !hasSearched ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <BarChart3 className='h-12 w-12 text-muted-foreground/30 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>
              Configura los filtros y genera el reporte
            </p>
          </CardContent>
        </Card>
      ) : !hasData ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <BarChart3 className='h-12 w-12 text-muted-foreground/30 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>
              Sin datos para el período seleccionado
            </p>
          </CardContent>
        </Card>
      ) : groupBy === 'guard' ? (
        /* ── Tabla por guardia ── */
        <>
          {/* Mobile: cards */}
          <div className='space-y-3 sm:hidden'>
            {guardRows.map(row => (
              <Card key={row.guardId}>
                <CardContent className='p-4 space-y-3'>
                  <p className='font-medium text-sm'>{row.guardName}</p>
                  <div className='grid grid-cols-2 gap-2 text-xs'>
                    <div>
                      <span className='text-muted-foreground'>Asignadas:</span>{' '}
                      <span className='font-medium'>{row.assigned}</span>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Completadas:</span>{' '}
                      <span className='font-medium text-green-600 dark:text-green-400'>
                        {row.completed}
                      </span>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Omitidas:</span>{' '}
                      <span className='font-medium text-red-600 dark:text-red-400'>
                        {row.missed}
                      </span>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Incompletas:</span>{' '}
                      <span className='font-medium text-orange-600 dark:text-orange-400'>
                        {row.incomplete}
                      </span>
                    </div>
                  </div>
                  <div className='space-y-1'>
                    <div className='flex justify-between text-xs'>
                      <span className='text-muted-foreground'>Completitud promedio</span>
                      <span className='font-medium'>{row.avgCompletion}%</span>
                    </div>
                    <Progress value={row.avgCompletion} className='h-1.5' />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <div className='hidden sm:block rounded-lg border overflow-hidden'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50'>
                <tr>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>Guardia</th>
                  <th className='text-right px-4 py-3 font-medium text-muted-foreground'>
                    Asignadas
                  </th>
                  <th className='text-right px-4 py-3 font-medium text-muted-foreground'>
                    Completadas
                  </th>
                  <th className='text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell'>
                    Omitidas
                  </th>
                  <th className='text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell'>
                    Incompletas
                  </th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>
                    Completitud prom.
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                {guardRows.map(row => (
                  <tr key={row.guardId} className='hover:bg-muted/30 transition-colors'>
                    <td className='px-4 py-3 font-medium'>{row.guardName}</td>
                    <td className='px-4 py-3 text-right'>{row.assigned}</td>
                    <td className='px-4 py-3 text-right text-green-600 dark:text-green-400 font-medium'>
                      {row.completed}
                    </td>
                    <td className='px-4 py-3 text-right text-red-600 dark:text-red-400 hidden md:table-cell'>
                      {row.missed}
                    </td>
                    <td className='px-4 py-3 text-right text-orange-600 dark:text-orange-400 hidden md:table-cell'>
                      {row.incomplete}
                    </td>
                    <td className='px-4 py-3 w-48'>
                      <div className='flex items-center gap-2'>
                        <Progress value={row.avgCompletion} className='h-1.5 flex-1' />
                        <span className='text-xs font-medium w-10 text-right'>
                          {row.avgCompletion}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* ── Tabla por ruta ── */
        <>
          {/* Mobile: cards */}
          <div className='space-y-3 sm:hidden'>
            {routeRows.map(row => (
              <Card key={row.routeId}>
                <CardContent className='p-4 space-y-3'>
                  <p className='font-medium text-sm'>{row.routeName}</p>
                  <div className='grid grid-cols-2 gap-2 text-xs'>
                    <div>
                      <span className='text-muted-foreground'>Ejecuciones:</span>{' '}
                      <span className='font-medium'>{row.executions}</span>
                    </div>
                    <div>
                      <span className='text-muted-foreground'>Duración prom.:</span>{' '}
                      <span className='font-medium'>{row.avgDurationMinutes} min</span>
                    </div>
                  </div>
                  <div className='space-y-1'>
                    <div className='flex justify-between text-xs'>
                      <span className='text-muted-foreground'>Tasa de completitud</span>
                      <span className='font-medium'>{row.completionRate}%</span>
                    </div>
                    <Progress value={row.completionRate} className='h-1.5' />
                  </div>
                  {row.mostMissedCheckpoints.length > 0 && (
                    <div className='space-y-1'>
                      <p className='text-xs text-muted-foreground flex items-center gap-1'>
                        <AlertTriangle className='h-3 w-3 text-orange-500' />
                        Checkpoint más omitido
                      </p>
                      <p className='text-xs font-medium'>
                        {row.mostMissedCheckpoints[0].name} (
                        {row.mostMissedCheckpoints[0].missCount}x)
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <div className='hidden sm:block rounded-lg border overflow-hidden'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50'>
                <tr>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>Ruta</th>
                  <th className='text-right px-4 py-3 font-medium text-muted-foreground'>
                    Ejecuciones
                  </th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>
                    Completitud
                  </th>
                  <th className='text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell'>
                    Duración prom.
                  </th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell'>
                    Checkpoint más omitido
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                {routeRows.map(row => (
                  <tr key={row.routeId} className='hover:bg-muted/30 transition-colors'>
                    <td className='px-4 py-3 font-medium'>{row.routeName}</td>
                    <td className='px-4 py-3 text-right'>{row.executions}</td>
                    <td className='px-4 py-3 w-48'>
                      <div className='flex items-center gap-2'>
                        <Progress value={row.completionRate} className='h-1.5 flex-1' />
                        <span className='text-xs font-medium w-10 text-right'>
                          {row.completionRate}%
                        </span>
                      </div>
                    </td>
                    <td className='px-4 py-3 text-right text-muted-foreground hidden md:table-cell'>
                      {row.avgDurationMinutes} min
                    </td>
                    <td className='px-4 py-3 hidden lg:table-cell'>
                      {row.mostMissedCheckpoints.length > 0 ? (
                        <div className='flex items-center gap-1.5 text-xs'>
                          <AlertTriangle className='h-3 w-3 text-orange-500 flex-shrink-0' />
                          <span className='truncate max-w-[160px]'>
                            {row.mostMissedCheckpoints[0].name}
                          </span>
                          <Badge variant='outline' className='text-xs flex-shrink-0'>
                            {row.mostMissedCheckpoints[0].missCount}x
                          </Badge>
                        </div>
                      ) : (
                        <span className='text-xs text-muted-foreground'>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Paginación */}
      {pagination && pagination.totalPages > 1 && (
        <div className='flex items-center justify-between mt-4'>
          <p className='text-xs text-muted-foreground'>
            {pagination.total} resultado{pagination.total !== 1 ? 's' : ''}
          </p>
          <div className='flex gap-2'>
            <Button
              size='sm'
              variant='outline'
              disabled={!pagination.hasPrev}
              onClick={() => setPage(p => p - 1)}
            >
              Anterior
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={!pagination.hasNext}
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </ModuleLayout>
  )
}
