'use client'

import { AlertTriangle, MapPin, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface IncidentReport {
  bySeverity: { LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number }
  byStatus: { OPEN: number; RESOLVED: number; ESCALATED: number }
  resolutionStats: {
    avgResolutionMinutes: number
    escalationRate: number
    totalIncidents: number
  }
  hotSpots: Array<{
    checkpointId: string
    checkpointName: string
    location: string
    count: number
  }>
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-400',
  MEDIUM: 'bg-yellow-400',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-600',
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abiertas',
  RESOLVED: 'Resueltas',
  ESCALATED: 'Escaladas',
}

const STATUS_DOTS: Record<string, string> = {
  OPEN: 'bg-red-500',
  RESOLVED: 'bg-green-500',
  ESCALATED: 'bg-blue-500',
}

// ── Component ───────────────────────────────────────────────────────────────────

interface IncidentReportViewProps {
  data: IncidentReport | null
  loading: boolean
}

export function IncidentReportView({ data, loading }: IncidentReportViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Sin datos de incidentes</p>
          <p className="text-xs text-muted-foreground mt-1">Usa los filtros para generar el reporte</p>
        </CardContent>
      </Card>
    )
  }

  const { bySeverity, byStatus, resolutionStats, hotSpots } = data
  const totalSeverity = bySeverity.LOW + bySeverity.MEDIUM + bySeverity.HIGH + bySeverity.CRITICAL

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{resolutionStats.totalIncidents}</p>
            <p className="text-xs text-muted-foreground">Total Incidentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{resolutionStats.escalationRate}%</p>
            <p className="text-xs text-muted-foreground">Tasa de Escalamiento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{resolutionStats.avgResolutionMinutes}</p>
            <p className="text-xs text-muted-foreground">Tiempo promedio de resolución (min)</p>
          </CardContent>
        </Card>
      </div>

      {/* Severity breakdown */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-3">Distribución por Severidad</p>
          {totalSeverity === 0 ? (
            <p className="text-xs text-muted-foreground">Sin incidentes registrados</p>
          ) : (
            <div className="space-y-2">
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(sev => {
                const count = bySeverity[sev]
                const pct = Math.round((count / totalSeverity) * 100)
                return (
                  <div key={sev} className="flex items-center gap-3">
                    <span className="text-xs w-16">{SEVERITY_LABELS[sev]}</span>
                    <div className="flex-1 bg-muted rounded-full h-3">
                      <div
                        className={`${SEVERITY_COLORS[sev]} h-3 rounded-full transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {count} ({pct}%)
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status breakdown */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-3">Estado de Incidentes</p>
          <div className="flex flex-wrap gap-4">
            {(['OPEN', 'RESOLVED', 'ESCALATED'] as const).map(st => (
              <div key={st} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOTS[st]}`} />
                <span className="text-sm">{STATUS_LABELS[st]}</span>
                <Badge variant="secondary" className="text-xs">{byStatus[st]}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hot spots */}
      {hotSpots.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-3">Puntos Críticos (Top 10)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-2 pr-3 font-medium">#</th>
                    <th className="text-left py-2 pr-3 font-medium">Checkpoint</th>
                    <th className="text-left py-2 pr-3 font-medium">Ubicación</th>
                    <th className="text-right py-2 font-medium">Incidentes</th>
                  </tr>
                </thead>
                <tbody>
                  {hotSpots.map((spot, idx) => (
                    <tr key={spot.checkpointId} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 pr-3 font-medium">{spot.checkpointName}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {spot.location || '—'}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <Badge variant="destructive" className="text-[10px]">{spot.count}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
