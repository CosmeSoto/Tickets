'use client'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

/**
 * Página de ejecución de ronda de patrulla.
 * Orquesta los sub-componentes del módulo patrol y el hook usePatrolExecution.
 * Toda la lógica de estado y API vive en usePatrolExecution.
 */

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { IncidentFormDialog } from '@/components/patrols/incidents/incident-form-dialog'

import {
  PatrolStatusBadge,
  PatrolOfflineIndicator,
  PatrolProgressCard,
  PatrolExecutionBanners,
  PatrolPhotoCard,
  PatrolActionButtons,
  PatrolCheckpointList,
  PatrolCheckInCard,
  PatrolIncidentsList,
  PatrolCheckpointScanner,
} from '@/components/patrol'

import { usePatrolData } from '@/hooks/use-patrol-data'
import { usePatrolExecution } from '@/hooks/use-patrol-execution'

export default function PatrolExecutionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const patrolId = params.id as string

  const { patrol, loading, error, refresh } = usePatrolData(patrolId)
  const exec = usePatrolExecution(patrolId, patrol, refresh)

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    // ADMIN siempre puede ver/monitorear rondas.
    // TECHNICIAN y CLIENT necesitan patrolsEnabled.
    const role = (session.user as any).role
    if (role !== 'ADMIN' && (session.user as any).patrolsEnabled !== true) {
      router.push('/unauthorized')
      return
    }
  }, [session, status, router])

  if (status === 'loading' || !session) return null
  if (loading)
    return (
      <ModuleLayout title='Cargando ronda...' loading>
        {null}
      </ModuleLayout>
    )
  if (error || !patrol) {
    return (
      <ModuleLayout
        title='Ronda no encontrada'
        error={error ?? 'Patrulla no encontrada'}
        onRetry={refresh}
      >
        {null}
      </ModuleLayout>
    )
  }

  // ── Datos derivados ─────────────────────────────────────────────────────────
  const visitedIds = new Set(patrol.checkIns.map(ci => ci.checkpointId))
  const checkpoints = patrol.route.routeCheckpoints
  const nextCheckpoint = checkpoints.find(rc => !visitedIds.has(rc.checkpoint.id))
  const isInProgress = patrol.status === 'IN_PROGRESS'

  // El agente asignado es el único que puede operar (escanear, finalizar, reportar).
  // Admins y supervisores son observadores — solo ven el progreso.
  const isAssignedAgent = patrol.agentId === session.user.id
  const isObserver = !isAssignedAgent

  const scheduledLabel = new Date(patrol.scheduledStart).toLocaleString('es-EC', {
    timeZone: DEFAULT_TIMEZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  })

  // Ventana horaria: inicio − gracia … fin + gracia (misma regla que el API)
  let startBlockedReason: string | null = null
  if (patrol.status === 'PENDING' && patrol.familyConfig?.strictTimeValidation !== false) {
    const grace = (patrol.familyConfig?.gracePeriodMinutes ?? 5) * 60 * 1000
    const now = Date.now()
    const earliest = new Date(patrol.scheduledStart).getTime() - grace
    const latest = new Date(patrol.scheduledEnd).getTime() + grace
    if (now < earliest) {
      const mins = Math.ceil((new Date(patrol.scheduledStart).getTime() - now) / 60000)
      const h = Math.floor(mins / 60)
      const m = mins % 60
      const timeLabel = h > 0 && m > 0 ? `${h}h ${m}min` : h > 0 ? `${h}h` : `${m} min`
      startBlockedReason = `Fuera de horario: faltan ${timeLabel} para poder iniciar esta ronda.`
    } else if (now > latest) {
      startBlockedReason = 'Fuera de horario: la ventana programada para esta ronda ya finalizó.'
    }
  }

  return (
    <ModuleLayout
      title={patrol.route.name}
      subtitle={scheduledLabel}
      headerActions={
        <div className='flex items-center gap-2 flex-wrap'>
          <PatrolOfflineIndicator isOnline={exec.isOnline} queuedCount={exec.queuedCount} />
          <PatrolStatusBadge status={patrol.status} />
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              const role = (session?.user as any)?.role
              router.push(role === 'ADMIN' ? '/admin/patrols' : '/patrol')
            }}
            className='gap-1'
          >
            <ArrowLeft className='h-4 w-4' /> Volver
          </Button>
        </div>
      }
    >
      <div className='space-y-4 max-w-2xl mx-auto'>
        {/* 1. Progreso + tiempo estimado */}
        <PatrolProgressCard
          visitedRequired={patrol.progress.visitedRequired}
          totalRequired={patrol.progress.totalRequired}
          estimatedDurationMinutes={patrol.route.estimatedDurationMinutes}
          checkpointCount={checkpoints.length}
        />

        {/* 2. Banners contextuales (info / advertencia skip) */}
        {isInProgress && (
          <PatrolExecutionBanners
            skippedCheckpoints={exec.skippedCheckpoints}
            requiresIncidentForSkip={exec.requiresIncidentForSkip}
            onOpenIncidentDialog={() => exec.setIncidentDialogOpen(true)}
          />
        )}

        {/* 3. Foto requerida (inicio/fin) — solo para el agente */}
        {!isObserver && exec.photoAction && (
          <PatrolPhotoCard
            action={exec.photoAction}
            photoPreview={exec.photoPreview}
            onPhotoChange={exec.handlePhotoChange}
            onClearPhoto={exec.clearPhoto}
          />
        )}

        {/* 4. Botones de acción + Reportar Novedad — solo para el agente asignado */}
        {!isObserver && (
          <PatrolActionButtons
            status={patrol.status}
            scannerActive={exec.scannerActive}
            submittingCheckIn={exec.submittingCheckIn}
            startingPatrol={exec.startingPatrol}
            endingPatrol={exec.endingPatrol}
            canFinish={!exec.requiresIncidentForSkip}
            requiresIncidentForSkip={exec.requiresIncidentForSkip}
            hasCheckIns={patrol.checkIns.length > 0}
            startBlockedReason={startBlockedReason}
            onStart={exec.handleStart}
            onToggleScanner={() => exec.setScannerActive(s => !s)}
            onEnd={exec.handleEnd}
            onOpenIncident={() => exec.openIncidentDialog(checkpoints, patrol.checkIns)}
          />
        )}

        {/* Banner modo observador — visible solo para admin/supervisor */}
        {isObserver && isInProgress && (
          <Card className='border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800'>
            <CardContent className='pt-4 pb-3 flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200'>
              <span className='text-base'>👁️</span>
              <span>
                <strong>Modo observador</strong> — estás monitoreando esta ronda en tiempo real.
                Solo el agente asignado puede operar.
              </span>
            </CardContent>
          </Card>
        )}

        {/* 5. Scanner QR — solo para el agente asignado */}
        {!isObserver && exec.scannerActive && (
          <Card>
            <CardContent className='pt-4'>
              <PatrolCheckpointScanner
                active={exec.scannerActive}
                onScan={exec.handleScan}
                onError={msg => {
                  exec.setScannerActive(false)
                  // El PatrolCheckpointScanner ya muestra su propio mensaje
                  console.warn('[Scanner]', msg)
                }}
              />
              <p className='text-xs text-center text-muted-foreground mt-2'>
                Apunta la cámara al código QR del checkpoint
              </p>
            </CardContent>
          </Card>
        )}

        {/* 6. Lista de checkpoints con tiempos estimados */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm'>Checkpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <PatrolCheckpointList
              checkpoints={checkpoints.map(rc => ({
                ...rc.checkpoint,
                order: rc.order,
                isRequired: rc.isRequired,
              }))}
              visitedIds={visitedIds}
              currentCheckpointId={nextCheckpoint?.checkpoint.id}
              estimatedDurationMinutes={patrol.route.estimatedDurationMinutes}
              scheduledStart={patrol.scheduledStart}
              onCheckpointClick={
                isInProgress && !isObserver ? () => exec.setScannerActive(true) : undefined
              }
            />
          </CardContent>
        </Card>

        {/* 7. Historial de check-ins */}
        {patrol.checkIns.length > 0 && (
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm'>Historial de check-ins</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {[...patrol.checkIns].reverse().map(ci => (
                <PatrolCheckInCard
                  key={ci.id}
                  checkIn={{
                    ...ci,
                    checkpoint: checkpoints.find(rc => rc.checkpoint.id === ci.checkpointId)
                      ?.checkpoint,
                  }}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* 8. Novedades reportadas */}
        <PatrolIncidentsList incidents={exec.patrolIncidents} />
      </div>

      {/* Dialog de novedad — solo disponible para el agente asignado */}
      {!isObserver && (
        <IncidentFormDialog
          open={exec.incidentDialogOpen}
          onOpenChange={exec.setIncidentDialogOpen}
          mode='create'
          patrolId={patrolId}
          checkpointId={exec.incidentCheckpointId}
          checkpointName={exec.incidentCheckpointName}
          onSuccess={exec.handleIncidentSuccess}
        />
      )}
    </ModuleLayout>
  )
}
