'use client'

/**
 * PatrolActionButtons
 * Botones de acción principal durante la ejecución de una ronda:
 * - Estado PENDING: botón Iniciar
 * - Estado IN_PROGRESS: Escanear QR + Finalizar (con indicador de bloqueo)
 */

import { Play, CheckCircle2, QrCode, Loader2, AlertTriangle, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PatrolActionButtonsProps {
  status: string
  scannerActive: boolean
  submittingCheckIn: boolean
  startingPatrol: boolean
  endingPatrol: boolean
  /** false cuando hay checkpoint saltado sin novedad reportada */
  canFinish: boolean
  requiresIncidentForSkip: boolean
  hasCheckIns: boolean
  onStart: () => void
  onToggleScanner: () => void
  onEnd: () => void
  onOpenIncident: () => void
}

export function PatrolActionButtons({
  status,
  scannerActive,
  submittingCheckIn,
  startingPatrol,
  endingPatrol,
  canFinish,
  requiresIncidentForSkip,
  hasCheckIns,
  onStart,
  onToggleScanner,
  onEnd,
  onOpenIncident,
}: PatrolActionButtonsProps) {
  const isPending = status === 'PENDING'
  const isInProgress = status === 'IN_PROGRESS'

  return (
    <>
      {/* ── Iniciar ── */}
      {isPending && (
        <Button className='w-full h-12 text-base' onClick={onStart} disabled={startingPatrol}>
          {startingPatrol ? (
            <Loader2 className='h-5 w-5 mr-2 animate-spin' />
          ) : (
            <Play className='h-5 w-5 mr-2' />
          )}
          Iniciar Ronda
        </Button>
      )}

      {/* ── Escanear QR + Finalizar ── */}
      {isInProgress && (
        <div className='grid grid-cols-2 gap-3'>
          <Button
            className='h-12'
            onClick={onToggleScanner}
            disabled={submittingCheckIn}
            variant={scannerActive ? 'secondary' : 'default'}
          >
            {submittingCheckIn ? (
              <Loader2 className='h-5 w-5 mr-2 animate-spin' />
            ) : (
              <QrCode className='h-5 w-5 mr-2' />
            )}
            {scannerActive ? 'Cerrar' : 'Escanear QR'}
          </Button>

          <Button
            variant='outline'
            className='h-12 relative'
            onClick={onEnd}
            disabled={endingPatrol}
            title={!canFinish ? 'Reporta una novedad por el checkpoint saltado primero' : undefined}
          >
            {endingPatrol ? (
              <Loader2 className='h-5 w-5 mr-2 animate-spin' />
            ) : (
              <CheckCircle2 className='h-5 w-5 mr-2' />
            )}
            Finalizar
            {!canFinish && (
              <AlertTriangle className='h-3.5 w-3.5 text-orange-500 absolute top-1.5 right-1.5' />
            )}
          </Button>
        </div>
      )}

      {/* ── Reportar Novedad ── */}
      {isInProgress && (
        <Button
          variant={requiresIncidentForSkip ? 'destructive' : 'outline'}
          size='sm'
          className='gap-2 w-full sm:w-auto'
          onClick={onOpenIncident}
          disabled={!hasCheckIns && !requiresIncidentForSkip}
        >
          <ClipboardList className='h-4 w-4' />
          {requiresIncidentForSkip ? '⚠️ Reportar Novedad (requerida)' : 'Reportar Novedad'}
        </Button>
      )}
    </>
  )
}
