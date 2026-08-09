/**
 * Jobs de mantenimiento del módulo de patrullas.
 * Ejecutar cada 5 minutos vía /api/cron/patrol para recordatorios,
 * o nocturnamente para retención de fotos y regeneración.
 */

import { PatrolPhotoService } from '@/lib/services/patrol-photo.service'
import { PatrolReminderService } from '@/lib/services/patrol-reminder.service'
import { PatrolSchedulerService } from '@/lib/services/patrol-scheduler.service'

export interface PatrolMaintenanceResult {
  photosDeleted: number
  photoErrors: number
  patrolsMissed: number
  patrolsAutoClosed: number
  patrolsGenerated: number
  reminderssSent: number
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
  let patrolsAutoClosed = 0
  let patrolsGenerated = 0
  let reminderssSent = 0

  // 1. Recordatorios pre-ronda (reminderMinutesBefore + reminderSentAt)
  try {
    const reminderResult = await PatrolReminderService.sendPendingReminders()
    reminderssSent = reminderResult.sent
  } catch (err) {
    console.error('[patrol-maintenance] Error en job de recordatorios:', err)
  }

  // 2. Detección de patrullas perdidas (PENDING que expiraron sin iniciar)
  try {
    patrolsMissed = await PatrolSchedulerService.detectMissedPatrols()
  } catch (err) {
    console.error('[patrol-maintenance] Error en job de detección de patrullas perdidas:', err)
  }

  // 2b. Cierre automático de patrullas IN_PROGRESS que vencieron sin finalizar
  try {
    patrolsAutoClosed = await PatrolSchedulerService.autoCloseExpiredPatrols()
  } catch (err) {
    console.error('[patrol-maintenance] Error en job de cierre automático de rondas vencidas:', err)
  }

  // 3. Regeneración de patrullas futuras para schedules activos con recurrencia
  try {
    patrolsGenerated = await PatrolSchedulerService.regenerateActiveSchedules()
  } catch (err) {
    console.error('[patrol-maintenance] Error en job de regeneración de patrullas:', err)
  }

  // 4. Retención de fotos (solo ejecutar si es de noche — entre 00:00 y 05:00)
  const hour = new Date().getHours()
  if (hour >= 0 && hour < 5) {
    try {
      const photoResult = await PatrolPhotoService.runRetentionJob()
      photosDeleted = photoResult.deleted
      photoErrors = photoResult.errors
    } catch (err) {
      console.error('[patrol-maintenance] Error en job de retención de fotos:', err)
    }
  }

  return {
    photosDeleted,
    photoErrors,
    patrolsMissed,
    patrolsAutoClosed,
    patrolsGenerated,
    reminderssSent,
    timestamp,
  }
}
