'use client'

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
    if (role !== 'ADMIN' && (session.user as any).patrolsEnabled === false) {
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

  const scheduledLabel = new Date(patrol.scheduledStart).toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    dateStyle: 'short',
    timeStyle: 'short',
  })

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
            onClick={() => router.push('/patrol')}
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

        {/* 3. Foto requerida (inicio/fin) */}
        {exec.photoAction && (
          <PatrolPhotoCard
            action={exec.photoAction}
            photoPreview={exec.photoPreview}
            onPhotoChange={exec.handlePhotoChange}
            onClearPhoto={exec.clearPhoto}
          />
        )}

        {/* 4. Botones de acción + Reportar Novedad */}
        <PatrolActionButtons
          status={patrol.status}
          scannerActive={exec.scannerActive}
          submittingCheckIn={exec.submittingCheckIn}
          startingPatrol={exec.startingPatrol}
          endingPatrol={exec.endingPatrol}
          canFinish={!exec.requiresIncidentForSkip}
          requiresIncidentForSkip={exec.requiresIncidentForSkip}
          hasCheckIns={patrol.checkIns.length > 0}
          onStart={exec.handleStart}
          onToggleScanner={() => exec.setScannerActive(s => !s)}
          onEnd={exec.handleEnd}
          onOpenIncident={() => exec.openIncidentDialog(checkpoints, patrol.checkIns)}
        />

        {/* 5. Scanner QR */}
        {exec.scannerActive && (
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
              onCheckpointClick={isInProgress ? () => exec.setScannerActive(true) : undefined}
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

      {/* Dialog de novedad (portal) */}
      <IncidentFormDialog
        open={exec.incidentDialogOpen}
        onOpenChange={exec.setIncidentDialogOpen}
        mode='create'
        patrolId={patrolId}
        checkpointId={exec.incidentCheckpointId}
        checkpointName={exec.incidentCheckpointName}
        onSuccess={exec.handleIncidentSuccess}
      />
    </ModuleLayout>
  )
}
