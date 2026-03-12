'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  Target,
  Timer
} from 'lucide-react'

interface SLAMetrics {
  totalWithSLA: number
  slaCompliant: number
  slaBreached: number
  slaComplianceRate: number
  avgSlaResponseTime: string
  criticalSlaBreaches: number
  upcomingSlaDeadlines: number
  slaByPriority: Record<string, {
    total: number
    compliant: number
    breached: number
    complianceRate: number
  }>
}

interface SLAMetricsCardProps {
  slaMetrics: SLAMetrics
  loading?: boolean
}

export function SLAMetricsCard({ slaMetrics, loading = false }: SLAMetricsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Cumplimiento de Acuerdos de Nivel de Servicio (SLA)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (slaMetrics.totalWithSLA === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Cumplimiento de Acuerdos de Nivel de Servicio (SLA)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              No hay tickets con SLA definido
            </p>
            <p className="text-sm text-muted-foreground">
              Los tickets con SLA aparecerán aquí una vez que se creen
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getComplianceColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600'
    if (rate >= 85) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getComplianceBgColor = (rate: number) => {
    if (rate >= 95) return 'bg-green-50 border-green-200'
    if (rate >= 85) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  const priorityLabels: Record<string, string> = {
    URGENT: 'Urgente',
    HIGH: 'Alta',
    MEDIUM: 'Media',
    LOW: 'Baja'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Cumplimiento de Acuerdos de Nivel de Servicio (SLA)</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Monitoreo del cumplimiento de tiempos de respuesta y resolución comprometidos
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Indicador Principal de Cumplimiento */}
        <div className={`p-6 rounded-lg border-2 ${getComplianceBgColor(slaMetrics.slaComplianceRate)}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Cumplimiento General
              </p>
              <p className={`text-4xl font-bold ${getComplianceColor(slaMetrics.slaComplianceRate)}`}>
                {slaMetrics.slaComplianceRate.toFixed(1)}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Tickets con SLA</p>
              <p className="text-2xl font-semibold">{slaMetrics.totalWithSLA}</p>
            </div>
          </div>
          <Progress 
            value={slaMetrics.slaComplianceRate} 
            className="h-3"
          />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {slaMetrics.slaCompliant} cumplidos de {slaMetrics.totalWithSLA} tickets totales
          </p>
        </div>

        {/* Resumen de Estados */}
        <div>
          <h4 className="font-semibold text-sm mb-3 flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Resumen de Estados</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Cumplidos */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold text-green-600">
                  {slaMetrics.slaCompliant}
                </span>
              </div>
              <p className="text-sm font-medium text-green-700">Cumplidos</p>
              <p className="text-xs text-green-600 mt-1">
                Respondidos dentro del tiempo comprometido
              </p>
            </div>

            {/* Incumplidos */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="text-2xl font-bold text-red-600">
                  {slaMetrics.slaBreached}
                </span>
              </div>
              <p className="text-sm font-medium text-red-700">Incumplidos</p>
              <p className="text-xs text-red-600 mt-1">
                Excedieron el tiempo de respuesta comprometido
              </p>
            </div>

            {/* Próximos a Vencer */}
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <span className="text-2xl font-bold text-orange-600">
                  {slaMetrics.upcomingSlaDeadlines}
                </span>
              </div>
              <p className="text-sm font-medium text-orange-700">Próximos a Vencer</p>
              <p className="text-xs text-orange-600 mt-1">
                Vencen en las próximas 4 horas
              </p>
            </div>
          </div>
        </div>

        {/* Alertas Críticas */}
        {slaMetrics.criticalSlaBreaches > 0 && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
            <div className="flex items-start space-x-3">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-red-700 mb-1">
                  ⚠️ Atención: {slaMetrics.criticalSlaBreaches} ticket{slaMetrics.criticalSlaBreaches > 1 ? 's' : ''} crítico{slaMetrics.criticalSlaBreaches > 1 ? 's' : ''} con SLA incumplido
                </p>
                <p className="text-sm text-red-600">
                  Estos tickets requieren atención inmediata para evitar impacto en el servicio
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cumplimiento por Prioridad */}
        {Object.keys(slaMetrics.slaByPriority).length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-3 flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Cumplimiento por Nivel de Prioridad</span>
            </h4>
            <div className="space-y-3">
              {Object.entries(slaMetrics.slaByPriority)
                .filter(([_, data]) => data.total > 0)
                .sort(([a], [b]) => {
                  const order = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
                  return order[a as keyof typeof order] - order[b as keyof typeof order]
                })
                .map(([priority, data]) => (
                  <div key={priority} className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant={
                            priority === 'URGENT' ? 'destructive' :
                            priority === 'HIGH' ? 'secondary' :
                            'outline'
                          }
                        >
                          {priorityLabels[priority] || priority}
                        </Badge>
                        <span className="text-sm font-medium">
                          {data.compliant} de {data.total} cumplidos
                        </span>
                      </div>
                      <span className={`text-lg font-bold ${getComplianceColor(data.complianceRate)}`}>
                        {data.complianceRate.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={data.complianceRate} 
                      className="h-2"
                    />
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Tiempo Promedio de Primera Respuesta */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Timer className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Tiempo Promedio de Primera Respuesta
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Tiempo que tardamos en dar la primera respuesta
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">
                {slaMetrics.avgSlaResponseTime}
              </p>
            </div>
          </div>
        </div>

        {/* Nota Informativa */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded border border-muted">
          <p className="font-medium mb-1">ℹ️ Acerca de las métricas SLA:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Los SLA definen el tiempo máximo de respuesta según la prioridad del ticket</li>
            <li>Un ticket "cumplido" fue respondido dentro del tiempo comprometido</li>
            <li>Un ticket "incumplido" excedió el tiempo de respuesta establecido</li>
            <li>Los tickets "próximos a vencer" requieren atención en las próximas 4 horas</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
