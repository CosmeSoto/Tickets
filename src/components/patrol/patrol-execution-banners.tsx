'use client'

/**
 * PatrolExecutionBanners
 * Banners contextuales durante la ejecución de una ronda:
 * - Info: política de checkpoints (máx. 1 skip)
 * - Advertencia: checkpoint saltado, novedad requerida antes de finalizar
 */

import { Info, SkipForward } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { SkippedCheckpoint } from '@/hooks/use-patrol-execution'

interface PatrolExecutionBannersProps {
  skippedCheckpoints: SkippedCheckpoint[]
  requiresIncidentForSkip: boolean
  onOpenIncidentDialog: () => void
}

export function PatrolExecutionBanners({
  skippedCheckpoints,
  requiresIncidentForSkip,
  onOpenIncidentDialog,
}: PatrolExecutionBannersProps) {
  const hasSkip = skippedCheckpoints.length > 0 && requiresIncidentForSkip

  return (
    <>
      {/* Info: política de tolerancia — solo mientras no haya skip activo */}
      {!hasSkip && (
        <Alert className='border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 py-2'>
          <Info className='h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0' />
          <AlertDescription className='text-xs text-blue-700 dark:text-blue-300 ml-2'>
            Puedes saltar <strong>máximo 1 checkpoint</strong> por contratiempo. Si saltas 2 o más
            consecutivos, la ronda se cierra automáticamente.
          </AlertDescription>
        </Alert>
      )}

      {/* Advertencia: checkpoint saltado — novedad obligatoria */}
      {hasSkip && (
        <Alert className='border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 py-2'>
          <SkipForward className='h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0' />
          <AlertDescription className='text-xs text-orange-700 dark:text-orange-300 ml-2'>
            <strong>Checkpoint saltado:</strong>{' '}
            {skippedCheckpoints.map(c => `#${c.order} ${c.name}`).join(', ')}. Debes{' '}
            <button className='underline font-semibold' onClick={onOpenIncidentDialog}>
              reportar una novedad
            </button>{' '}
            antes de finalizar.
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}
