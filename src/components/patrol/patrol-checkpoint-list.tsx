'use client'

import { CheckCircle2, Circle, PlayCircle, Lock, Wifi, WifiOff } from 'lucide-react'
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
  /** IDs de checkpoints ya visitados (check-in VALID) */
  visitedIds: Set<string>
  /** ID del checkpoint actualmente activo (siguiente a visitar) */
  currentCheckpointId?: string | null
  onCheckpointClick?: (checkpoint: Checkpoint) => void
  className?: string
}

export function PatrolCheckpointList({
  checkpoints,
  visitedIds,
  currentCheckpointId,
  onCheckpointClick,
  className,
}: PatrolCheckpointListProps) {
  return (
    <ol className={cn('space-y-2', className)}>
      {checkpoints.map((cp, idx) => {
        const visited = visitedIds.has(cp.id)
        const isCurrent = cp.id === currentCheckpointId
        const isPending = !visited && !isCurrent

        return (
          <li
            key={cp.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border transition-colors',
              visited && 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900',
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
  )
}
