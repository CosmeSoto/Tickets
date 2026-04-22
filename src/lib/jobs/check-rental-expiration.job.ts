import { randomUUID } from 'crypto'
import { NotificationService } from '../services/notification-service'
import { db as prisma } from '@/lib/server'

/**
 * Job para verificar contratos de renta próximos a expirar
 * Debe ejecutarse diariamente mediante cron
 */
export class CheckRentalExpirationJob {
  /**
   * Obtiene equipos rentados con contratos próximos a expirar
   * @param daysBeforeExpiration Días antes de la expiración
   */
  static async getExpiringRentals(daysBeforeExpiration: number) {
    try {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + daysBeforeExpiration)
      targetDate.setHours(0, 0, 0, 0)

      const nextDay = new Date(targetDate)
      nextDay.setDate(nextDay.getDate() + 1)

      const equipment = await prisma.equipment.findMany({
        where: {
          ownershipType: 'RENTAL',
          rentalEndDate: {
            gte: targetDate,
            lt: nextDay,
          },
          status: {
            not: 'RETIRED',
          },
        },
        select: {
          id: true,
          code: true,
          brand: true,
          model: true,
          rentalProvider: true,
          rentalEndDate: true,
          rentalMonthlyCost: true,
          rentalContactName: true,
          rentalContactEmail: true,
        },
      })

      return equipment
    } catch (error) {
      console.error('[CheckRentalExpirationJob] Error obteniendo rentas por expirar:', error)
      throw error
    }
  }

  /**
   * Envía notificaciones para contratos próximos a expirar
   */
  static async sendExpirationNotifications(daysBeforeExpiration: number): Promise<number> {
    try {
      console.log(`[CheckRentalExpirationJob] Enviando alertas (${daysBeforeExpiration} días antes)...`)

      const expiringRentals = await this.getExpiringRentals(daysBeforeExpiration)

      if (expiringRentals.length === 0) {
        console.log('[CheckRentalExpirationJob] No hay contratos próximos a expirar')
        return 0
      }

      // Obtener usuarios ADMIN para notificar
      const admins = await prisma.users.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, email: true, name: true },
      })

      let notificationsSent = 0

      for (const rental of expiringRentals) {
        const daysRemaining = daysBeforeExpiration
        const equipmentDescription = `${rental.brand} ${rental.model} (${rental.code})`
        const expirationDate = rental.rentalEndDate!

        // Crear notificaciones in-app para cada admin
        for (const admin of admins) {
          try {
            await NotificationService.push({
              userId: admin.id,
              type: daysRemaining === 1 ? 'ERROR' : 'WARNING',
              title: daysRemaining === 1
                ? '¡URGENTE! Contrato de Renta por Vencer'
                : 'Contrato de Renta Próximo a Vencer',
              message: `El contrato de renta del equipo ${equipmentDescription} con ${rental.rentalProvider} vence en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'} (${expirationDate.toLocaleDateString('es-ES')}).`,
              metadata: { link: `/inventory/equipment/${rental.id}` },
            })

            // Crear email en cola
            await prisma.email_queue.create({
              data: {
                id: randomUUID(),
                toEmail: admin.email,
                subject: daysRemaining === 1
                  ? `¡URGENTE! Contrato de Renta por Vencer - ${rental.code}`
                  : `Contrato de Renta Próximo a Vencer - ${rental.code}`,
                body: this.generateEmailBody(rental, daysRemaining, admin.name),
                status: 'pending',
                attempts: 0,
                maxAttempts: 3,
                scheduledAt: new Date(),
              },
            })

            notificationsSent++
          } catch (error) {
            console.error(`[CheckRentalExpirationJob] Error enviando notificación para ${rental.code}:`, error)
          }
        }
      }

      console.log(`[CheckRentalExpirationJob] ${notificationsSent} notificaciones enviadas para ${expiringRentals.length} equipos`)
      return notificationsSent
    } catch (error) {
      console.error('[CheckRentalExpirationJob] Error enviando notificaciones:', error)
      throw error
    }
  }

  /**
   * Genera el cuerpo del email de alerta
   */
  private static generateEmailBody(
    rental: any,
    daysRemaining: number,
    adminName: string
  ): string {
    const equipmentDescription = `${rental.brand} ${rental.model}`
    const expirationDate = rental.rentalEndDate!.toLocaleDateString('es-ES', {
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
    .header { background-color: ${daysRemaining === 1 ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid ${daysRemaining === 1 ? '#dc2626' : '#f59e0b'}; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${daysRemaining === 1 ? '⚠️ URGENTE: Contrato por Vencer' : '📋 Contrato Próximo a Vencer'}</h2>
    </div>
    <div class="content">
      <p>Hola ${adminName},</p>
      
      <p>Te informamos que el contrato de renta del siguiente equipo vence en <strong>${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}</strong>:</p>
      
      <div class="info-box">
        <p><strong>Equipo:</strong> ${equipmentDescription}</p>
        <p><strong>Código:</strong> ${rental.code}</p>
        <p><strong>Proveedor:</strong> ${rental.rentalProvider}</p>
        <p><strong>Fecha de Vencimiento:</strong> ${expirationDate}</p>
        ${rental.rentalMonthlyCost ? `<p><strong>Costo Mensual:</strong> $${rental.rentalMonthlyCost.toFixed(2)} USD</p>` : ''}
      </div>

      <p><strong>Acciones recomendadas:</strong></p>
      <ul>
        <li>Revisar si el equipo sigue siendo necesario</li>
        <li>Contactar al proveedor para renovar el contrato</li>
        <li>Evaluar la opción de compra del equipo</li>
        <li>Planificar la devolución si no se renovará</li>
      </ul>

      ${rental.rentalContactName || rental.rentalContactEmail ? `
      <p><strong>Contacto del Proveedor:</strong></p>
      <div class="info-box">
        ${rental.rentalContactName ? `<p><strong>Nombre:</strong> ${rental.rentalContactName}</p>` : ''}
        ${rental.rentalContactEmail ? `<p><strong>Email:</strong> ${rental.rentalContactEmail}</p>` : ''}
      </div>
      ` : ''}

      <p style="text-align: center;">
        <a href="${process.env.NEXTAUTH_URL}/inventory/equipment/${rental.id}" class="button">
          Ver Detalles del Equipo
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
    alerts15DaysSent: number
    alerts7DaysSent: number
    alerts1DaySent: number
  }> {
    console.log('[CheckRentalExpirationJob] Iniciando ejecución del job...')

    try {
      const [firstSetting, secondSetting] = await Promise.all([
        prisma.system_settings.findUnique({ where: { key: 'inventory.license_alert_days_first' } }),
        prisma.system_settings.findUnique({ where: { key: 'inventory.license_alert_days_second' } }),
      ])
      const daysFirst = firstSetting ? parseInt(firstSetting.value, 10) : 30
      const daysSecond = secondSetting ? parseInt(secondSetting.value, 10) : 7

      // Enviar alertas para diferentes períodos
      const alerts30DaysSent = await this.sendExpirationNotifications(daysFirst)
      const alerts15DaysSent = await this.sendExpirationNotifications(15)
      const alerts7DaysSent = await this.sendExpirationNotifications(daysSecond)
      const alerts1DaySent = await this.sendExpirationNotifications(1)

      const result = {
        alerts30DaysSent,
        alerts15DaysSent,
        alerts7DaysSent,
        alerts1DaySent,
      }

      console.log('[CheckRentalExpirationJob] Ejecución completada:', result)
      return result
    } catch (error) {
      console.error('[CheckRentalExpirationJob] Error en ejecución del job:', error)
      throw error
    }
  }
}
