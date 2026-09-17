import { getSystemBranding } from '@/lib/branding'
import prisma from '@/lib/prisma'
import { LicenseService } from '../services/license.service'
import { NotificationService } from '../services/notification-service'
import {
  getFamilyScopedAdmins,
  getAreaEmailRecipients,
} from '@/lib/notifications/family-recipients'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'

/**
 * Job para avisar del pago de renovación próximo de licencias SIN contrato
 * vinculado (para licencias con contrato, el aviso de pago ya lo cubre
 * ContractPaymentService.checkPaymentAlerts contra contract_payments).
 * Debe ejecutarse diariamente mediante cron, junto a CheckLicenseExpirationJob.
 */
export class CheckLicensePaymentJob {
  static async sendPaymentNotifications(
    daysAhead: number,
    dedupeField: 'paymentAlertFirstSentAt' | 'paymentAlertSecondSentAt'
  ): Promise<number> {
    try {
      console.log(`[CheckLicensePaymentJob] Enviando alertas de pago (${daysAhead} días antes)...`)

      const licenses = await LicenseService.getLicensesWithUpcomingPayment(daysAhead)

      if (licenses.length === 0) {
        console.log('[CheckLicensePaymentJob] No hay pagos de licencia próximos')
        return 0
      }

      let notificationsSent = 0
      const { systemName } = await getSystemBranding()

      for (const license of licenses) {
        // Mismo criterio de dedupe que CheckLicenseExpirationJob: el PUT de la
        // licencia resetea este campo a null si cambia fecha/costo/frecuencia
        // de renovación, así que solo se reenvía cuando corresponde.
        if ((license as any)[dedupeField]) continue

        const familyId = (license as any).licenseType?.familyId ?? null

        const pushAdmins = await getFamilyScopedAdmins(familyId, {
          id: true,
          email: true,
          name: true,
        })
        const emailAdmins = await getAreaEmailRecipients(familyId)

        if (pushAdmins.length === 0 && emailAdmins.length === 0) continue

        const daysRemaining = Math.ceil(
          (new Date((license as any).renewalDate!).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        )
        const typeName = license.licenseType?.name || 'Sin tipo'
        const cost = (license as any).renewalCost as number | null

        for (const admin of pushAdmins) {
          try {
            await NotificationService.push({
              userId: admin.id,
              type: daysRemaining <= 7 ? 'ERROR' : 'WARNING',
              title:
                daysRemaining <= 7
                  ? '¡URGENTE! Pago de Licencia Próximo'
                  : 'Pago de Licencia Próximo',
              message: `La licencia "${license.name}" (${typeName}) se renueva en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}${cost != null ? ` — costo estimado $${cost.toFixed(2)}` : ''}.`,
              metadata: { link: `/inventory/license/${license.id}` },
            })
            notificationsSent++
          } catch (error) {
            console.error(
              `[CheckLicensePaymentJob] Error enviando notificación in-app para ${license.name}:`,
              error
            )
          }
        }

        for (const admin of emailAdmins) {
          if (!admin.email) continue
          try {
            await queueNotificationEmail({
              to: admin.email,
              subject:
                daysRemaining <= 7
                  ? `¡URGENTE! Pago de Licencia Próximo - ${license.name}`
                  : `Pago de Licencia Próximo - ${license.name}`,
              html: this.generateEmailBody(
                license,
                daysRemaining,
                admin.name ?? 'Administrador',
                systemName
              ),
              recipientUserId: admin.id,
              module: 'inventory',
              event: 'inventoryAlert',
              priority: 'important',
            })
          } catch (error) {
            console.error(
              `[CheckLicensePaymentJob] Error enviando email para ${license.name}:`,
              error
            )
          }
        }

        if (pushAdmins.length > 0 || emailAdmins.length > 0) {
          await prisma.software_licenses
            .update({ where: { id: license.id }, data: { [dedupeField]: new Date() } })
            .catch((error: unknown) =>
              console.error(
                `[CheckLicensePaymentJob] Error marcando ${dedupeField} para ${license.name}:`,
                error
              )
            )
        }
      }

      console.log(
        `[CheckLicensePaymentJob] ${notificationsSent} notificaciones enviadas para ${licenses.length} licencias`
      )
      return notificationsSent
    } catch (error) {
      console.error('[CheckLicensePaymentJob] Error enviando notificaciones:', error)
      throw error
    }
  }

  private static generateEmailBody(
    license: any,
    daysRemaining: number,
    adminName: string,
    systemName: string
  ): string {
    const renewalDate = new Date(license.renewalDate!).toLocaleDateString('es-ES', {
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
      <h2>${daysRemaining <= 7 ? '⚠️ URGENTE: Pago de Licencia Próximo' : '📋 Pago de Licencia Próximo'}</h2>
    </div>
    <div class="content">
      <p>Hola ${adminName},</p>

      <p>Te informamos que la siguiente licencia (sin contrato vinculado) se renueva en <strong>${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'}</strong>:</p>

      <div class="info-box">
        <p><strong>Licencia:</strong> ${license.name}</p>
        <p><strong>Tipo:</strong> ${license.licenseType?.name || 'Sin tipo'}</p>
        <p><strong>Fecha de renovación:</strong> ${renewalDate}</p>
        ${license.vendor ? `<p><strong>Proveedor:</strong> ${license.vendor}</p>` : ''}
        ${license.renewalCost ? `<p><strong>Costo de renovación:</strong> $${license.renewalCost.toFixed(2)} USD</p>` : ''}
      </div>

      <p><strong>Acciones recomendadas:</strong></p>
      <ul>
        <li>Confirmar si la licencia se va a renovar</li>
        <li>Gestionar el pago con el proveedor</li>
        <li>Actualizar la fecha/costo de renovación en el sistema una vez pagado</li>
      </ul>

      <p style="text-align: center;">
        <a href="${process.env.NEXTAUTH_URL}/inventory/license/${license.id}" class="button">
          Ver Detalles de la Licencia
        </a>
      </p>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático del ${systemName}</p>
      <p>Por favor no responder a este correo</p>
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  static async run(): Promise<{ alertsFirstSent: number; alertsSecondSent: number }> {
    console.log('[CheckLicensePaymentJob] Iniciando ejecución del job...')

    try {
      const [firstSetting, secondSetting] = await Promise.all([
        prisma.system_settings.findUnique({
          where: { key: 'inventory.license_payment_alert_days_first' },
        }),
        prisma.system_settings.findUnique({
          where: { key: 'inventory.license_payment_alert_days_second' },
        }),
      ])
      const daysFirst = firstSetting ? parseInt(firstSetting.value, 10) : 30
      const daysSecond = secondSetting ? parseInt(secondSetting.value, 10) : 7

      const alertsFirstSent = await this.sendPaymentNotifications(
        daysFirst,
        'paymentAlertFirstSentAt'
      )
      const alertsSecondSent = await this.sendPaymentNotifications(
        daysSecond,
        'paymentAlertSecondSentAt'
      )

      const result = { alertsFirstSent, alertsSecondSent }
      console.log('[CheckLicensePaymentJob] Ejecución completada:', result)
      return result
    } catch (error) {
      console.error('[CheckLicensePaymentJob] Error en ejecución del job:', error)
      throw error
    }
  }
}
