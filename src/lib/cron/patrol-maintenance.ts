/**
 * Jobs de mantenimiento del módulo de patrullas.
 * Ejecutar nocturnamente vía /api/cron/patrol.
 */

import { PatrolPhotoService } from '@/lib/services/patrol-photo.service'
import { PatrolSchedulerService } from '@/lib/services/patrol-scheduler.service'

export interface PatrolMaintenanceResult {
  photosDeleted: number
  photoErrors: number
  patrolsMissed: number
  timestamp: string
}

/**
 * Ejecuta todos los jobs de mantenimiento de patrullas en secuencia.
 * Cada job es independiente — un fallo no detiene los demás.
 */
export async function runPatrolMaintenanceJobs(): Promise<PatrolMaintenanceResult> {
  const timestamp = new Date().toISOString()
  let photosDeleted = 0
  let photoErrors = 0
  let patrolsMissed = 0

  // 1. Retención de fotos
  try {
    const photoResult = await PatrolPhotoService.runRetentionJob()
    photosDeleted = photoResult.deleted
    photoErrors = photoResult.errors
  } catch (err) {
    console.error('[patrol-maintenance] Error en job de retención de fotos:', err)
  }

  // 2. Detección de patrullas perdidas
  try {
    patrolsMissed = await PatrolSchedulerService.detectMissedPatrols()
  } catch (err) {
    console.error('[patrol-maintenance] Error en job de detección de patrullas perdidas:', err)
  }

  return { photosDeleted, photoErrors, patrolsMissed, timestamp }
}
