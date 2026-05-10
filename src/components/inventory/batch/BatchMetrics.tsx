import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Package, CheckCircle, UserCheck, Wrench, Archive } from 'lucide-react'
import { BatchMetrics as BatchMetricsType } from '@/types/inventory/batch-inventory'

interface BatchMetricsProps {
  metrics: BatchMetricsType
}

export function BatchMetrics({ metrics }: BatchMetricsProps) {
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

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
              <Package className='w-4 h-4' />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold'>{metrics.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
              <CheckCircle className='w-4 h-4 text-green-500' />
              Disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold text-green-600'>{metrics.available}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
              <UserCheck className='w-4 h-4 text-blue-500' />
              Asignados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold text-blue-600'>{metrics.assigned}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
              <Wrench className='w-4 h-4 text-yellow-500' />
              Mantenimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold text-yellow-600'>{metrics.maintenance}</p>
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
          <div className='w-full bg-gray-200 rounded-full h-2.5'>
            <div
              className={`h-2.5 rounded-full transition-all ${progressColor}`}
              style={{ width: `${Math.min(metrics.utilizationRate, 100)}%` }}
            />
          </div>
          <div className='flex justify-between text-xs text-muted-foreground mt-1'>
            <span>{metrics.assigned} asignados</span>
            <span>{metrics.total} total</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
