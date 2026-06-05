'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Play, CheckCircle2, Loader2, Camera, Upload, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { usePatrolData } from '@/hooks/use-patrol-data'
import { usePatrolOfflineQueue } from '@/hooks/use-patrol-offline-queue'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { PatrolStatusBadge } from '@/components/patrol/patrol-status-badge'
import { PatrolProgress } from '@/components/patrol/patrol-progress'
import { PatrolCheckpointList } from '@/components/patrol/patrol-checkpoint-list'
import { PatrolCheckInCard } from '@/components/patrol/patrol-checkin-card'
import { PatrolOfflineIndicator } from '@/components/patrol/patrol-offline-indicator'
import { PatrolCheckpointScanner } from '@/components/patrol/patrol-checkpoint-scanner'
import { PatrolIncidentButton } from '@/components/patrol/patrol-incident-button'
import { FileInputWithCamera } from '@/components/common/file-input-with-camera'
import { compressImageFile, fileToBase64 } from '@/lib/utils/image-utils'
import { formatDurationMinutes } from '@/lib/utils/patrol-utils'

export default function PatrolExecutionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const patrolId = params.id as string
  const { toast } = useToast()

  const { patrol, loading, error, refresh } = usePatrolData(patrolId)
  const { queuedCount, isOnline, addToQueue, syncNow } = usePatrolOfflineQueue(patrolId)

  const [scannerActive, setScannerActive] = useState(false)
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false)
  const [startingPatrol, setStartingPatrol] = useState(false)
  const [endingPatrol, setEndingPatrol] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoAction, setPhotoAction] = useState<'start' | 'end' | null>(null)
  const [lastCheckInId, setLastCheckInId] = useState<string | null>(null)

  // Auth guard
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    const user = session.user as any
    if (user.patrolsEnabled === false) {
      router.push('/unauthorized')
      return
    }
  }, [session, status, router])

  // Register Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw-patrol.js')
        .catch(err => console.warn('[SW] Registration failed:', err))

      // Escuchar mensaje de sync listo
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'PATROL_SYNC_READY') syncNow()
      })
    }
  }, [syncNow])

  // ── Foto handler ────────────────────────────────────────────────────────────
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImageFile(file, { maxWidthPx: 1280, quality: 0.82 })
    setPhotoFile(compressed)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(compressed)
  }

  // ── Iniciar patrulla ────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!patrol) return
    const requirePhoto = patrol.familyConfig?.requirePhotoOnStart

    if (requirePhoto && !photoFile) {
      setPhotoAction('start')
      toast({
        title: 'Foto requerida',
        description: 'Toma una foto para iniciar la ronda',
        variant: 'destructive',
      })
      return
    }

    setStartingPatrol(true)
    try {
      const body: Record<string, unknown> = { action: 'start' }
      if (photoFile) {
        body.startPhotoBase64 = await fileToBase64(photoFile)
        body.capturedAt = new Date().toISOString()
      }

      const res = await fetch(`/api/patrols/${patrolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al iniciar')

      toast({ title: 'Ronda iniciada', description: 'Escanea los checkpoints en orden' })
      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoAction(null)
      refresh()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al iniciar',
        variant: 'destructive',
      })
    } finally {
      setStartingPatrol(false)
    }
  }, [patrol, patrolId, photoFile, toast, refresh])

  // ── Finalizar patrulla ──────────────────────────────────────────────────────
  const handleEnd = useCallback(async () => {
    if (!patrol) return
    const requirePhoto = patrol.familyConfig?.requirePhotoOnEnd

    if (requirePhoto && !photoFile) {
      setPhotoAction('end')
      toast({
        title: 'Foto requerida',
        description: 'Toma una foto para finalizar la ronda',
        variant: 'destructive',
      })
      return
    }

    setEndingPatrol(true)
    try {
      const body: Record<string, unknown> = { action: 'end' }
      if (photoFile) {
        body.endPhotoBase64 = await fileToBase64(photoFile)
        body.capturedAt = new Date().toISOString()
      }

      const res = await fetch(`/api/patrols/${patrolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al finalizar')

      toast({
        title: data.status === 'COMPLETED' ? '¡Ronda completada!' : 'Ronda finalizada',
        description: `Completitud: ${data.completionPercentage}%`,
      })
      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoAction(null)
      refresh()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al finalizar',
        variant: 'destructive',
      })
    } finally {
      setEndingPatrol(false)
    }
  }, [patrol, patrolId, photoFile, toast, refresh])

  // ── Check-in tras escaneo QR ────────────────────────────────────────────────
  const handleScan = useCallback(
    async ({ checkpointId, token }: { checkpointId: string; token: string }) => {
      setScannerActive(false)
      setSubmittingCheckIn(true)

      try {
        // Obtener GPS
        let gpsLat: number | undefined
        let gpsLng: number | undefined
        let gpsAccuracyMeters: number | undefined

        if (navigator.geolocation) {
          await new Promise<void>(resolve => {
            navigator.geolocation.getCurrentPosition(
              pos => {
                gpsLat = pos.coords.latitude
                gpsLng = pos.coords.longitude
                gpsAccuracyMeters = pos.coords.accuracy
                resolve()
              },
              () => resolve(),
              { timeout: 3000, maximumAge: 10000 }
            )
          })
        }

        const body: Record<string, unknown> = {
          checkpointId,
          qrToken: token,
          deviceTimestamp: new Date().toISOString(),
          isOffline: false,
          ...(gpsLat !== undefined && { gpsLat, gpsLng, gpsAccuracyMeters }),
          ...(photoFile && { photoBase64: await fileToBase64(photoFile) }),
        }

        const res = await fetch(`/api/patrols/${patrolId}/check-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        // Respuesta 202 = encolado offline por el Service Worker
        if (res.status === 202 || res.headers.get('X-Patrol-Queued') === '1') {
          addToQueue({
            patrolId,
            checkpointId,
            qrToken: token,
            gpsLat,
            gpsLng,
            gpsAccuracyMeters,
            deviceTimestamp: body.deviceTimestamp as string,
            photoBase64: body.photoBase64 as string | undefined,
          })
          toast({
            title: 'Check-in guardado offline',
            description: 'Se sincronizará al recuperar conexión',
          })
          return
        }

        const data = await res.json()
        if (!res.ok) {
          toast({
            title: 'Check-in rechazado',
            description: data.error ?? 'Token inválido',
            variant: 'destructive',
          })
          return
        }

        setLastCheckInId(data.checkInId)
        toast({
          title: 'Check-in registrado ✓',
          description: `Completitud: ${data.completionPercentage}%`,
        })
        setPhotoFile(null)
        setPhotoPreview(null)
        refresh()
      } catch {
        // Sin red — encolar offline
        addToQueue({
          patrolId,
          checkpointId,
          qrToken: token,
          deviceTimestamp: new Date().toISOString(),
        })
        toast({ title: 'Sin conexión', description: 'Check-in guardado para sincronizar después' })
      } finally {
        setSubmittingCheckIn(false)
      }
    },
    [patrolId, photoFile, addToQueue, toast, refresh]
  )

  if (status === 'loading' || !session) return null

  if (loading) {
    return <ModuleLayout title='Cargando ronda...' loading={true} />
  }

  if (error || !patrol) {
    return (
      <ModuleLayout
        title='Ronda no encontrada'
        error={error ?? 'Patrulla no encontrada'}
        onRetry={() => refresh()}
      />
    )
  }

  const visitedIds = new Set(patrol.checkIns.map(ci => ci.checkpointId))
  const checkpoints = patrol.route.routeCheckpoints
  const nextCheckpoint = checkpoints.find(rc => !visitedIds.has(rc.checkpoint.id))
  const isInProgress = patrol.status === 'IN_PROGRESS'
  const isPending = patrol.status === 'PENDING'
  const isFinished = ['COMPLETED', 'INCOMPLETE', 'MISSED'].includes(patrol.status)

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
          <PatrolOfflineIndicator isOnline={isOnline} queuedCount={queuedCount} />
          <PatrolStatusBadge status={patrol.status} />
          <Button
            variant='ghost'
            size='sm'
            onClick={() => router.push('/patrol')}
            className='gap-1'
          >
            <ArrowLeft className='h-4 w-4' />
            Volver
          </Button>
        </div>
      }
    >
      <div className='space-y-4 max-w-2xl mx-auto'>
        {/* Progreso */}
        <Card>
          <CardContent className='pt-4 space-y-3'>
            <PatrolProgress
              visitedRequired={patrol.progress.visitedRequired}
              totalRequired={patrol.progress.totalRequired}
            />
            {/* Resumen de tiempo de la ronda */}
            {patrol.route.estimatedDurationMinutes > 0 && (
              <div className='flex items-center justify-between text-xs text-muted-foreground border-t pt-2'>
                <span className='flex items-center gap-1'>
                  ⏱ Duración estimada:{' '}
                  <span className='font-medium text-foreground ml-1'>
                    {formatDurationMinutes(patrol.route.estimatedDurationMinutes)}
                  </span>
                </span>
                {checkpoints.length > 0 && (
                  <span>
                    ~{Math.round(patrol.route.estimatedDurationMinutes / checkpoints.length)}{' '}
                    min/checkpoint
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Foto requerida (inicio/fin) */}
        {(photoAction === 'start' || photoAction === 'end') && (
          <Card className='border-orange-300 dark:border-orange-700'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm flex items-center gap-2'>
                <Camera className='h-4 w-4 text-orange-500' />
                Foto requerida para {photoAction === 'start' ? 'iniciar' : 'finalizar'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {photoPreview ? (
                <div className='relative rounded-lg overflow-hidden'>
                  <img
                    src={photoPreview}
                    alt='Foto'
                    className='w-full h-40 object-cover rounded-lg'
                  />
                  <Button
                    size='sm'
                    variant='outline'
                    className='mt-2 w-full'
                    onClick={() => {
                      setPhotoFile(null)
                      setPhotoPreview(null)
                    }}
                  >
                    Cambiar foto
                  </Button>
                </div>
              ) : (
                <FileInputWithCamera
                  accept='image/*'
                  onChange={handlePhotoChange}
                  onCameraChange={handlePhotoChange}
                >
                  {({ openFile, openCamera, showCamera }) => (
                    <div className='flex gap-2'>
                      {showCamera && (
                        <Button
                          variant='outline'
                          size='sm'
                          className='flex-1'
                          onClick={() => openCamera('environment')}
                        >
                          <Camera className='h-4 w-4 mr-2' />
                          Cámara
                        </Button>
                      )}
                      <Button
                        variant='outline'
                        size='sm'
                        className={showCamera ? 'flex-1' : 'w-full'}
                        onClick={openFile}
                      >
                        <Upload className='h-4 w-4 mr-2' />
                        Galería
                      </Button>
                    </div>
                  )}
                </FileInputWithCamera>
              )}
            </CardContent>
          </Card>
        )}

        {/* Acciones principales */}
        {isPending && (
          <Button className='w-full h-12 text-base' onClick={handleStart} disabled={startingPatrol}>
            {startingPatrol ? (
              <Loader2 className='h-5 w-5 mr-2 animate-spin' />
            ) : (
              <Play className='h-5 w-5 mr-2' />
            )}
            Iniciar Ronda
          </Button>
        )}

        {isInProgress && (
          <div className='grid grid-cols-2 gap-3'>
            {/* Escanear QR */}
            <Button
              className='h-12'
              onClick={() => setScannerActive(s => !s)}
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

            {/* Finalizar */}
            <Button variant='outline' className='h-12' onClick={handleEnd} disabled={endingPatrol}>
              {endingPatrol ? (
                <Loader2 className='h-5 w-5 mr-2 animate-spin' />
              ) : (
                <CheckCircle2 className='h-5 w-5 mr-2' />
              )}
              Finalizar
            </Button>
          </div>
        )}

        {/* Scanner QR */}
        {scannerActive && (
          <Card>
            <CardContent className='pt-4'>
              <PatrolCheckpointScanner
                active={scannerActive}
                onScan={handleScan}
                onError={msg => {
                  toast({ title: 'Error de escaneo', description: msg, variant: 'destructive' })
                  setScannerActive(false)
                }}
              />
              <p className='text-xs text-center text-muted-foreground mt-2'>
                Apunta la cámara al código QR del checkpoint
              </p>
            </CardContent>
          </Card>
        )}

        {/* Botón de incidente — visible siempre que la patrulla esté en progreso */}
        {isInProgress && (
          <div className='flex justify-end'>
            <PatrolIncidentButton
              patrolId={patrolId}
              familyId={patrol.familyId}
              checkInId={
                lastCheckInId ?? patrol.checkIns[patrol.checkIns.length - 1]?.id ?? patrolId
              }
              incidentCategoryId={patrol.familyConfig?.patrolIncidentCategoryId}
              onIncidentCreated={() => toast({ title: 'Incidente reportado' })}
            />
          </div>
        )}

        {/* Lista de checkpoints */}
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
              onCheckpointClick={isInProgress ? () => setScannerActive(true) : undefined}
            />
          </CardContent>
        </Card>

        {/* Timeline de check-ins */}
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
      </div>
    </ModuleLayout>
  )
}
