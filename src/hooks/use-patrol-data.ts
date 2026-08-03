'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface PatrolCheckpoint {
  id: string
  name: string
  location: string
  latitude: number | null
  longitude: number | null
  qrType: 'DYNAMIC' | 'STATIC'
  isSensitive: boolean
  isActive: boolean
}

export interface RouteCheckpoint {
  order: number
  isRequired: boolean
  checkpoint: PatrolCheckpoint
}

export interface PatrolCheckIn {
  id: string
  checkpointId: string
  validationResult: string
  method: string
  deviceTimestamp: string
  serverTimestamp: string
  gpsLat: number | null
  gpsLng: number | null
  distanceFromCheckpointMeters: number | null
  isOffline: boolean
}

export interface PatrolData {
  id: string
  familyId: string
  agentId: string
  status: string
  scheduledStart: string
  scheduledEnd: string
  startedAt: string | null
  completedAt: string | null
  completionPercentage: number
  missedCheckpointIds: string[]
  startPhotoId: string | null
  endPhotoId: string | null
  agent: { id: string; name: string; email: string }
  route: {
    id: string
    name: string
    estimatedDurationMinutes: number
    routeCheckpoints: RouteCheckpoint[]
  }
  checkIns: PatrolCheckIn[]
  progress: {
    visitedRequired: number
    totalRequired: number
    completionPercentage: number
  }
  /** Reglas de foto inicio/fin y ventana horaria desde patrol_family_config / schedule */
  familyConfig?: {
    requirePhotoOnStart: boolean
    requirePhotoOnEnd: boolean
    patrolIncidentCategoryId?: string | null
    gracePeriodMinutes?: number
    strictTimeValidation?: boolean
  }
}

interface UsePatrolDataReturn {
  patrol: PatrolData | null
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Fetches patrol detail with checkpoints, check-ins, and real-time progress.
 * Polls every 30s when the patrol is IN_PROGRESS.
 */
export function usePatrolData(patrolId: string): UsePatrolDataReturn {
  const [patrol, setPatrol] = useState<PatrolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchPatrol = useCallback(async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45_000)
    try {
      const res = await fetch(`/api/patrols/${patrolId}`, { signal: controller.signal })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Error al cargar la patrulla')
      }
      const data = await res.json()
      setPatrol(data.data)
      setError(null)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Tiempo de espera agotado. Por favor, intenta de nuevo.')
      } else {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }, [patrolId])

  // Initial load
  useEffect(() => {
    setLoading(true)
    fetchPatrol()
  }, [fetchPatrol])

  // Poll every 30s while IN_PROGRESS
  useEffect(() => {
    if (patrol?.status === 'IN_PROGRESS') {
      intervalRef.current = setInterval(fetchPatrol, 30_000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [patrol?.status, fetchPatrol])

  return { patrol, loading, error, refresh: fetchPatrol }
}
