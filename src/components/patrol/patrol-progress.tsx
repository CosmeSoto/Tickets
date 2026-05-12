'use client'

import { Progress } from '@/components/ui/progress'
import { calculateCompletionPercentage } from '@/lib/patrol/patrol-completion'

interface PatrolProgressProps {
  /** Checkpoints requeridos visitados */
  visitedRequired: number
  /** Total de checkpoints requeridos */
  totalRequired: number
  /** Mostrar fracción numérica además del porcentaje */
  showFraction?: boolean
  className?: string
}

export function PatrolProgress({
  visitedRequired,
  totalRequired,
  showFraction = true,
  className,
}: PatrolProgressProps) {
  const pct = calculateCompletionPercentage(visitedRequired, totalRequired)

  const color =
    pct >= 100
      ? 'text-green-600 dark:text-green-400'
      : pct >= 80
        ? 'text-blue-600 dark:text-blue-400'
        : pct >= 50
          ? 'text-yellow-600 dark:text-yellow-400'
          : 'text-red-600 dark:text-red-400'

  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <div className='flex items-center justify-between text-xs'>
        {showFraction && (
          <span className='text-muted-foreground'>
            {visitedRequired}/{totalRequired} checkpoints
          </span>
        )}
        <span className={`font-semibold ml-auto ${color}`}>{pct}%</span>
      </div>
      <Progress value={pct} className='h-2' />
    </div>
  )
}
