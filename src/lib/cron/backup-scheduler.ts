/**
 * Cron Job: Backup automático programado (pgBackRest)
 *
 * Política:
 * - Domingo (o día configurado): backup FULL
 * - Resto de días con frecuencia daily: backup DIFF
 * - weekly/monthly: respeta intervalo configurado
 *
 * Endpoint: POST /api/admin/cron/backup
 */

import { BackupService } from '../services/backup-service'
import prisma from '../prisma'

export class BackupScheduler {
  static async run(): Promise<{ ran: boolean; reason: string }> {
    console.log('[BACKUP SCHEDULER] Verificando backup automático pgBackRest...')

    try {
      const enabledSetting = await prisma.system_settings.findUnique({
        where: { key: 'backupEnabled' },
      })

      if (!enabledSetting || enabledSetting.value !== 'true') {
        return { ran: false, reason: 'Backups automáticos deshabilitados' }
      }

      const [frequencySetting, scheduledTimeSetting, weeklyFullDaySetting] = await Promise.all([
        prisma.system_settings.findUnique({ where: { key: 'backupFrequency' } }),
        prisma.system_settings.findUnique({ where: { key: 'backupScheduleTime' } }),
        prisma.system_settings.findUnique({ where: { key: 'backupWeeklyFullDay' } }),
      ])

      const frequency = frequencySetting?.value ?? 'daily'
      const scheduledTime = scheduledTimeSetting?.value ?? '02:00'
      const weeklyFullDay = weeklyFullDaySetting?.value
        ? parseInt(weeklyFullDaySetting.value, 10)
        : 0 // 0 = domingo

      const now = new Date()
      const [scheduledHour, scheduledMinute] = scheduledTime.split(':').map(Number)
      const scheduledMinutesFromMidnight = scheduledHour * 60 + scheduledMinute
      const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes()
      const diffMinutes = Math.abs(currentMinutesFromMidnight - scheduledMinutesFromMidnight)

      if (diffMinutes > 30) {
        return {
          ran: false,
          reason: `Fuera de ventana horaria (${scheduledTime})`,
        }
      }

      const lastBackup = await prisma.backups.findFirst({
        where: { type: 'automatic', status: 'completed', engine: 'pgbackrest' },
        orderBy: { createdAt: 'desc' },
      })

      if (lastBackup) {
        const hoursSinceLast = (now.getTime() - lastBackup.createdAt.getTime()) / (1000 * 60 * 60)
        const requiredHours: Record<string, number> = {
          daily: 23,
          weekly: 167,
          monthly: 719,
        }
        const minHours = requiredHours[frequency] ?? 23
        if (hoursSinceLast < minHours) {
          return {
            ran: false,
            reason: `Backup reciente (hace ${Math.round(hoursSinceLast)}h)`,
          }
        }
      }

      const isFullDay = now.getDay() === weeklyFullDay
      const backupKind = isFullDay ? 'full' : 'diff'

      console.log(`[BACKUP SCHEDULER] Creando backup pgBackRest ${backupKind}...`)
      const backup = await BackupService.createBackup('automatic', {
        mode: 'infrastructure',
        backupKind,
      })

      return {
        ran: true,
        reason: `Backup ${backupKind} creado: ${backup.label || backup.filename}`,
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido'
      console.error('[BACKUP SCHEDULER] Error:', msg)
      throw new Error(`Error en backup automático: ${msg}`)
    }
  }
}

export async function runBackupScheduler() {
  return BackupScheduler.run()
}
