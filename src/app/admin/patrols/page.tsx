'use client'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  AlertTriangle,
  RefreshCw,
  Loader2,
  TrendingUp,
  BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { PatrolStatusBadge } from '@/components/patrol/patrol-status-badge'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import { PATROL_HISTORY_EXPORT_COLUMNS } from '@/lib/utils/patrol-utils'

interface DashboardData {
  today: {
    scheduled: number
    completed: number
    inProgress: number
    missed: number
  }
  activePatrols: Array<{
    id: string
    agentName: string
    routeName: string
    startedAt: string | null
    completionPercentage: number
    visitedCheckpoints: number
    totalCheckpoints: number
  }>
  last7Days: {
    missed: number
    incomplete: number
    completed: number
  }
  last30Days: {
    avgCompletionByRoute: Array<{
      routeId: string
      routeName: string
      avgCompletion: number
      totalExecutions: number
    }>
  }
  openIncidents: {
    open: number
    inProgress: number
  }
  recentIncidents?: Array<{
    id: string
    title: string
    status: string
    priority: string
    createdAt: string
    ticketCode: string | null
    reportedBy: string
    family: string | null
  }>
  recentPatrols?: Array<{
    id: string
    status: string
    routeName: string
    agentName: string
    familyName: string
    scheduledStart: string
    startedAt: string | null
    completedAt: string | null
    completionPercentage: number
  }>
}

export default function PatrolDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'patrullas-activas',
    title: 'Patrullas Activas',
    columns: PATROL_HISTORY_EXPORT_COLUMNS,
    getData: () => data?.activePatrols ?? [],
  })

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/patrols/dashboard')
      if (!res.ok) throw new Error('Error al cargar dashboard')
      const json = await res.json()
      setData(json.data)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    fetchDashboard()
  }, [session, status, router, fetchDashboard])

  // Polling cada 30s para patrullas activas
  useEffect(() => {
    const interval = setInterval(() => fetchDashboard(true), 30_000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  // Remove unused handleExportActive — export is now handled by useExport hook directly

  if (status === 'loading' || !session) return null

  return (
    <ModuleLayout
      title='Dashboard de Rondas'
      subtitle='Monitoreo en tiempo real del módulo de patrullaje'
      loading={loading}
      headerActions={
        <Button
          variant='outline'
          size='sm'
          onClick={() => fetchDashboard(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 sm:mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          <span className='hidden sm:inline'>Actualizar</span>
        </Button>
      }
    >
      {/* ── Stat cards del día ── */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6'>
        <Card>
          <CardContent className='pt-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-xs text-muted-foreground'>Programadas hoy</p>
                <p className='text-2xl font-bold'>{data?.today.scheduled ?? '—'}</p>
              </div>
              <Clock className='h-8 w-8 text-muted-foreground/40' />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='pt-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-xs text-muted-foreground'>Completadas hoy</p>
                <p className='text-2xl font-bold text-green-600 dark:text-green-400'>
                  {data?.today.completed ?? '—'}
                </p>
              </div>
              <CheckCircle2 className='h-8 w-8 text-green-500/40' />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='pt-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-xs text-muted-foreground'>En progreso</p>
                <p className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
                  {data?.today.inProgress ?? '—'}
                </p>
              </div>
              <Activity className='h-8 w-8 text-blue-500/40' />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='pt-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-xs text-muted-foreground'>Omitidas hoy</p>
                <p className='text-2xl font-bold text-red-600 dark:text-red-400'>
                  {data?.today.missed ?? '—'}
                </p>
              </div>
              <XCircle className='h-8 w-8 text-red-500/40' />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* ── Patrullas activas ── */}
        <div className='lg:col-span-2'>
          <Card>
            <CardHeader className='pb-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle className='text-base flex items-center gap-2'>
                    <Activity className='h-4 w-4 text-blue-500' />
                    Patrullas en Progreso
                  </CardTitle>
                  <CardDescription>Actualización automática cada 30 segundos</CardDescription>
                </div>
                {data && data.activePatrols.length > 0 && (
                  <ExportButton
                    onExportCSV={exportCSV}
                    onExportExcel={exportExcel}
                    onExportPDF={exportPDF}
                    loading={exporting}
                    size='sm'
                    variant='outline'
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className='flex items-center justify-center py-8'>
                  <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
                </div>
              ) : !data || data.activePatrols.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-10 text-center'>
                  <Shield className='h-10 w-10 text-muted-foreground/30 mb-3' />
                  <p className='text-sm text-muted-foreground'>No hay patrullas activas ahora</p>
                </div>
              ) : (
                <div className='space-y-3'>
                  {data.activePatrols.map(patrol => (
                    <div
                      key={patrol.id}
                      className='p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors'
                      onClick={() => router.push(`/patrol/${patrol.id}`)}
                    >
                      <div className='flex items-start justify-between gap-2 mb-2'>
                        <div className='min-w-0'>
                          <p className='font-medium text-sm truncate'>{patrol.routeName}</p>
                          <p className='text-xs text-muted-foreground'>{patrol.agentName}</p>
                        </div>
                        <PatrolStatusBadge status='IN_PROGRESS' />
                      </div>
                      <div className='space-y-1'>
                        <div className='flex items-center justify-between text-xs text-muted-foreground'>
                          <span>
                            {patrol.visitedCheckpoints}/{patrol.totalCheckpoints} checkpoints
                          </span>
                          <span className='font-medium'>
                            {Math.round(patrol.completionPercentage)}%
                          </span>
                        </div>
                        <Progress value={patrol.completionPercentage} className='h-1.5' />
                      </div>
                      {patrol.startedAt && (
                        <p className='text-xs text-muted-foreground mt-1.5'>
                          Iniciada:{' '}
                          {new Date(patrol.startedAt).toLocaleTimeString('es-EC', {
                            timeZone: DEFAULT_TIMEZONE,
                            timeStyle: 'short',
                          })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Panel lateral ── */}
        <div className='space-y-4'>
          {/* Patrullas Recientes (últimos 7 días) */}
          {data && data.recentPatrols && data.recentPatrols.length > 0 && (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm flex items-center gap-2'>
                  <Clock className='h-4 w-4' />
                  Patrullas Recientes (7d)
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-2'>
                {data.recentPatrols.map((patrol: any) => (
                  <div
                    key={patrol.id}
                    className='p-2 rounded border hover:bg-muted/30 cursor-pointer transition-colors'
                    onClick={() => router.push('/admin/patrols/reports')}
                  >
                    <div className='flex items-center justify-between mb-1'>
                      <span className='text-xs font-medium truncate max-w-[140px]'>
                        {patrol.routeName}
                      </span>
                      <PatrolStatusBadge status={patrol.status} />
                    </div>
                    <div className='flex items-center justify-between text-[10px] text-muted-foreground'>
                      <span>{patrol.agentName}</span>
                      <span>{patrol.completionPercentage}%</span>
                    </div>
                  </div>
                ))}
                <Button
                  variant='link'
                  size='sm'
                  className='p-0 h-auto text-xs'
                  onClick={() => router.push('/admin/patrols/reports')}
                >
                  Ver reportes completos →
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Últimos 7 días */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm flex items-center gap-2'>
                <BarChart3 className='h-4 w-4' />
                Últimos 7 días
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {[
                {
                  label: 'Completadas',
                  value: data?.last7Days.completed,
                  color: 'text-green-600 dark:text-green-400',
                },
                {
                  label: 'Incompletas',
                  value: data?.last7Days.incomplete,
                  color: 'text-orange-600 dark:text-orange-400',
                },
                {
                  label: 'Omitidas',
                  value: data?.last7Days.missed,
                  color: 'text-red-600 dark:text-red-400',
                },
              ].map(item => (
                <div key={item.label} className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>{item.label}</span>
                  <span className={`font-semibold ${item.color}`}>{item.value ?? '—'}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Incidentes de Patrulla */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm flex items-center gap-2'>
                <AlertTriangle className='h-4 w-4 text-orange-500' />
                Incidencias de Rondas
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Abiertas</span>
                <Badge variant='outline'>{data?.openIncidents.open ?? '—'}</Badge>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>En progreso</span>
                <Badge variant='outline'>{data?.openIncidents.inProgress ?? '—'}</Badge>
              </div>

              {/* Lista de incidencias recientes */}
              {data?.recentIncidents && data.recentIncidents.length > 0 && (
                <div className='border-t pt-2 mt-2 space-y-1.5'>
                  <p className='text-xs font-medium text-muted-foreground'>Recientes</p>
                  {data.recentIncidents.map((inc: any) => (
                    <div
                      key={inc.id}
                      className='p-2 rounded border hover:bg-muted/30 cursor-pointer transition-colors'
                      onClick={() => router.push(`/admin/tickets/${inc.id}`)}
                    >
                      <p className='text-xs font-medium truncate'>{inc.title}</p>
                      <div className='flex items-center gap-2 mt-0.5'>
                        <span className='text-[10px] text-muted-foreground'>{inc.reportedBy}</span>
                        {inc.ticketCode && (
                          <span className='text-[10px] font-mono text-muted-foreground'>
                            {inc.ticketCode}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant='link'
                size='sm'
                className='p-0 h-auto text-xs'
                onClick={() => router.push('/admin/patrols/incidents')}
              >
                Ver todas las incidencias →
              </Button>
            </CardContent>
          </Card>

          {/* Top rutas últimos 30 días */}
          {data && data.last30Days.avgCompletionByRoute.length > 0 && (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm flex items-center gap-2'>
                  <TrendingUp className='h-4 w-4' />
                  Completitud por Ruta (30d)
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {data.last30Days.avgCompletionByRoute.slice(0, 5).map(route => (
                  <div key={route.routeId} className='space-y-1'>
                    <div className='flex items-center justify-between text-xs'>
                      <span className='truncate text-muted-foreground max-w-[120px]'>
                        {route.routeName}
                      </span>
                      <span className='font-medium'>{route.avgCompletion}%</span>
                    </div>
                    <Progress value={route.avgCompletion} className='h-1' />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ModuleLayout>
  )
}
