'use client'

import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

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
    timeZone: 'America/Guayaquil',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ON_TIME: { label: 'A tiempo', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  LATE: { label: 'Tarde', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  MISSED: { label: 'No escaneado', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

// ── Component ───────────────────────────────────────────────────────────────────

interface PatrolReportDetailProps {
  patrols: PatrolDetail[]
  pagination: Pagination | null
  loading: boolean
  expandedPatrol: string | null
  onToggleExpand: (id: string) => void
  onPageChange: (page: number) => void
}

export function PatrolReportDetail({
  patrols,
  pagination,
  loading,
  expandedPatrol,
  onToggleExpand,
  onPageChange,
}: PatrolReportDetailProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (patrols.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Sin patrullas en el período</p>
          <p className="text-xs text-muted-foreground mt-1">Ajusta los filtros de fecha o área</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {patrols.map(patrol => (
        <Card key={patrol.id}>
          <CardContent className="p-4">
            {/* Header row */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleExpand(patrol.id)}>
              {expandedPatrol === patrol.id
                ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{patrol.routeName}</span>
                  <span className="text-xs text-muted-foreground">— {patrol.agentName}</span>
                  {patrol.isOnTime !== null && (
                    patrol.isOnTime
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      : <XCircle className="h-3.5 w-3.5 text-red-500" />
                  )}
                  {patrol.incidentSummary.total > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      {patrol.incidentSummary.total} incidente{patrol.incidentSummary.total > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span>{formatDate(patrol.scheduledStart)}</span>
                  {patrol.startDelayMinutes !== null && patrol.startDelayMinutes > 0 && (
                    <span className="text-yellow-600">+{patrol.startDelayMinutes} min retraso</span>
                  )}
                </div>
              </div>
              {/* Completion bar */}
              <div className="w-24 flex-shrink-0">
                <div className="text-xs text-right text-muted-foreground mb-0.5">
                  {patrol.completionPercentage}%
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${patrol.completionPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Expanded checkpoint timeline */}
            {expandedPatrol === patrol.id && (
              <div className="mt-4 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Línea de tiempo de checkpoints</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="text-left py-1.5 pr-3 font-medium">#</th>
                        <th className="text-left py-1.5 pr-3 font-medium">Checkpoint</th>
                        <th className="text-left py-1.5 pr-3 font-medium">Escaneado</th>
                        <th className="text-left py-1.5 pr-3 font-medium">Desde anterior</th>
                        <th className="text-left py-1.5 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patrol.checkpointTimeline.map((cp, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="py-1.5 pr-3 text-muted-foreground">{cp.order}</td>
                          <td className="py-1.5 pr-3">{cp.checkpointName}</td>
                          <td className="py-1.5 pr-3">{cp.scannedAt ? formatDate(cp.scannedAt) : '—'}</td>
                          <td className="py-1.5 pr-3">
                            {cp.timeFromPrevious !== null ? `${cp.timeFromPrevious} min` : '—'}
                          </td>
                          <td className="py-1.5">
                            <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_BADGE[cp.status]?.className ?? ''}`}>
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-muted-foreground">
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} patrullas)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!pagination.hasPrev}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!pagination.hasNext}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
