import prisma from '@/lib/prisma'
import { LicenseService } from '../services/license.service'
import { randomUUID } from 'crypto'
import { NotificationService } from '../services/notification-service'

/**
 * Job para verificar licencias próximas a expirar
 * Debe ejecutarse diariamente mediante cron
 */
export class CheckLicenseExpirationJob {
  /**
   * Envía notificaciones para licencias próximas a expirar
   */
  static async sendExpirationNotifications(daysBeforeExpiration: number): Promise<number> {
    try {
      console.log(`[CheckLicenseExpirationJob] Enviando alertas (${daysBeforeExpiration} días antes)...`)

      const expiringLicenses = await LicenseService.getExpiringLicenses(daysBeforeExpiration)

      if (expiringLicenses.length === 0) {
        console.log('[CheckLicenseExpirationJob] No hay licencias próximas a expirar')
        return 0
      }

      // Obtener usuarios ADMIN para notificar
      const admins = await prisma.users.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, email: true, name: true },
      })

      let notificationsSent = 0

      for (const license of expiringLicenses) {
        const daysRemaining = Math.ceil(
          (new Date(license.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        )

        const assignedTo = license.equipment 
          ? `Equipo: ${license.equipment.code}`
          : license.user
          ? `Usuario: ${license.user.name}`
          : license.department
          ? `Departamento: ${license.department.name}`
          : 'No asignada'

        const typeName = license.licenseType?.name || 'Sin tipo'

        // Crear notificaciones in-app para cada admin
        for (const admin of admins) {
          try {
            await NotificationService.push({
              userId: admin.id,
              type: daysRemaining <= 7 ? 'ERROR' : 'WARNING',
              title: daysRemaining <= 7 ? '¡URGENTE! Licencia por Expirar' : 'Licencia Próxima a Expirar',
              message: `La licencia "${license.name}" (${typeName}) expira en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}. ${assignedTo}`,
              metadata: { link: `/inventory/licenses` },
            })

            // Crear email en cola
            await prisma.email_queue.create({
              data: {
                id: randomUUID(),
                toEmail: admin.email,
                subject: daysRemaining <= 7
                  ? `¡URGENTE! Licencia por Expirar - ${license.name}`
                  : `Licencia Próxima a Expirar - ${license.name}`,
                body: this.generateEmailBody(license, daysRemaining, admin.name, assignedTo),
                status: 'pending',
                attempts: 0,
                maxAttempts: 3,
                scheduledAt: new Date(),
              },
            })

            notificationsSent++
          } catch (error) {
            console.error(`[CheckLicenseExpirationJob] Error enviando notificación para ${license.name}:`, error)
          }
        }
      }

      console.log(`[CheckLicenseExpirationJob] ${notificationsSent} notificaciones enviadas para ${expiringLicenses.length} licencias`)
      return notificationsSent
    } catch (error) {
      console.error('[CheckLicenseExpirationJob] Error enviando notificaciones:', error)
      throw error
    }
  }

  /**
   * Genera el cuerpo del email de alerta
   */
  private static generateEmailBody(
    license: any,
    daysRemaining: number,
    adminName: string,
    assignedTo: string
  ): string {
    const expirationDate = new Date(license.expirationDate!).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${daysRemaining <= 7 ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid ${daysRemaining <= 7 ? '#dc2626' : '#f59e0b'}; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${daysRemaining <= 7 ? '⚠️ URGENTE: Licencia por Expirar' : '📋 Licencia Próxima a Expirar'}</h2>
    </div>
    <div class="content">
      <p>Hola ${adminName},</p>
      
      <p>Te informamos que la siguiente licencia de software expira en <strong>${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}</strong>:</p>
      
      <div class="info-box">
        <p><strong>Licencia:</strong> ${license.name}</p>
        <p><strong>Tipo:</strong> ${license.licenseType?.name || 'Sin tipo'}</p>
        <p><strong>Fecha de Expiración:</strong> ${expirationDate}</p>
        <p><strong>Asignada a:</strong> ${assignedTo}</p>
        ${license.vendor ? `<p><strong>Proveedor:</strong> ${license.vendor}</p>` : ''}
        ${license.cost ? `<p><strong>Costo:</strong> $${license.cost.toFixed(2)} USD</p>` : ''}
      </div>

      <p><strong>Acciones recomendadas:</strong></p>
      <ul>
        <li>Verificar si la licencia sigue siendo necesaria</li>
        <li>Contactar al proveedor para renovación</li>
        <li>Evaluar alternativas si es necesario</li>
        <li>Actualizar la fecha de expiración en el sistema</li>
      </ul>

      <p style="text-align: center;">
        <a href="${process.env.NEXTAUTH_URL}/inventory/licenses/${license.id}" class="button">
          Ver Detalles de la Licencia
        </a>
      </p>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático del Sistema de Gestión de Inventario</p>
      <p>Por favor no responder a este correo</p>
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  /**
   * Ejecuta todas las tareas del job
   */
  static async run(): Promise<{
    alerts30DaysSent: number
    alerts7DaysSent: number
    alerts1DaySent: number
  }> {
    console.log('[CheckLicenseExpirationJob] Iniciando ejecución del job...')

    try {
      const [firstSetting, secondSetting] = await Promise.all([
        prisma.system_settings.findUnique({ where: { key: 'inventory.license_alert_days_first' } }),
        prisma.system_settings.findUnique({ where: { key: 'inventory.license_alert_days_second' } }),
      ])
      const daysFirst = firstSetting ? parseInt(firstSetting.value, 10) : 30
      const daysSecond = secondSetting ? parseInt(secondSetting.value, 10) : 7

      // Enviar alertas para diferentes períodos
      const alerts30DaysSent = await this.sendExpirationNotifications(daysFirst)
      const alerts7DaysSent = await this.sendExpirationNotifications(daysSecond)
      const alerts1DaySent = await this.sendExpirationNotifications(1)

      const result = {
        alerts30DaysSent,
        alerts7DaysSent,
        alerts1DaySent,
      }

      console.log('[CheckLicenseExpirationJob] Ejecución completada:', result)
      return result
    } catch (error) {
      console.error('[CheckLicenseExpirationJob] Error en ejecución del job:', error)
      throw error
    }
  }
}
