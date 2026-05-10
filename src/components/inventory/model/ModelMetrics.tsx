import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Package,
  CheckCircle,
  UserCheck,
  Wrench,
  Archive,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react'

interface ModelMetricsData {
  total: number
  available: number
  assigned: number
  maintenance: number
  retired: number
  utilizationRate: number
  totalValue: number
  averagePrice: number
}

interface ModelMetricsProps {
  metrics: ModelMetricsData
}

export function ModelMetrics({ metrics }: ModelMetricsProps) {
  const utilizationColor =
    metrics.utilizationRate > 90
      ? 'text-red-600'
      : metrics.utilizationRate > 70
        ? 'text-yellow-600'
        : 'text-green-600'

  const progressColor =
    metrics.utilizationRate > 90
      ? 'bg-red-500'
      : metrics.utilizationRate > 70
        ? 'bg-yellow-500'
        : 'bg-green-500'

  const showHighDemandAlert = metrics.utilizationRate > 90
  const showLowUtilizationAlert = metrics.utilizationRate < 30 && metrics.total > 0

  return (
    <div className='space-y-4'>
      {/* Alertas */}
      {showHighDemandAlert && (
        <Alert className='border-red-200 bg-red-50'>
          <AlertTriangle className='h-4 w-4 text-red-600' />
          <AlertDescription className='text-red-700'>
            Alta demanda: {metrics.utilizationRate.toFixed(1)}% de los equipos están asignados.
            Considera adquirir más unidades.
          </AlertDescription>
        </Alert>
      )}
      {showLowUtilizationAlert && (
        <Alert className='border-yellow-200 bg-yellow-50'>
          <TrendingDown className='h-4 w-4 text-yellow-600' />
          <AlertDescription className='text-yellow-700'>
            Baja utilización: Solo el {metrics.utilizationRate.toFixed(1)}% de los equipos están en
            uso.
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de métricas */}
      <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-xs font-medium text-muted-foreground flex items-center gap-1'>
              <Package className='w-3 h-3' /> Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold'>{metrics.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-xs font-medium text-muted-foreground flex items-center gap-1'>
              <CheckCircle className='w-3 h-3 text-green-500' /> Disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold text-green-600'>{metrics.available}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-xs font-medium text-muted-foreground flex items-center gap-1'>
              <UserCheck className='w-3 h-3 text-blue-500' /> Asignados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold text-blue-600'>{metrics.assigned}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-xs font-medium text-muted-foreground flex items-center gap-1'>
              <Wrench className='w-3 h-3 text-yellow-500' /> Mantenimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold text-yellow-600'>{metrics.maintenance}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-xs font-medium text-muted-foreground flex items-center gap-1'>
              <DollarSign className='w-3 h-3 text-purple-500' /> Valor Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-lg font-bold text-purple-600'>
              ${metrics.totalValue.toLocaleString('es', { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-xs font-medium text-muted-foreground flex items-center gap-1'>
              <TrendingUp className='w-3 h-3 text-indigo-500' /> Precio Prom.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-lg font-bold text-indigo-600'>
              ${metrics.averagePrice.toLocaleString('es', { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de utilización */}
      <Card>
        <CardContent className='pt-4'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium'>Tasa de Utilización</span>
            <span className={`text-sm font-bold ${utilizationColor}`}>
              {metrics.utilizationRate.toFixed(1)}%
            </span>
          </div>
          <div className='w-full bg-gray-200 rounded-full h-3'>
            <div
              className={`h-3 rounded-full transition-all ${progressColor}`}
              style={{ width: `${Math.min(metrics.utilizationRate, 100)}%` }}
            />
          </div>
          <div className='flex justify-between text-xs text-muted-foreground mt-1'>
            <span>
              {metrics.assigned} asignados de {metrics.total} totales
            </span>
            <span>{metrics.retired > 0 ? `${metrics.retired} retirados` : ''}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
