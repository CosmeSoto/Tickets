import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingDown, Calculator } from 'lucide-react'
import type { BatchDepreciationSummary as BatchDepreciationSummaryType } from '@/types/inventory/batch-inventory'

interface BatchDepreciationSummaryProps {
  summary: BatchDepreciationSummaryType
}

function formatMoney(value: number) {
  return value.toLocaleString('es-CL', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function BatchDepreciationSummary({ summary }: BatchDepreciationSummaryProps) {
  const avgBook =
    summary.equipmentWithDepreciation > 0
      ? summary.totalBookValue / summary.equipmentWithDepreciation
      : 0

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base flex items-center gap-2'>
          <Calculator className='w-4 h-4' />
          Depreciación del Lote
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
          <div>
            <p className='text-xs text-muted-foreground'>Método</p>
            <p className='font-medium'>{summary.methodLabel}</p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground'>Vida útil</p>
            <p className='font-medium'>{summary.usefulLifeYears} años</p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground'>Valor residual (c/u)</p>
            <p className='font-medium'>{formatMoney(summary.residualValuePerUnit)}</p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground'>Equipos con depreciación</p>
            <p className='font-medium'>
              {summary.equipmentWithDepreciation} / {summary.totalUnits}
            </p>
          </div>
        </div>

        <div className='mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3'>
          <div className='rounded-lg border bg-muted/30 p-3'>
            <p className='text-xs text-muted-foreground'>Valor en libros (total)</p>
            <p className='text-lg font-semibold text-green-700 dark:text-green-400'>
              {formatMoney(summary.totalBookValue)}
            </p>
            <p className='text-xs text-muted-foreground mt-0.5'>
              ~{formatMoney(avgBook)} por equipo
            </p>
          </div>
          <div className='rounded-lg border bg-muted/30 p-3'>
            <p className='text-xs text-muted-foreground flex items-center gap-1'>
              <TrendingDown className='w-3 h-3' />
              Depreciación acumulada
            </p>
            <p className='text-lg font-semibold'>
              {formatMoney(summary.totalAccumulatedDepreciation)}
            </p>
          </div>
          <div className='rounded-lg border bg-muted/30 p-3'>
            <p className='text-xs text-muted-foreground'>Costo original (total)</p>
            <p className='text-lg font-semibold'>{formatMoney(summary.totalPurchaseValue)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
