/**
 * Cron Job: Backup automático programado
 *
 * Verifica si corresponde crear un backup automático según la configuración
 * del sistema (frecuencia: daily / weekly / monthly, hora programada).
 *
 * Debe llamarse periódicamente desde un endpoint de cron externo o desde
 * el middleware de la aplicación. Se recomienda invocar cada hora.
 *
 * Endpoint sugerido: POST /api/admin/cron/backup
 * (protegido con CRON_SECRET en el header Authorization)
 */

import { BackupService } from '../services/backup-service'
import prisma from '../prisma'

export class BackupScheduler {
  /**
   * Punto de entrada principal del cron.
   * Verifica si corresponde crear un backup y lo ejecuta si es necesario.
   */
  static async run(): Promise<{ ran: boolean; reason: string }> {
    console.log('[BACKUP SCHEDULER] Verificando si corresponde crear backup automático...')

    try {
      // 1. Verificar si los backups automáticos están habilitados
      const enabledSetting = await prisma.system_settings.findUnique({
        where: { key: 'backupEnabled' },
      })

      if (!enabledSetting || enabledSetting.value !== 'true') {
        return { ran: false, reason: 'Backups automáticos deshabilitados en configuración' }
      }

      // 2. Obtener frecuencia y hora programada
      const [frequencySetting, scheduledTimeSetting] = await Promise.all([
        prisma.system_settings.findUnique({ where: { key: 'backupFrequency' } }),
        prisma.system_settings.findUnique({ where: { key: 'backupScheduleTime' } }),
      ])

      const frequency = frequencySetting?.value ?? 'daily'
      const scheduledTime = scheduledTimeSetting?.value ?? '02:00' // HH:MM

      // 3. Verificar si estamos dentro de la ventana horaria (±30 min de la hora programada)
      const now = new Date()
      const [scheduledHour, scheduledMinute] = scheduledTime.split(':').map(Number)
      const scheduledMinutesFromMidnight = scheduledHour * 60 + scheduledMinute
      const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes()
      const diffMinutes = Math.abs(currentMinutesFromMidnight - scheduledMinutesFromMidnight)

      if (diffMinutes > 30) {
        return {
          ran: false,
          reason: `Fuera de la ventana horaria. Programado: ${scheduledTime}, actual: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
        }
      }

      // 4. Verificar si ya se creó un backup en el intervalo actual
      const lastBackup = await prisma.backups.findFirst({
        where: { type: 'automatic', status: 'completed' },
        orderBy: { createdAt: 'desc' },
      })

      if (lastBackup) {
        const hoursSinceLast = (now.getTime() - lastBackup.createdAt.getTime()) / (1000 * 60 * 60)

        const requiredHours: Record<string, number> = {
          daily: 23, // Al menos 23h entre backups diarios (margen de 1h)
          weekly: 167, // Al menos 167h entre backups semanales (margen de 1h)
          monthly: 719, // Al menos 719h entre backups mensuales (margen de 1h)
        }

        const minHours = requiredHours[frequency] ?? 23

        if (hoursSinceLast < minHours) {
          return {
            ran: false,
            reason: `Backup reciente encontrado (hace ${Math.round(hoursSinceLast)}h). Próximo en ~${Math.round(minHours - hoursSinceLast)}h`,
          }
        }
      }

      // 5. Crear el backup automático
      console.log('[BACKUP SCHEDULER] Creando backup automático...')
      const backup = await BackupService.createBackup('automatic')

      console.log(
        `[BACKUP SCHEDULER] Backup automático creado: ${backup.filename} (${BackupService.formatFileSize(backup.size)})`
      )

      return {
        ran: true,
        reason: `Backup automático creado exitosamente: ${backup.filename}`,
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido'
      console.error('[BACKUP SCHEDULER] Error:', msg)
      throw new Error(`Error en backup automático: ${msg}`)
    }
  }
}

// Exportar función para uso directo
export async function runBackupScheduler() {
  return BackupScheduler.run()
}
