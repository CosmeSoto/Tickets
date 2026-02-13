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
  Target
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
            <span>Métricas de SLA</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
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
            <span>Métricas de SLA</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay tickets con SLA definido</p>
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

  const getComplianceBadgeVariant = (rate: number) => {
    if (rate >= 95) return 'default'
    if (rate >= 85) return 'secondary'
    return 'destructive'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Métricas de SLA</span>
          </div>
          <Badge 
            variant={getComplianceBadgeVariant(slaMetrics.slaComplianceRate)}
            className="text-sm"
          >
            {slaMetrics.slaComplianceRate.toFixed(1)}% Cumplimiento
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumen General */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{slaMetrics.totalWithSLA}</div>
            <div className="text-sm text-blue-700">Total con SLA</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{slaMetrics.slaCompliant}</div>
            <div className="text-sm text-green-700">Cumplidos</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{slaMetrics.slaBreached}</div>
            <div className="text-sm text-red-700">Incumplidos</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{slaMetrics.upcomingSlaDeadlines}</div>
            <div className="text-sm text-orange-700">Próximos a vencer</div>
          </div>
        </div>

        {/* Barra de Progreso General */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Cumplimiento General de SLA</span>
            <span className={`text-sm font-bold ${getComplianceColor(slaMetrics.slaComplianceRate)}`}>
              {slaMetrics.slaComplianceRate.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={slaMetrics.slaComplianceRate} 
            className="h-3"
          />
        </div>

        {/* Alertas Críticas */}
        {(slaMetrics.criticalSlaBreaches > 0 || slaMetrics.upcomingSlaDeadlines > 0) && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>Alertas SLA</span>
            </h4>
            <div className="space-y-2">
              {slaMetrics.criticalSlaBreaches > 0 && (
                <div className="flex items-center justify-between p-2 bg-red-50 rounded border-l-4 border-red-500">
                  <div className="flex items-center space-x-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-700">SLA críticos incumplidos</span>
                  </div>
                  <Badge variant="destructive">{slaMetrics.criticalSlaBreaches}</Badge>
                </div>
              )}
              {slaMetrics.upcomingSlaDeadlines > 0 && (
                <div className="flex items-center justify-between p-2 bg-orange-50 rounded border-l-4 border-orange-500">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-orange-700">SLA próximos a vencer (4h)</span>
                  </div>
                  <Badge variant="secondary">{slaMetrics.upcomingSlaDeadlines}</Badge>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Métricas por Prioridad */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Cumplimiento por Prioridad</span>
          </h4>
          <div className="space-y-3">
            {Object.entries(slaMetrics.slaByPriority)
              .filter(([_, data]) => data.total > 0)
              .sort(([a], [b]) => {
                const order = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
                return order[a as keyof typeof order] - order[b as keyof typeof order]
              })
              .map(([priority, data]) => (
                <div key={priority} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={
                          priority === 'URGENT' ? 'destructive' :
                          priority === 'HIGH' ? 'secondary' :
                          priority === 'MEDIUM' ? 'outline' : 'default'
                        }
                        className="text-xs"
                      >
                        {priority === 'URGENT' ? 'Urgente' :
                         priority === 'HIGH' ? 'Alta' :
                         priority === 'MEDIUM' ? 'Media' : 'Baja'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {data.compliant}/{data.total}
                      </span>
                    </div>
                    <span className={`text-sm font-medium ${getComplianceColor(data.complianceRate)}`}>
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

        {/* Tiempo Promedio de Respuesta */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">Tiempo Promedio de Primera Respuesta</span>
          </div>
          <span className="text-sm font-bold text-green-600">
            {slaMetrics.avgSlaResponseTime}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}