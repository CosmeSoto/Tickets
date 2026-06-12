'use client'

/**
 * PatrolProgressCard
 * Tarjeta de progreso de la ronda: barra de porcentaje + resumen de tiempo estimado.
 */

import { Card, CardContent } from '@/components/ui/card'
import { PatrolProgress } from '@/components/patrol/patrol-progress'
import { formatDurationMinutes } from '@/lib/utils/patrol-utils'

interface PatrolProgressCardProps {
  visitedRequired: number
  totalRequired: number
  estimatedDurationMinutes: number
  checkpointCount: number
}

export function PatrolProgressCard({
  visitedRequired,
  totalRequired,
  estimatedDurationMinutes,
  checkpointCount,
}: PatrolProgressCardProps) {
  return (
    <Card>
      <CardContent className='pt-4 space-y-3'>
        <PatrolProgress visitedRequired={visitedRequired} totalRequired={totalRequired} />

        {estimatedDurationMinutes > 0 && (
          <div className='flex items-center justify-between text-xs text-muted-foreground border-t pt-2'>
            <span className='flex items-center gap-1'>
              ⏱ Duración estimada:{' '}
              <span className='font-medium text-foreground ml-1'>
                {formatDurationMinutes(estimatedDurationMinutes)}
              </span>
            </span>
            {checkpointCount > 0 && (
              <span>~{Math.round(estimatedDurationMinutes / checkpointCount)} min/checkpoint</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
