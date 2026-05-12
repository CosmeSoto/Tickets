'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface OfflineCheckIn {
  localQueueId: string
  patrolId: string
  checkpointId: string
  qrToken: string
  gpsLat?: number
  gpsLng?: number
  gpsAccuracyMeters?: number
  deviceTimestamp: string
  photoBase64?: string
  queuedAt: string
}

interface SyncResult {
  localQueueId: string
  status: 'ACCEPTED' | 'REJECTED'
  checkInId?: string
  error?: string
}

const STORAGE_KEY = 'patrol_offline_queue'

function loadQueue(): OfflineCheckIn[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQueue(items: OfflineCheckIn[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // localStorage lleno — ignorar
  }
}

/**
 * Gestiona la cola offline de check-ins en localStorage.
 * Escucha eventos online/offline del navegador.
 * Sincroniza automáticamente al recuperar conectividad.
 */
export function usePatrolOfflineQueue(patrolId: string) {
  const [queue, setQueue] = useState<OfflineCheckIn[]>([])
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)

  // Cargar cola inicial
  useEffect(() => {
    const all = loadQueue()
    setQueue(all.filter(item => item.patrolId === patrolId))
  }, [patrolId])

  /**
   * Agrega un check-in a la cola offline.
   */
  const addToQueue = useCallback(
    (checkIn: Omit<OfflineCheckIn, 'localQueueId' | 'queuedAt'>) => {
      const item: OfflineCheckIn = {
        ...checkIn,
        localQueueId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        queuedAt: new Date().toISOString(),
      }

      const all = loadQueue()
      const updated = [...all, item]
      saveQueue(updated)
      setQueue(updated.filter(i => i.patrolId === patrolId))

      return item.localQueueId
    },
    [patrolId]
  )

  /**
   * Sincroniza todos los check-ins pendientes con el servidor.
   * Procesa en orden cronológico (por deviceTimestamp).
   */
  const syncNow = useCallback(async (): Promise<SyncResult[]> => {
    if (syncingRef.current) return []

    const all = loadQueue()
    const pending = all
      .filter(item => item.patrolId === patrolId)
      .sort((a, b) => new Date(a.deviceTimestamp).getTime() - new Date(b.deviceTimestamp).getTime())

    if (pending.length === 0) return []

    syncingRef.current = true
    setSyncing(true)

    try {
      const res = await fetch(`/api/patrols/${patrolId}/check-in/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkIns: pending }),
      })

      if (!res.ok) {
        console.error('[OfflineQueue] Sync failed:', res.status)
        return []
      }

      const data = await res.json()
      const results: SyncResult[] = data.results ?? []

      // Remover los aceptados de la cola
      const acceptedIds = new Set(
        results.filter(r => r.status === 'ACCEPTED').map(r => r.localQueueId)
      )

      const remaining = all.filter(item => !acceptedIds.has(item.localQueueId))
      saveQueue(remaining)
      setQueue(remaining.filter(i => i.patrolId === patrolId))

      return results
    } catch (err) {
      console.error('[OfflineQueue] Sync error:', err)
      return []
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [patrolId])

  // Escuchar eventos de conectividad (después de syncNow para evitar TDZ en TypeScript)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      syncNow()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncNow])

  /**
   * Elimina un ítem específico de la cola (ej: tras rechazo definitivo).
   */
  const removeFromQueue = useCallback(
    (localQueueId: string) => {
      const all = loadQueue()
      const updated = all.filter(item => item.localQueueId !== localQueueId)
      saveQueue(updated)
      setQueue(updated.filter(i => i.patrolId === patrolId))
    },
    [patrolId]
  )

  return {
    queue,
    queuedCount: queue.length,
    isOnline,
    syncing,
    addToQueue,
    syncNow,
    removeFromQueue,
  }
}
