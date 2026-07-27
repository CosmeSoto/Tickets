'use client'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

import { ReactNode } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface CheckpointEntry {
  checkpointName: string
  order: number
  scannedAt: string | null
  timeFromPrevious: number | null
  status: 'ON_TIME' | 'LATE' | 'MISSED'
}

export interface PatrolDetail {
  id: string
  routeName: string
  agentName: string
  scheduledStart: string
  startedAt: string | null
  completedAt: string | null
  startDelayMinutes: number | null
  isOnTime: boolean | null
  completionPercentage: number
  durationMinutes: number | null
  checkpointTimeline: CheckpointEntry[]
  incidentSummary: {
    total: number
    bySeverity: { LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number }
  }
}

export interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-EC', {
    timeZone: DEFAULT_TIMEZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ON_TIME: {
    label: 'A tiempo',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  LATE: {
    label: 'Tarde',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  MISSED: {
    label: 'No escaneado',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
}

// ── Pagination helper — genera array de páginas con elipsis ───────────────────

function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '...')[] = []
  const delta = 1

  const left = Math.max(2, current - delta)
  const right = Math.min(total - 1, current + delta)

  pages.push(1)
  if (left > 2) pages.push('...')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < total - 1) pages.push('...')
  pages.push(total)

  return pages
}

// ── Component ───────────────────────────────────────────────────────────────────

interface PatrolReportDetailProps {
  patrols: PatrolDetail[]
  pagination: Pagination | null
  loading: boolean
  expandedPatrol: string | null
  onToggleExpand: (id: string) => void
  onPageChange: (page: number) => void
  exportButton?: ReactNode
}

export function PatrolReportDetail({
  patrols,
  pagination,
  loading,
  expandedPatrol,
  onToggleExpand,
  onPageChange,
  exportButton,
}: PatrolReportDetailProps) {
  if (loading) {
    return (
      <div className='flex items-center justify-center py-16'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (patrols.length === 0) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
          <Clock className='h-12 w-12 text-muted-foreground/30 mb-4' />
          <p className='text-sm font-medium text-muted-foreground'>Sin patrullas en el período</p>
          <p className='text-xs text-muted-foreground mt-1'>Ajusta los filtros de fecha o área</p>
        </CardContent>
      </Card>
    )
  }

  const totalCount = pagination?.total ?? patrols.length
  const rangeStart = pagination ? (pagination.page - 1) * pagination.limit + 1 : 1
  const rangeEnd = pagination
    ? Math.min(pagination.page * pagination.limit, pagination.total)
    : patrols.length

  return (
    <div className='space-y-3'>
      {/* Barra superior: conteo + exportar */}
      <div className='flex items-center justify-between'>
        <p className='text-xs text-muted-foreground'>
          {pagination && pagination.total > pagination.limit
            ? `Mostrando ${rangeStart}–${rangeEnd} de ${totalCount} patrulla${totalCount !== 1 ? 's' : ''}`
            : `${totalCount} patrulla${totalCount !== 1 ? 's' : ''}`}
        </p>
        {exportButton}
      </div>

      {/* Lista de patrullas */}
      {patrols.map(patrol => (
        <Card key={patrol.id}>
          <CardContent className='p-4'>
            {/* Header row */}
            <div
              className='flex items-center gap-3 cursor-pointer'
              onClick={() => onToggleExpand(patrol.id)}
            >
              {expandedPatrol === patrol.id ? (
                <ChevronDown className='h-4 w-4 text-muted-foreground flex-shrink-0' />
              ) : (
                <ChevronRight className='h-4 w-4 text-muted-foreground flex-shrink-0' />
              )}
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <span className='font-medium text-sm'>{patrol.routeName}</span>
                  <span className='text-xs text-muted-foreground'>— {patrol.agentName}</span>
                  {patrol.isOnTime !== null &&
                    (patrol.isOnTime ? (
                      <CheckCircle2 className='h-3.5 w-3.5 text-green-600' />
                    ) : (
                      <XCircle className='h-3.5 w-3.5 text-red-500' />
                    ))}
                  {patrol.incidentSummary.total > 0 && (
                    <Badge variant='destructive' className='text-[10px] px-1.5 py-0'>
                      {patrol.incidentSummary.total} incidente
                      {patrol.incidentSummary.total > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <div className='flex items-center gap-4 mt-1 text-xs text-muted-foreground'>
                  <span>{formatDate(patrol.scheduledStart)}</span>
                  {patrol.startDelayMinutes !== null && patrol.startDelayMinutes > 0 && (
                    <span className='text-yellow-600'>+{patrol.startDelayMinutes} min retraso</span>
                  )}
                </div>
              </div>
              {/* Barra de completitud */}
              <div className='w-24 flex-shrink-0'>
                <div className='text-xs text-right text-muted-foreground mb-0.5'>
                  {patrol.completionPercentage}%
                </div>
                <div className='w-full bg-muted rounded-full h-2'>
                  <div
                    className='bg-primary h-2 rounded-full transition-all'
                    style={{ width: `${patrol.completionPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Timeline de checkpoints (expandido) */}
            {expandedPatrol === patrol.id && (
              <div className='mt-4 border-t pt-3'>
                <p className='text-xs font-medium text-muted-foreground mb-2'>
                  Línea de tiempo de checkpoints
                </p>
                <div className='overflow-x-auto'>
                  <table className='w-full text-xs'>
                    <thead>
                      <tr className='text-muted-foreground border-b'>
                        <th className='text-left py-1.5 pr-3 font-medium'>#</th>
                        <th className='text-left py-1.5 pr-3 font-medium'>Checkpoint</th>
                        <th className='text-left py-1.5 pr-3 font-medium'>Escaneado</th>
                        <th className='text-left py-1.5 pr-3 font-medium'>Desde anterior</th>
                        <th className='text-left py-1.5 font-medium'>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patrol.checkpointTimeline.map((cp, idx) => (
                        <tr key={idx} className='border-b last:border-0'>
                          <td className='py-1.5 pr-3 text-muted-foreground'>{cp.order}</td>
                          <td className='py-1.5 pr-3'>{cp.checkpointName}</td>
                          <td className='py-1.5 pr-3'>
                            {cp.scannedAt ? formatDate(cp.scannedAt) : '—'}
                          </td>
                          <td className='py-1.5 pr-3'>
                            {cp.timeFromPrevious !== null ? `${cp.timeFromPrevious} min` : '—'}
                          </td>
                          <td className='py-1.5'>
                            <Badge
                              className={`text-[10px] px-1.5 py-0 ${STATUS_BADGE[cp.status]?.className ?? ''}`}
                            >
                              {STATUS_BADGE[cp.status]?.label ?? cp.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Paginación completa */}
      {pagination && pagination.totalPages > 1 && (
        <div className='flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t'>
          {/* Info de página */}
          <p className='text-xs text-muted-foreground order-2 sm:order-1'>
            Página {pagination.page} de {pagination.totalPages} &middot; {pagination.total}{' '}
            resultado{pagination.total !== 1 ? 's' : ''}
          </p>

          {/* Botones de navegación */}
          <div className='flex items-center gap-1 order-1 sm:order-2'>
            {/* Primera */}
            <Button
              size='icon'
              variant='outline'
              className='h-8 w-8'
              disabled={!pagination.hasPrev}
              onClick={() => onPageChange(1)}
              title='Primera página'
            >
              <ChevronsLeft className='h-3.5 w-3.5' />
            </Button>

            {/* Anterior */}
            <Button
              size='icon'
              variant='outline'
              className='h-8 w-8'
              disabled={!pagination.hasPrev}
              onClick={() => onPageChange(pagination.page - 1)}
              title='Página anterior'
            >
              <ChevronLeft className='h-3.5 w-3.5' />
            </Button>

            {/* Números con elipsis */}
            {buildPageNumbers(pagination.page, pagination.totalPages).map((p, idx) =>
              p === '...' ? (
                <span
                  key={`ellipsis-${idx}`}
                  className='px-1 text-muted-foreground text-sm select-none'
                >
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  size='icon'
                  variant={p === pagination.page ? 'default' : 'outline'}
                  className='h-8 w-8 text-xs'
                  onClick={() => onPageChange(p as number)}
                >
                  {p}
                </Button>
              )
            )}

            {/* Siguiente */}
            <Button
              size='icon'
              variant='outline'
              className='h-8 w-8'
              disabled={!pagination.hasNext}
              onClick={() => onPageChange(pagination.page + 1)}
              title='Página siguiente'
            >
              <ChevronRight className='h-3.5 w-3.5' />
            </Button>

            {/* Última */}
            <Button
              size='icon'
              variant='outline'
              className='h-8 w-8'
              disabled={!pagination.hasNext}
              onClick={() => onPageChange(pagination.totalPages)}
              title='Última página'
            >
              <ChevronsRight className='h-3.5 w-3.5' />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
