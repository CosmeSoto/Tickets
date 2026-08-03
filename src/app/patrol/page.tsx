'use client'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Shield, Clock, CalendarDays, History, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/ui/data-table'
import { ExportButton } from '@/components/common/export-button'
import { PatrolStatusBadge } from '@/components/patrol/patrol-status-badge'
import { PatrolProgress } from '@/components/patrol/patrol-progress'
import { formatDurationMinutes } from '@/lib/utils/patrol-utils'
import { useExport } from '@/hooks/common/use-export'
import type { Column } from '@/components/ui/data-table'

interface PatrolListItem {
  id: string
  status: string
  scheduledStart: string
  scheduledEnd: string
  startedAt: string | null
  completionPercentage: number
  route: { id: string; name: string; estimatedDurationMinutes: number }
  family: { id: string; name: string; color: string | null }
  progress?: { visitedRequired: number; totalRequired: number; completionPercentage: number }
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

type TimeBucket = 'today' | 'upcoming' | 'history'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  INCOMPLETE: 'Incompleta',
  MISSED: 'Omitida',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', {
    timeZone: DEFAULT_TIMEZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  })

/** Inicio/fin del día en America/Guayaquil expresados como Date UTC. */
function ecuadorDayBounds(offsetDays = 0): { start: Date; end: Date } {
  const now = new Date()
  const ecuadorOffsetMin = -5 * 60
  const localNow = new Date(now.getTime() + ecuadorOffsetMin * 60 * 1000)
  const startUtcMs =
    Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate() + offsetDays
    ) -
    ecuadorOffsetMin * 60 * 1000
  const start = new Date(startUtcMs)
  const end = new Date(startUtcMs + 24 * 60 * 60 * 1000 - 1)
  return { start, end }
}

function bucketQuery(bucket: TimeBucket): URLSearchParams {
  const params = new URLSearchParams({ limit: '20' })
  if (bucket === 'today') {
    const { start, end } = ecuadorDayBounds(0)
    params.set('from', start.toISOString())
    params.set('to', end.toISOString())
    params.set('status', 'all')
  } else if (bucket === 'upcoming') {
    const { end: todayEnd } = ecuadorDayBounds(0)
    const { end: horizon } = ecuadorDayBounds(30)
    params.set('from', new Date(todayEnd.getTime() + 1).toISOString())
    params.set('to', horizon.toISOString())
    params.set('status', 'PENDING,IN_PROGRESS')
  } else {
    const { start: from } = ecuadorDayBounds(-30)
    const { end: to } = ecuadorDayBounds(0)
    params.set('from', from.toISOString())
    params.set('to', to.toISOString())
    params.set('status', 'COMPLETED,INCOMPLETE,MISSED')
  }
  return params
}

export default function PatrolListPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [patrols, setPatrols] = useState<PatrolListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [bucket, setBucket] = useState<TimeBucket>('today')
  const [counts, setCounts] = useState({ today: 0, upcoming: 0, history: 0 })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    const user = session.user as { role?: string; patrolsEnabled?: boolean }
    if (user.role !== 'ADMIN' && user.patrolsEnabled !== true) {
      router.push('/unauthorized')
    }
  }, [session, status, router])

  const fetchPatrols = useCallback(async (p: number, b: TimeBucket) => {
    setLoading(true)
    setLoadError(null)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45_000)
    try {
      const params = bucketQuery(b)
      params.set('page', String(p))

      const res = await fetch(`/api/patrols?${params}`, { signal: controller.signal })
      if (!res.ok) {
        let message = 'Error al cargar patrullas'
        try {
          const body = await res.json()
          if (typeof body?.error === 'string' && body.error.trim()) message = body.error
          else if (res.status === 403) message = 'No tienes privilegios para el módulo de rondas'
        } catch {
          if (res.status === 403) message = 'No tienes privilegios para el módulo de rondas'
        }
        throw new Error(message)
      }
      const data = await res.json()
      setPatrols(data.data ?? [])
      setPagination(data.pagination ?? null)
    } catch (err) {
      setPatrols([])
      setPagination(null)
      if (err instanceof Error && err.name === 'AbortError') {
        setLoadError('Tiempo de espera agotado. Por favor, intenta de nuevo.')
      } else {
        setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar las patrullas')
      }
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }, [])

  const fetchCounts = useCallback(async () => {
    try {
      const [todayRes, upcomingRes, historyRes] = await Promise.all(
        (['today', 'upcoming', 'history'] as TimeBucket[]).map(async b => {
          const params = bucketQuery(b)
          params.set('page', '1')
          params.set('limit', '1')
          const res = await fetch(`/api/patrols?${params}`)
          if (!res.ok) return 0
          const json = await res.json()
          return json.pagination?.total ?? 0
        })
      )
      setCounts({ today: todayRes, upcoming: upcomingRes, history: historyRes })
    } catch {
      /* silencioso */
    }
  }, [])

  useEffect(() => {
    if (!session) return
    void fetchPatrols(page, bucket)
  }, [session, page, bucket, fetchPatrols])

  useEffect(() => {
    if (!session) return
    void fetchCounts()
  }, [session, fetchCounts])

  const columns: Column<PatrolListItem>[] = useMemo(
    () => [
      {
        key: 'route',
        label: 'Ruta',
        sortable: true,
        render: (patrol: PatrolListItem) => (
          <span className='font-medium'>{patrol.route.name}</span>
        ),
      },
      {
        key: 'family',
        label: 'Área',
        sortable: true,
        render: (patrol: PatrolListItem) => (
          <span className='text-muted-foreground text-sm'>{patrol.family.name}</span>
        ),
      },
      {
        key: 'scheduledStart',
        label: 'Horario',
        sortable: true,
        render: (patrol: PatrolListItem) => (
          <span className='text-muted-foreground text-sm flex items-center gap-1'>
            <Clock className='h-3 w-3 inline' />
            {formatDate(patrol.scheduledStart)}
          </span>
        ),
      },
      {
        key: 'duration',
        label: 'Duración',
        sortable: true,
        render: (patrol: PatrolListItem) => (
          <span className='text-muted-foreground text-sm'>
            {formatDurationMinutes(patrol.route.estimatedDurationMinutes)}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Estado',
        sortable: true,
        render: (patrol: PatrolListItem) => <PatrolStatusBadge status={patrol.status} />,
      },
      {
        key: 'progress',
        label: 'Progreso',
        sortable: true,
        render: (patrol: PatrolListItem) =>
          patrol.progress ? (
            <div className='w-36'>
              <PatrolProgress
                visitedRequired={patrol.progress.visitedRequired}
                totalRequired={patrol.progress.totalRequired}
                showFraction={false}
              />
            </div>
          ) : (
            <span className='text-muted-foreground text-xs'>—</span>
          ),
      },
    ],
    []
  )

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'mis-rondas',
    title: 'Mis Rondas',
    subtitle: 'Patrullas asignadas',
    columns: [
      { key: 'route.name', label: 'Ruta' },
      { key: 'family.name', label: 'Área' },
      {
        key: 'scheduledStart',
        label: 'Inicio',
        format: (v: string) => formatDate(v),
      },
      {
        key: 'route.estimatedDurationMinutes',
        label: 'Duración',
        format: (v: number) => formatDurationMinutes(v),
      },
      {
        key: 'status',
        label: 'Estado',
        format: (v: string) => STATUS_LABELS[v] ?? v,
      },
      {
        key: 'completionPercentage',
        label: 'Completitud %',
        format: (v: number) => `${v}%`,
      },
    ],
    getData: () => patrols,
  })

  if (status === 'loading' || !session) return null

  const cardRenderer = (patrol: PatrolListItem) => (
    <Card
      className='cursor-pointer hover:border-primary/50 transition-colors'
      onClick={() => router.push(`/patrol/${patrol.id}`)}
    >
      <CardContent className='p-4 space-y-3'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <p className='font-medium text-sm truncate'>{patrol.route.name}</p>
            <p className='text-xs text-muted-foreground'>{patrol.family.name}</p>
          </div>
          <PatrolStatusBadge status={patrol.status} />
        </div>
        <div className='flex items-center gap-3 text-xs text-muted-foreground'>
          <span className='flex items-center gap-1'>
            <Clock className='h-3 w-3' />
            {formatDate(patrol.scheduledStart)}
          </span>
          {patrol.route.estimatedDurationMinutes > 0 && (
            <span>⏱ {formatDurationMinutes(patrol.route.estimatedDurationMinutes)}</span>
          )}
        </div>
        {patrol.status === 'IN_PROGRESS' && patrol.progress && (
          <PatrolProgress
            visitedRequired={patrol.progress.visitedRequired}
            totalRequired={patrol.progress.totalRequired}
          />
        )}
      </CardContent>
    </Card>
  )

  const bucketMeta: Record<TimeBucket, { label: string; hint: string; icon: typeof CalendarDays }> =
    {
      today: {
        label: 'Hoy',
        hint: 'Rondas programadas para hoy',
        icon: CalendarDays,
      },
      upcoming: {
        label: 'Próximas',
        hint: 'Pendientes de los próximos 30 días',
        icon: Clock,
      },
      history: {
        label: 'Cumplidas',
        hint: 'Completadas, incompletas u omitidas (30 días)',
        icon: History,
      },
    }

  return (
    <ModuleLayout
      title='Mis Rondas'
      subtitle='Hoy, próximas y lo ya cumplido'
      loading={loading && patrols.length === 0 && !loadError}
      error={loadError}
      onRetry={() => fetchPatrols(page, bucket)}
    >
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4'>
        {(Object.keys(bucketMeta) as TimeBucket[]).map(key => {
          const meta = bucketMeta[key]
          const Icon = meta.icon
          const active = bucket === key
          return (
            <button
              key={key}
              type='button'
              onClick={() => {
                setBucket(key)
                setPage(1)
              }}
              className={`text-left rounded-xl border p-3 transition-colors ${
                active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'hover:bg-muted/40'
              }`}
            >
              <div className='flex items-center justify-between gap-2'>
                <span className='text-sm font-semibold flex items-center gap-1.5'>
                  <Icon className='h-4 w-4' />
                  {meta.label}
                </span>
                <span className='text-lg font-bold tabular-nums'>{counts[key]}</span>
              </div>
              <p className='text-xs text-muted-foreground mt-1'>{meta.hint}</p>
            </button>
          )
        })}
      </div>

      <p className='text-xs text-muted-foreground mb-3'>{bucketMeta[bucket].hint}</p>

      {loading && patrols.length === 0 ? (
        <div className='flex justify-center py-12'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        </div>
      ) : (
        <DataTable
          data={patrols}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder='Buscar por ruta o área...'
          onRowClick={patrol => router.push(`/patrol/${patrol.id}`)}
          cardRenderer={cardRenderer}
          actions={
            <ExportButton
              onExportCSV={exportCSV}
              onExportExcel={exportExcel}
              onExportPDF={exportPDF}
              loading={exporting}
            />
          }
          pagination={
            pagination
              ? {
                  page,
                  limit: pagination.limit,
                  total: pagination.total,
                  onPageChange: setPage,
                  onLimitChange: () => {},
                }
              : undefined
          }
          onRefresh={() => {
            void fetchPatrols(page, bucket)
            void fetchCounts()
          }}
        />
      )}

      {!loading && patrols.length === 0 && !loadError && (
        <Card className='mt-4'>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <Shield className='h-12 w-12 text-muted-foreground/30 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>
              No hay rondas en “{bucketMeta[bucket].label}”
            </p>
            <p className='text-xs text-muted-foreground mt-1'>{bucketMeta[bucket].hint}</p>
            {bucket === 'today' && counts.upcoming > 0 && (
              <Button
                type='button'
                variant='link'
                size='sm'
                className='mt-2'
                onClick={() => {
                  setBucket('upcoming')
                  setPage(1)
                }}
              >
                Ver {counts.upcoming} próximas →
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </ModuleLayout>
  )
}
