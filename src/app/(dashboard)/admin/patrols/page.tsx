'use client'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
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
  CalendarDays,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { PatrolStatusBadge } from '@/components/patrol/patrol-status-badge'
import { ListTableToolbar } from '@/components/common/list-table-toolbar'
import { useExport } from '@/hooks/common/use-export'
import { PATROL_HISTORY_EXPORT_COLUMNS } from '@/lib/utils/patrol-utils'
import {
  PatrolAgendaCalendar,
  agendaDayKey,
  formatAgendaTime,
  type AgendaEvent,
} from '@/components/patrols/patrol-agenda-calendar'
import { PatrolAgendaWeek, weekRangeFromAnchor } from '@/components/patrols/patrol-agenda-week'
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

type DayBucket = 'all' | 'pending' | 'done' | 'attention'

const BUCKET_FILTER: Record<DayBucket, (e: AgendaEvent) => boolean> = {
  all: () => true,
  pending: e => e.status === 'PENDING' || e.status === 'IN_PROGRESS',
  done: e => e.status === 'COMPLETED',
  attention: e => e.status === 'MISSED' || e.status === 'INCOMPLETE',
}

export default function PatrolDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [month, setMonth] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(() => new Date())
  const [agendaEvents, setAgendaEvents] = useState<AgendaEvent[]>([])
  const [byDay, setByDay] = useState<
    Record<string, { total: number; byStatus: Partial<Record<string, number>> }>
  >({})
  const [agendaLoading, setAgendaLoading] = useState(true)
  const [agendaTruncated, setAgendaTruncated] = useState(false)
  const [filterAgentId, setFilterAgentId] = useState('')
  const [filterFamilyId, setFilterFamilyId] = useState('')
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([])
  const [families, setFamilies] = useState<Array<{ id: string; name: string }>>([])
  const [dayBucket, setDayBucket] = useState<DayBucket>('all')
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'patrullas-activas',
    title: 'Patrullas Activas',
    columns: PATROL_HISTORY_EXPORT_COLUMNS,
    getData: () => data?.activePatrols ?? [],
  })

  const weekKey = agendaDayKey(startOfWeek(selectedDay, { weekStartsOn: 1 }))
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`

  const agendaRange = useMemo(() => {
    if (viewMode === 'week') {
      return weekRangeFromAnchor(selectedDay)
    }
    const from = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const to = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    to.setHours(23, 59, 59, 999)
    return { from, to }
    // weekKey / monthKey estabilizan el rango al cambiar solo el día seleccionado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, weekKey, monthKey])

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/patrols/dashboard')
      if (!res.ok) throw new Error('Error al cargar dashboard')
      const json = await res.json()
      setData(json.data)
    } catch {
      /* silencioso */
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const fetchAgenda = useCallback(async () => {
    setAgendaLoading(true)
    try {
      const params = new URLSearchParams({
        from: agendaRange.from.toISOString(),
        to: agendaRange.to.toISOString(),
      })
      if (filterAgentId) params.set('agentId', filterAgentId)
      if (filterFamilyId) params.set('familyId', filterFamilyId)
      const res = await fetch(`/api/patrols/agenda?${params}`)
      if (!res.ok) throw new Error('Error al cargar agenda')
      const json = await res.json()
      setAgendaEvents(json.data?.events ?? [])
      setByDay(json.data?.byDay ?? {})
      setAgendaTruncated(Boolean(json.data?.truncated))
    } catch {
      setAgendaEvents([])
      setByDay({})
    } finally {
      setAgendaLoading(false)
    }
  }, [agendaRange.from.toISOString(), agendaRange.to.toISOString(), filterAgentId, filterFamilyId])

  const fetchAgents = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        patrolsEnabled: 'true',
        limit: '100',
      })
      const res = await fetch(`/api/users?${params}`)
      const json = await res.json()
      if (json.data) {
        setAgents(
          json.data
            .filter((u: { role: string }) => u.role !== 'ADMIN')
            .map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))
        )
      }
    } catch {
      /* silencioso */
    }
  }, [])

  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch(
        '/api/families?includeInactive=false&module=patrols&scope=operational'
      )
      const json = await res.json()
      if (json.success && json.data) {
        setFamilies(
          json.data.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }))
        )
      }
    } catch {
      /* silencioso */
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    fetchDashboard()
    fetchAgents()
    fetchFamilies()
  }, [session, status, router, fetchDashboard, fetchAgents, fetchFamilies])

  useEffect(() => {
    if (status !== 'authenticated') return
    void fetchAgenda()
  }, [status, fetchAgenda])

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchDashboard(true)
      void fetchAgenda()
    }, 30_000)
    return () => clearInterval(interval)
  }, [fetchDashboard, fetchAgenda])

  const selectedKey = agendaDayKey(selectedDay)
  const dayEvents = useMemo(() => {
    const list = agendaEvents.filter(e => e.dayKey === selectedKey)
    return list.filter(BUCKET_FILTER[dayBucket])
  }, [agendaEvents, selectedKey, dayBucket])

  const dayCounts = useMemo(() => {
    const all = agendaEvents.filter(e => e.dayKey === selectedKey)
    return {
      all: all.length,
      pending: all.filter(BUCKET_FILTER.pending).length,
      done: all.filter(BUCKET_FILTER.done).length,
      attention: all.filter(BUCKET_FILTER.attention).length,
    }
  }, [agendaEvents, selectedKey])

  const selectedDayLabel = selectedDay.toLocaleDateString('es-EC', {
    timeZone: DEFAULT_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  if (status === 'loading' || !session) return null

  return (
    <ModuleLayout
      title='Agenda de Rondas'
      subtitle='Qué está ocurriendo hoy, lo próximo y lo ya cumplido'
      loading={loading && !data}
      headerActions={
        <div className='flex items-center gap-2 flex-wrap justify-end'>
          <div className='flex rounded-md border p-0.5'>
            <Button
              type='button'
              size='sm'
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              className='h-7 text-xs px-2.5'
              onClick={() => setViewMode('month')}
            >
              Mes
            </Button>
            <Button
              type='button'
              size='sm'
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              className='h-7 text-xs px-2.5'
              onClick={() => setViewMode('week')}
            >
              Semana
            </Button>
          </div>
          <Select
            value={filterFamilyId || 'all'}
            onValueChange={v => setFilterFamilyId(v === 'all' ? '' : v)}
          >
            <SelectTrigger className='w-[150px] h-8 text-xs'>
              <SelectValue placeholder='Todas las áreas' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todas las áreas</SelectItem>
              {families.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterAgentId || 'all'}
            onValueChange={v => setFilterAgentId(v === 'all' ? '' : v)}
          >
            <SelectTrigger className='w-[150px] h-8 text-xs'>
              <SelectValue placeholder='Todos los agentes' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos los agentes</SelectItem>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              void fetchDashboard(true)
              void fetchAgenda()
            }}
            disabled={refreshing || agendaLoading}
          >
            <RefreshCw
              className={`h-4 w-4 sm:mr-2 ${refreshing || agendaLoading ? 'animate-spin' : ''}`}
            />
            <span className='hidden sm:inline'>Actualizar</span>
          </Button>
        </div>
      }
    >
      {/* ── KPIs del día ── */}
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

      {/* ── Calendario + detalle del día ── */}
      <div className='grid grid-cols-1 xl:grid-cols-5 gap-6 mb-6'>
        <div className='xl:col-span-3'>
          {viewMode === 'month' ? (
            <PatrolAgendaCalendar
              month={month}
              onMonthChange={m => {
                setMonth(m)
              }}
              selectedDay={selectedDay}
              onSelectDay={day => {
                setSelectedDay(day)
                setMonth(day)
                setDayBucket('all')
              }}
              byDay={byDay}
              loading={agendaLoading}
            />
          ) : (
            <PatrolAgendaWeek
              weekAnchor={selectedDay}
              onWeekChange={anchor => {
                setSelectedDay(anchor)
                setMonth(anchor)
              }}
              selectedDay={selectedDay}
              onSelectDay={day => {
                setSelectedDay(day)
                setDayBucket('all')
              }}
              events={agendaEvents}
              loading={agendaLoading}
              onEventClick={event => router.push(`/patrol/${event.id}`)}
            />
          )}
          {agendaTruncated && (
            <p className='text-xs text-amber-600 dark:text-amber-400 mt-2'>
              Se alcanzó el límite de eventos del rango. Filtra por área o agente para ver el
              detalle completo.
            </p>
          )}
        </div>

        <div className='xl:col-span-2 space-y-4'>
          <Card className='h-full'>
            <CardHeader className='pb-3'>
              <div className='flex items-start justify-between gap-2'>
                <div className='min-w-0'>
                  <CardTitle className='text-base flex items-center gap-2 capitalize'>
                    <CalendarDays className='h-4 w-4 text-primary shrink-0' />
                    <span className='truncate'>{selectedDayLabel}</span>
                  </CardTitle>
                  <CardDescription>Rondas de este día · click para abrir detalle</CardDescription>
                </div>
                <div className='flex items-center gap-0.5 shrink-0'>
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-7 w-7'
                    title='Día anterior'
                    aria-label='Día anterior'
                    onClick={() => {
                      const prev = addDays(selectedDay, -1)
                      setSelectedDay(prev)
                      setMonth(prev)
                      setDayBucket('all')
                    }}
                  >
                    <ChevronLeft className='h-3.5 w-3.5' />
                  </Button>
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-7 w-7'
                    title='Día siguiente'
                    aria-label='Día siguiente'
                    onClick={() => {
                      const next = addDays(selectedDay, 1)
                      setSelectedDay(next)
                      setMonth(next)
                      setDayBucket('all')
                    }}
                  >
                    <ChevronRight className='h-3.5 w-3.5' />
                  </Button>
                </div>
              </div>
              <div className='flex flex-wrap gap-1.5 pt-1'>
                {(
                  [
                    ['all', `Todas (${dayCounts.all})`],
                    ['pending', `En curso/pend. (${dayCounts.pending})`],
                    ['done', `Cumplidas (${dayCounts.done})`],
                    ['attention', `Omitidas/inc. (${dayCounts.attention})`],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    type='button'
                    size='sm'
                    variant={dayBucket === key ? 'default' : 'outline'}
                    className='h-7 text-xs'
                    onClick={() => setDayBucket(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {agendaLoading ? (
                <div className='flex items-center justify-center py-10'>
                  <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
                </div>
              ) : dayEvents.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-10 text-center'>
                  <Shield className='h-10 w-10 text-muted-foreground/30 mb-3' />
                  <p className='text-sm text-muted-foreground'>
                    No hay rondas en este día con el filtro actual
                  </p>
                  <Button
                    variant='link'
                    size='sm'
                    className='mt-2 text-xs'
                    onClick={() => router.push('/admin/patrols/schedules')}
                  >
                    Ir a Programación (reglas) →
                  </Button>
                </div>
              ) : (
                <div className='space-y-2 max-h-[480px] overflow-y-auto pr-1'>
                  {dayEvents.map(event => (
                    <button
                      key={event.id}
                      type='button'
                      onClick={() => router.push(`/patrol/${event.id}`)}
                      className='w-full text-left p-3 rounded-lg border hover:bg-muted/40 transition-colors'
                    >
                      <div className='flex items-start justify-between gap-2 mb-1'>
                        <div className='min-w-0'>
                          <p className='font-medium text-sm truncate'>{event.route.name}</p>
                          <p className='text-xs text-muted-foreground flex items-center gap-1 truncate'>
                            <User className='h-3 w-3 shrink-0' />
                            {event.agent.name}
                          </p>
                        </div>
                        <PatrolStatusBadge status={event.status} />
                      </div>
                      <div className='flex items-center justify-between text-xs text-muted-foreground'>
                        <span>
                          {formatAgendaTime(event.scheduledStart)} →{' '}
                          {formatAgendaTime(event.scheduledEnd)}
                        </span>
                        <span className='truncate max-w-[100px]'>{event.family.name}</span>
                      </div>
                      {(event.status === 'IN_PROGRESS' ||
                        event.status === 'COMPLETED' ||
                        event.status === 'INCOMPLETE') && (
                        <div className='mt-2 space-y-1'>
                          <Progress value={event.completionPercentage} className='h-1' />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* ── En progreso ahora ── */}
        <div className='lg:col-span-2'>
          <Card>
            <CardHeader className='pb-3'>
              <ListTableToolbar
                title={
                  <div>
                    <CardTitle className='text-base flex items-center gap-2'>
                      <Activity className='h-4 w-4 text-blue-500' />
                      En progreso ahora
                    </CardTitle>
                    <CardDescription>Actualización automática cada 30 segundos</CardDescription>
                  </div>
                }
                showViewToggle={false}
                export={
                  data && data.activePatrols.length > 0
                    ? {
                        onExportCSV: exportCSV,
                        onExportExcel: exportExcel,
                        onExportPDF: exportPDF,
                        loading: exporting,
                      }
                    : undefined
                }
              />
            </CardHeader>
            <CardContent>
              {!data || data.activePatrols.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-8 text-center'>
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className='space-y-4'>
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
              <Button
                variant='link'
                size='sm'
                className='p-0 h-auto text-xs'
                onClick={() => router.push('/admin/patrols/reports')}
              >
                Ver reportes de cumplimiento →
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm flex items-center gap-2'>
                <AlertTriangle className='h-4 w-4 text-orange-500' />
                Incidentes abiertos
              </CardTitle>
              <CardDescription className='text-xs'>
                Bandeja operativa (resolver / escalar)
              </CardDescription>
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
              <Button
                variant='link'
                size='sm'
                className='p-0 h-auto text-xs'
                onClick={() => router.push('/admin/patrols/incidents')}
              >
                Ir a Incidentes →
              </Button>
            </CardContent>
          </Card>

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
