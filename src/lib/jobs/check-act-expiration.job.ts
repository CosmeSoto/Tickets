import { DeliveryActService } from '../services/delivery-act.service'
import { InventoryNotificationService } from '../services/inventory-notification.service'

/**
 * Job para verificar y procesar actas de entrega expiradas
 * Debe ejecutarse diariamente mediante cron
 */
export class CheckActExpirationJob {
  /**
   * Marca actas expiradas como EXPIRED
   * @returns Número de actas marcadas como expiradas
   */
  static async markExpiredActs(): Promise<number> {
    try {
      console.log('[CheckActExpirationJob] Iniciando verificación de actas expiradas...')
      
      const count = await DeliveryActService.markExpiredActs()
      
      console.log(`[CheckActExpirationJob] ${count} actas marcadas como expiradas`)
      return count
    } catch (error) {
      console.error('[CheckActExpirationJob] Error marcando actas expiradas:', error)
      throw error
    }
  }

  /**
   * Envía notificaciones de expiración para actas recién expiradas
   * @returns Número de notificaciones enviadas
   */
  static async sendExpirationNotifications(): Promise<number> {
    try {
      console.log('[CheckActExpirationJob] Enviando notificaciones de expiración...')
      
      // Obtener actas que expiraron hoy (ya marcadas como EXPIRED)
      const acts = await DeliveryActService.getActsExpiringIn(0)
      
      let sentCount = 0
      for (const act of acts) {
        try {
          await InventoryNotificationService.sendActExpiredNotification(act.id)
          sentCount++
        } catch (error) {
          console.error(`[CheckActExpirationJob] Error enviando notificación para acta ${act.folio}:`, error)
          // Continuar con las demás actas
        }
      }
      
      console.log(`[CheckActExpirationJob] ${sentCount} notificaciones de expiración enviadas`)
      return sentCount
    } catch (error) {
      console.error('[CheckActExpirationJob] Error enviando notificaciones de expiración:', error)
      throw error
    }
  }

  /**
   * Envía recordatorios para actas próximas a expirar
   * @param daysBeforeExpiration Días antes de la expiración (3 o 1)
   * @returns Número de recordatorios enviados
   */
  static async sendReminders(daysBeforeExpiration: number): Promise<number> {
    try {
      console.log(`[CheckActExpirationJob] Enviando recordatorios (${daysBeforeExpiration} días antes)...`)
      
      const actIds = await InventoryNotificationService.getActsNeedingReminders(daysBeforeExpiration)
      
      let sentCount = 0
      for (const actId of actIds) {
        try {
          await InventoryNotificationService.sendActReminderNotification(actId, daysBeforeExpiration)
          sentCount++
        } catch (error) {
          console.error(`[CheckActExpirationJob] Error enviando recordatorio para acta ${actId}:`, error)
          // Continuar con las demás actas
        }
      }
      
      console.log(`[CheckActExpirationJob] ${sentCount} recordatorios enviados`)
      return sentCount
    } catch (error) {
      console.error('[CheckActExpirationJob] Error enviando recordatorios:', error)
      throw error
    }
  }

  /**
   * Ejecuta todas las tareas del job
   * @returns Resumen de la ejecución
   */
  static async run(): Promise<{
    expiredCount: number
    expirationNotificationsSent: number
    reminders3DaysSent: number
    reminders1DaySent: number
  }> {
    console.log('[CheckActExpirationJob] Iniciando ejecución del job...')
    
    try {
      // 1. Marcar actas expiradas
      const expiredCount = await this.markExpiredActs()
      
      // 2. Enviar notificaciones de expiración
      const expirationNotificationsSent = await this.sendExpirationNotifications()
      
      // 3. Enviar recordatorios (3 días antes)
      const reminders3DaysSent = await this.sendReminders(3)
      
      // 4. Enviar recordatorios (1 día antes)
      const reminders1DaySent = await this.sendReminders(1)
      
      const result = {
        expiredCount,
        expirationNotificationsSent,
        reminders3DaysSent,
        reminders1DaySent,
      }
      
      console.log('[CheckActExpirationJob] Ejecución completada:', result)
      return result
    } catch (error) {
      console.error('[CheckActExpirationJob] Error en ejecución del job:', error)
      throw error
    }
  }
}
