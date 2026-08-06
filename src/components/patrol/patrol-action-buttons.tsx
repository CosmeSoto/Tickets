'use client'

/**
 * PatrolActionButtons
 * Botones de acción principal durante la ejecución de una ronda:
 * - Estado PENDING: botón Iniciar
 * - Estado IN_PROGRESS: Escanear QR + Finalizar (con indicador de bloqueo)
 * - Progreso 100%: CTA destacado para finalizar
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
  /** Todos los obligatorios visitados — resaltar Finalizar */
  readyToFinish?: boolean
  /** Bloqueo por ventana horaria (fuera del turno programado) */
  startBlockedReason?: string | null
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
  readyToFinish = false,
  startBlockedReason = null,
  onStart,
  onToggleScanner,
  onEnd,
  onOpenIncident,
}: PatrolActionButtonsProps) {
  const isPending = status === 'PENDING'
  const isInProgress = status === 'IN_PROGRESS'
  const startBlocked = Boolean(startBlockedReason)

  return (
    <>
      {/* ── Iniciar ── */}
      {isPending && (
        <div className='space-y-2'>
          <Button
            className='w-full h-12 text-base'
            onClick={onStart}
            disabled={startingPatrol || startBlocked}
            title={startBlockedReason ?? undefined}
          >
            {startingPatrol ? (
              <Loader2 className='h-5 w-5 mr-2 animate-spin' />
            ) : (
              <Play className='h-5 w-5 mr-2' />
            )}
            Iniciar Ronda
          </Button>
          {startBlocked && startBlockedReason && (
            <p className='text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5'>
              <AlertTriangle className='h-3.5 w-3.5 mt-0.5 shrink-0' />
              <span>{startBlockedReason}</span>
            </p>
          )}
        </div>
      )}

      {/* ── CTA cuando ya visitó todos los obligatorios ── */}
      {isInProgress && readyToFinish && (
        <div className='rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 p-3 space-y-2'>
          <p className='text-sm text-emerald-900 dark:text-emerald-100 font-medium'>
            Completaste todos los puntos obligatorios. Cierra la ronda para registrar el
            cumplimiento.
          </p>
          <Button
            className='w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700'
            onClick={onEnd}
            disabled={endingPatrol || !canFinish}
            title={!canFinish ? 'Reporta una novedad por el checkpoint saltado primero' : undefined}
          >
            {endingPatrol ? (
              <Loader2 className='h-5 w-5 mr-2 animate-spin' />
            ) : (
              <CheckCircle2 className='h-5 w-5 mr-2' />
            )}
            Finalizar ronda
          </Button>
        </div>
      )}

      {/* ── Escanear QR (+ Finalizar si aún no está listo al 100%) ── */}
      {isInProgress && (
        <div className={readyToFinish ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
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

          {!readyToFinish && (
            <Button
              variant='outline'
              className='h-12 relative'
              onClick={onEnd}
              disabled={endingPatrol}
              title={
                !canFinish ? 'Reporta una novedad por el checkpoint saltado primero' : undefined
              }
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
          )}
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
