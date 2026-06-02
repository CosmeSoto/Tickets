'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Shield, Clock, ChevronRight } from 'lucide-react'
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

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  INCOMPLETE: 'Incompleta',
  MISSED: 'Omitida',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    dateStyle: 'short',
    timeStyle: 'short',
  })

export default function PatrolListPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [patrols, setPatrols] = useState<PatrolListItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('active')

  // Auth guard
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    const user = session.user as any
    if (user.patrolsEnabled === false) {
      router.push('/unauthorized')
      return
    }
  }, [session, status, router])

  const fetchPatrols = async (p: number, sf: string) => {
    setLoading(true)
    setLoadError(null)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45_000)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (sf === 'active') params.set('status', 'PENDING,IN_PROGRESS')
      else if (sf !== 'all') params.set('status', sf.toUpperCase())

      const res = await fetch(`/api/patrols?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('Error al cargar patrullas')
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
  }

  useEffect(() => {
    if (session) fetchPatrols(page, statusFilter)
  }, [session, page, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Columnas con soporte de sort para DataTable
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
        label: 'Inicio',
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

  // Export
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'mis-rondas',
    title: 'Mis Rondas',
    subtitle: 'Patrullas asignadas y en progreso',
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

  // Card renderer para vista móvil
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
            <span className='flex items-center gap-1'>
              ⏱ {formatDurationMinutes(patrol.route.estimatedDurationMinutes)}
            </span>
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

  return (
    <ModuleLayout
      title='Mis Rondas'
      subtitle='Patrullas asignadas y en progreso'
      loading={loading && patrols.length === 0 && !loadError}
      error={loadError}
      onRetry={() => fetchPatrols(page, statusFilter)}
    >
      {/* Filtros de estado */}
      <div className='flex gap-2 flex-wrap mb-4'>
        {[
          { value: 'active', label: 'Activas' },
          { value: 'COMPLETED', label: 'Completadas' },
          { value: 'MISSED', label: 'Omitidas' },
          { value: 'all', label: 'Todas' },
        ].map(opt => (
          <Button
            key={opt.value}
            size='sm'
            variant={statusFilter === opt.value ? 'default' : 'outline'}
            onClick={() => {
              setStatusFilter(opt.value)
              setPage(1)
            }}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Tabla con búsqueda, orden y exportación */}
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
        onRefresh={() => fetchPatrols(page, statusFilter)}
      />

      {/* Empty state si no hay patrullas y no está cargando */}
      {!loading && patrols.length === 0 && !loadError && (
        <Card className='mt-4'>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <Shield className='h-12 w-12 text-muted-foreground/30 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>No hay patrullas</p>
            <p className='text-xs text-muted-foreground mt-1'>No tienes patrullas en este estado</p>
          </CardContent>
        </Card>
      )}
    </ModuleLayout>
  )
}
