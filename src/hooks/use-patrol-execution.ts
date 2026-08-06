'use client'

/**
 * usePatrolExecution
 * Centraliza todo el estado y lógica de ejecución de una ronda:
 * - Inicio / fin de patrulla
 * - Check-in con QR (online y offline)
 * - Gestión de checkpoints saltados
 * - Novedades (incidentes)
 * - Subida de fotos requeridas
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { compressImageFile, fileToBase64 } from '@/lib/utils/image-utils'
import { usePatrolOfflineQueue } from '@/hooks/use-patrol-offline-queue'
import type { PatrolData } from '@/hooks/use-patrol-data'

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export interface PatrolIncidentItem {
  id: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'RESOLVED' | 'ESCALATED'
  checkpointId: string
  createdAt: string
  checkpoint?: { id: string; name: string }
}

export interface SkippedCheckpoint {
  id: string
  name: string
  order: number
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function usePatrolExecution(
  patrolId: string,
  patrol: PatrolData | null,
  refresh: () => void
) {
  const { toast } = useToast()
  const { queuedCount, isOnline, addToQueue, syncNow } = usePatrolOfflineQueue(patrolId)

  // ── Estados de acción ────────────────────────────────────────────────────────
  const [scannerActive, setScannerActive] = useState(false)
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false)
  const [startingPatrol, setStartingPatrol] = useState(false)
  const [endingPatrol, setEndingPatrol] = useState(false)
  const [forceClosing, setForceClosing] = useState(false)

  // ── Foto ─────────────────────────────────────────────────────────────────────
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoAction, setPhotoAction] = useState<'start' | 'end' | null>(null)

  // ── Novedades ────────────────────────────────────────────────────────────────
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false)
  const [incidentCheckpointId, setIncidentCheckpointId] = useState<string>('')
  const [incidentCheckpointName, setIncidentCheckpointName] = useState<string>('')
  const [patrolIncidents, setPatrolIncidents] = useState<PatrolIncidentItem[]>([])

  // ── Skip tracking ─────────────────────────────────────────────────────────────
  const [skippedCheckpoints, setSkippedCheckpoints] = useState<SkippedCheckpoint[]>([])
  const [requiresIncidentForSkip, setRequiresIncidentForSkip] = useState(false)

  // ── Service Worker ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw-patrol.js')
      .catch(err => console.warn('[SW] Registration failed:', err))
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'PATROL_SYNC_READY') syncNow()
    })
  }, [syncNow])

  // ── Cargar novedades de esta ronda ────────────────────────────────────────────
  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch(`/api/patrols/incidents?patrolId=${patrolId}`)
      if (!res.ok) return
      const json = await res.json()
      setPatrolIncidents(json.data ?? [])
    } catch {
      // no-op — lista de novedades no es crítica
    }
  }, [patrolId])

  useEffect(() => {
    if (patrolId) fetchIncidents()
  }, [patrolId, fetchIncidents])

  // ── Foto ─────────────────────────────────────────────────────────────────────
  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImageFile(file, { maxWidthPx: 1280, quality: 0.82 })
    setPhotoFile(compressed)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(compressed)
  }, [])

  const clearPhoto = useCallback(() => {
    setPhotoFile(null)
    setPhotoPreview(null)
  }, [])

  // ── Iniciar ronda ─────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!patrol) return

    if (patrol.familyConfig?.requirePhotoOnStart && !photoFile) {
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

  // ── Finalizar ronda ───────────────────────────────────────────────────────────
  const handleEnd = useCallback(async () => {
    if (!patrol) return

    if (requiresIncidentForSkip) {
      toast({
        title: 'Novedad requerida',
        description: 'Reporta una novedad por el checkpoint saltado antes de finalizar.',
        variant: 'destructive',
      })
      setIncidentDialogOpen(true)
      return
    }

    if (patrol.familyConfig?.requirePhotoOnEnd && !photoFile) {
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
  }, [patrol, patrolId, photoFile, toast, refresh, requiresIncidentForSkip])

  // ── Forzar cierre (admin/supervisor observador) ───────────────────────────────
  const handleForceClose = useCallback(async () => {
    const reason = window.prompt(
      'Motivo del cierre forzado (mín. 3 caracteres). Se registrará en auditoría:'
    )
    if (reason === null) return
    const trimmed = reason.trim()
    if (trimmed.length < 3) {
      toast({
        title: 'Motivo requerido',
        description: 'Indica un motivo de al menos 3 caracteres.',
        variant: 'destructive',
      })
      return
    }

    setForceClosing(true)
    try {
      const res = await fetch(`/api/patrols/${patrolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force_close', reason: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo forzar el cierre')

      toast({
        title: data.status === 'COMPLETED' ? 'Ronda cerrada como Completada' : 'Ronda cerrada',
        description: `Completitud: ${data.completionPercentage}% · Cierre forzado por supervisor`,
      })
      refresh()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al forzar cierre',
        variant: 'destructive',
      })
    } finally {
      setForceClosing(false)
    }
  }, [patrolId, toast, refresh])

  // ── Check-in QR ───────────────────────────────────────────────────────────────
  const handleScan = useCallback(
    async ({ checkpointId, token }: { checkpointId: string; token: string }) => {
      setScannerActive(false)
      setSubmittingCheckIn(true)

      try {
        // GPS
        let gpsLat: number | undefined,
          gpsLng: number | undefined,
          gpsAccuracyMeters: number | undefined
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

        // Encolado offline por Service Worker
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
          if (data.code === 'PATROL_INVALIDATED_TOO_MANY_SKIPS') {
            const names =
              (data.skippedCheckpoints as SkippedCheckpoint[] | undefined)
                ?.map(c => `#${c.order} ${c.name}`)
                .join(', ') ?? ''
            toast({
              title: '⛔ Ronda invalidada',
              description: `Saltaste demasiados checkpoints (${names}). La ronda fue cerrada como incompleta.`,
              variant: 'destructive',
            })
            setSkippedCheckpoints([])
            setRequiresIncidentForSkip(false)
            refresh()
            return
          }
          toast({
            title: 'Check-in rechazado',
            description: data.error ?? 'Token inválido',
            variant: 'destructive',
          })
          return
        }

        // Check-in exitoso — ¿hubo skip / auto-cierre?
        if (data.warning?.code === 'CHECKPOINT_SKIPPED') {
          const skipped: SkippedCheckpoint[] = data.warning.skippedCheckpoints ?? []
          setSkippedCheckpoints(skipped)
          setRequiresIncidentForSkip(true)
          if (skipped.length > 0) {
            setIncidentCheckpointId(skipped[0].id)
            setIncidentCheckpointName(skipped[0].name)
          }
          toast({
            title: '⚠️ Checkpoint saltado',
            description: data.warning.message,
            variant: 'destructive',
          })
        } else if (data.autoCompleted || data.patrolStatus === 'COMPLETED') {
          toast({
            title: '¡Ronda completada!',
            description: `Último punto registrado. Completitud: ${data.completionPercentage}%`,
          })
        } else if (data.readyToFinish) {
          toast({
            title: 'Check-in registrado ✓',
            description:
              'Ya visitaste todos los obligatorios. Pulsa Finalizar para cerrar la ronda.',
          })
        } else {
          toast({
            title: 'Check-in registrado ✓',
            description: `Completitud: ${data.completionPercentage}%`,
          })
        }

        setPhotoFile(null)
        setPhotoPreview(null)
        // Actualizar checkpoint para próxima novedad
        setIncidentCheckpointId(checkpointId)
        const scannedCp = patrol?.route.routeCheckpoints.find(
          rc => rc.checkpoint.id === checkpointId
        )
        setIncidentCheckpointName(scannedCp?.checkpoint.name ?? '')
        refresh()
      } catch {
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
    [patrolId, patrol, photoFile, addToQueue, toast, refresh]
  )

  // ── Callback tras reportar novedad ────────────────────────────────────────────
  const handleIncidentSuccess = useCallback(() => {
    fetchIncidents()
    setSkippedCheckpoints([])
    setRequiresIncidentForSkip(false)
    // El toast lo muestra IncidentFormDialog
  }, [fetchIncidents])

  // ── Abrir diálogo de novedad con contexto correcto ────────────────────────────
  const openIncidentDialog = useCallback(
    (checkpoints: PatrolData['route']['routeCheckpoints'], checkIns: PatrolData['checkIns']) => {
      if (!incidentCheckpointId && checkIns.length > 0) {
        const lastCi = checkIns[checkIns.length - 1]
        setIncidentCheckpointId(lastCi.checkpointId)
        const cp = checkpoints.find(rc => rc.checkpoint.id === lastCi.checkpointId)
        setIncidentCheckpointName(cp?.checkpoint.name ?? '')
      }
      setIncidentDialogOpen(true)
    },
    [incidentCheckpointId]
  )

  return {
    // offline
    queuedCount,
    isOnline,
    // scanner
    scannerActive,
    setScannerActive,
    submittingCheckIn,
    // loading
    startingPatrol,
    endingPatrol,
    forceClosing,
    // foto
    photoFile,
    photoPreview,
    photoAction,
    handlePhotoChange,
    clearPhoto,
    // novedades
    incidentDialogOpen,
    setIncidentDialogOpen,
    incidentCheckpointId,
    incidentCheckpointName,
    patrolIncidents,
    fetchIncidents,
    handleIncidentSuccess,
    openIncidentDialog,
    // skip
    skippedCheckpoints,
    requiresIncidentForSkip,
    // handlers principales
    handleStart,
    handleEnd,
    handleForceClose,
    handleScan,
  }
}
