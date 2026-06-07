/**
 * Servicio de recordatorios pre-ronda.
 *
 * Responsabilidades:
 * - Consultar patrullas PENDING que están próximas a iniciar
 * - Enviar notificaciones push de recordatorio al agente asignado
 * - Garantizar idempotencia mediante el campo `reminderSentAt`
 * - No interrumpir el batch por errores individuales
 */

import prisma from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification-service'
import { NotificationType } from '@prisma/client'

export class PatrolReminderService {
  /**
   * Envía recordatorios de rondas pendientes que están dentro de la ventana
   * de notificación configurada por cada familia.
   *
   * Lógica:
   * 1. Obtiene todas las configuraciones de familia con reminderMinutesBefore > 0
   * 2. Para cada configuración, busca patrullas PENDING sin reminder enviado
   *    cuyo scheduledStart esté dentro de la ventana (y aún en el futuro)
   * 3. Envía notificación push al agente con los datos de la ronda
   * 4. Marca reminderSentAt en la patrulla
   *
   * @returns Conteo de enviados y omitidos
   */
  static async sendPendingReminders(): Promise<{ sent: number; skipped: number }> {
    let sent = 0
    let skipped = 0

    const now = new Date()

    // 1. Obtener todas las configuraciones de familia con reminders habilitados
    const configs = await prisma.patrol_family_config.findMany({
      where: { reminderMinutesBefore: { gt: 0 } },
      select: { familyId: true, reminderMinutesBefore: true },
    })

    if (configs.length === 0) {
      return { sent, skipped }
    }

    // 2. Para cada configuración, buscar patrullas elegibles
    for (const config of configs) {
      const windowMs = config.reminderMinutesBefore * 60 * 1000
      const maxScheduledStart = new Date(now.getTime() + windowMs)

      // Buscar patrullas PENDING de esta familia dentro de la ventana
      const patrols = await prisma.patrols.findMany({
        where: {
          familyId: config.familyId,
          status: 'PENDING',
          reminderSentAt: null,
          scheduledStart: {
            gt: now,
            lte: maxScheduledStart,
          },
        },
        include: {
          route: { select: { id: true, name: true } },
          family: { select: { id: true, name: true } },
          agent: { select: { id: true, name: true } },
          schedule: { select: { id: true } },
        },
      })

      // 3. Enviar notificación para cada patrulla elegible
      for (const patrol of patrols) {
        try {
          const formattedTime = patrol.scheduledStart.toLocaleTimeString('es-EC', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Guayaquil',
          })

          await NotificationService.push({
            userId: patrol.agentId,
            type: NotificationType.INFO,
            title: 'Tu ronda está por iniciar',
            message: `Tu ronda en la ruta "${patrol.route.name}" (${patrol.family.name}) inicia a las ${formattedTime}.`,
            metadata: {
              patrolId: patrol.id,
              scheduleId: patrol.scheduleId,
              routeId: patrol.routeId,
              familyId: patrol.familyId,
            },
          })

          // 4. Marcar como enviado para idempotencia
          await prisma.patrols.update({
            where: { id: patrol.id },
            data: { reminderSentAt: new Date() },
          })

          sent++
        } catch (err) {
          // Errores individuales NO detienen el batch
          console.error(
            `[PatrolReminderService] Error enviando recordatorio para patrulla ${patrol.id}:`,
            err
          )
          skipped++
        }
      }
    }

    return { sent, skipped }
  }
}
