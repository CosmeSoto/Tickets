'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Shield, Clock, ChevronRight, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { PatrolStatusBadge } from '@/components/patrol/patrol-status-badge'
import { PatrolProgress } from '@/components/patrol/patrol-progress'

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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('es-EC', {
      timeZone: 'America/Guayaquil',
      dateStyle: 'short',
      timeStyle: 'short',
    })

  if (status === 'loading' || !session) return null

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

      {/* Lista — cards en móvil, tabla en desktop */}
      {loading ? (
        <div className='flex items-center justify-center py-16'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        </div>
      ) : patrols.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <Shield className='h-12 w-12 text-muted-foreground/30 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>No hay patrullas</p>
            <p className='text-xs text-muted-foreground mt-1'>No tienes patrullas en este estado</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card stack */}
          <div className='space-y-3 sm:hidden'>
            {patrols.map(patrol => (
              <Card
                key={patrol.id}
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
                  <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                    <Clock className='h-3 w-3' />
                    {formatDate(patrol.scheduledStart)}
                  </div>
                  {patrol.status === 'IN_PROGRESS' && patrol.progress && (
                    <PatrolProgress
                      visitedRequired={patrol.progress.visitedRequired}
                      totalRequired={patrol.progress.totalRequired}
                    />
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
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell'>
                    Área
                  </th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>Inicio</th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>Estado</th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell'>
                    Progreso
                  </th>
                  <th className='w-10' />
                </tr>
              </thead>
              <tbody className='divide-y'>
                {patrols.map(patrol => (
                  <tr
                    key={patrol.id}
                    className='hover:bg-muted/30 cursor-pointer transition-colors'
                    onClick={() => router.push(`/patrol/${patrol.id}`)}
                  >
                    <td className='px-4 py-3 font-medium'>{patrol.route.name}</td>
                    <td className='px-4 py-3 text-muted-foreground hidden md:table-cell'>
                      {patrol.family.name}
                    </td>
                    <td className='px-4 py-3 text-muted-foreground'>
                      {formatDate(patrol.scheduledStart)}
                    </td>
                    <td className='px-4 py-3'>
                      <PatrolStatusBadge status={patrol.status} />
                    </td>
                    <td className='px-4 py-3 hidden lg:table-cell w-40'>
                      {patrol.progress && (
                        <PatrolProgress
                          visitedRequired={patrol.progress.visitedRequired}
                          totalRequired={patrol.progress.totalRequired}
                          showFraction={false}
                        />
                      )}
                    </td>
                    <td className='px-4 py-3'>
                      <ChevronRight className='h-4 w-4 text-muted-foreground' />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {pagination && pagination.totalPages > 1 && (
            <div className='flex items-center justify-between mt-4'>
              <p className='text-xs text-muted-foreground'>
                {pagination.total} patrulla{pagination.total !== 1 ? 's' : ''}
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
        </>
      )}
    </ModuleLayout>
  )
}
