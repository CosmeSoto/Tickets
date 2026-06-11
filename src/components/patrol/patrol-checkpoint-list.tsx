'use client'

import { CheckCircle2, Circle, PlayCircle, Lock, Wifi, WifiOff, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Checkpoint {
  id: string
  name: string
  location: string
  order: number
  isRequired: boolean
  qrType: 'DYNAMIC' | 'STATIC'
  isSensitive: boolean
  isActive: boolean
}

interface PatrolCheckpointListProps {
  checkpoints: Checkpoint[]
  visitedIds: Set<string>
  currentCheckpointId?: string | null
  onCheckpointClick?: (checkpoint: Checkpoint) => void
  /** Duración estimada total de la ruta en minutos — para calcular tiempo entre checkpoints */
  estimatedDurationMinutes?: number
  /** Inicio programado de la ronda — para calcular hora estimada de cada checkpoint */
  scheduledStart?: string | null
  className?: string
}

/** Formatea una Date a HH:MM */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function PatrolCheckpointList({
  checkpoints,
  visitedIds,
  currentCheckpointId,
  onCheckpointClick,
  estimatedDurationMinutes,
  scheduledStart,
  className,
}: PatrolCheckpointListProps) {
  const totalCheckpoints = checkpoints.length

  // Minutos entre cada checkpoint (distribución uniforme)
  const minutesPerCheckpoint =
    estimatedDurationMinutes && totalCheckpoints > 0
      ? Math.round(estimatedDurationMinutes / totalCheckpoints)
      : null

  // Hora de inicio para calcular llegada estimada a cada punto
  const startDate = scheduledStart ? new Date(scheduledStart) : null

  /**
   * Calcula la hora estimada de llegada a un checkpoint según su posición (0-indexed).
   * Checkpoint 0 (entrada) → scheduledStart
   * Checkpoint N → scheduledStart + N * minutesPerCheckpoint
   */
  const getEstimatedArrival = (idx: number): string | null => {
    if (!startDate || !minutesPerCheckpoint) return null
    const arrivalMs = startDate.getTime() + idx * minutesPerCheckpoint * 60 * 1000
    return formatTime(new Date(arrivalMs))
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Resumen global de tiempo */}
      {minutesPerCheckpoint !== null && minutesPerCheckpoint > 0 && (
        <div className='flex items-center gap-2 px-1 text-xs text-muted-foreground'>
          <Clock className='h-3.5 w-3.5 flex-shrink-0' />
          <span>
            Tiempo estimado entre checkpoints:{' '}
            <span className='font-medium text-foreground'>
              {minutesPerCheckpoint >= 60
                ? `${Math.floor(minutesPerCheckpoint / 60)}h ${minutesPerCheckpoint % 60 > 0 ? `${minutesPerCheckpoint % 60}min` : ''}`
                : `${minutesPerCheckpoint} min`}
            </span>
          </span>
        </div>
      )}

      <ol className='space-y-2'>
        {checkpoints.map((cp, idx) => {
          const visited = visitedIds.has(cp.id)
          const isCurrent = cp.id === currentCheckpointId
          const isPending = !visited && !isCurrent
          const estimatedArrival = getEstimatedArrival(idx)

          return (
            <li
              key={cp.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                visited &&
                  'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900',
                isCurrent &&
                  'bg-blue-50 border-blue-300 dark:bg-blue-950/20 dark:border-blue-700 ring-1 ring-blue-300',
                isPending && 'bg-card border-border opacity-70',
                onCheckpointClick &&
                  isCurrent &&
                  'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/40'
              )}
              onClick={() => isCurrent && onCheckpointClick?.(cp)}
              role={isCurrent && onCheckpointClick ? 'button' : undefined}
              tabIndex={isCurrent && onCheckpointClick ? 0 : undefined}
              onKeyDown={e => e.key === 'Enter' && isCurrent && onCheckpointClick?.(cp)}
            >
              {/* Icono de estado */}
              <div className='flex-shrink-0 mt-0.5'>
                {visited ? (
                  <CheckCircle2 className='h-5 w-5 text-green-600 dark:text-green-400' />
                ) : isCurrent ? (
                  <PlayCircle className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                ) : (
                  <Circle className='h-5 w-5 text-muted-foreground/40' />
                )}
              </div>

              {/* Contenido */}
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <span className='text-xs text-muted-foreground font-mono'>#{idx + 1}</span>
                  <span
                    className={cn(
                      'text-sm font-medium truncate',
                      visited && 'text-green-700 dark:text-green-400',
                      isCurrent && 'text-blue-700 dark:text-blue-400'
                    )}
                  >
                    {cp.name}
                  </span>
                  {!cp.isRequired && (
                    <Badge variant='outline' className='text-xs py-0 h-4'>
                      Opcional
                    </Badge>
                  )}
                  {cp.isSensitive && (
                    <span className='inline-flex' title='Checkpoint sensible — requiere foto'>
                      <Lock className='h-3 w-3 text-orange-500' aria-hidden />
                    </span>
                  )}
                </div>
                <p className='text-xs text-muted-foreground mt-0.5 truncate'>{cp.location}</p>

                {/* Hora estimada de llegada */}
                {estimatedArrival && (
                  <div
                    className={cn(
                      'flex items-center gap-1 mt-1',
                      visited && 'text-green-600 dark:text-green-400',
                      isCurrent && 'text-blue-600 dark:text-blue-400',
                      isPending && 'text-muted-foreground'
                    )}
                  >
                    <Clock className='h-3 w-3 flex-shrink-0' aria-hidden />
                    <span className='text-xs'>
                      {visited ? 'Estimado: ' : isCurrent ? 'Llegar a las: ' : 'A las '}
                      <span className='font-medium'>{estimatedArrival}</span>
                      {minutesPerCheckpoint && idx > 0 && !visited && (
                        <span className='text-muted-foreground/70'>
                          {' '}
                          (+{minutesPerCheckpoint} min)
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Tipo de QR */}
              <div className='flex-shrink-0'>
                {cp.qrType === 'STATIC' ? (
                  <span className='inline-flex' title='QR estático'>
                    <WifiOff className='h-3.5 w-3.5 text-muted-foreground/60' aria-hidden />
                  </span>
                ) : (
                  <span className='inline-flex' title='QR dinámico'>
                    <Wifi className='h-3.5 w-3.5 text-muted-foreground/60' aria-hidden />
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
