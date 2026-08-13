/**
 * Alertas de seguridad críticas por Telegram → super admins vinculados.
 */

import { getSuperAdmins } from '@/lib/notifications/family-recipients'
import { queueTelegramNotification } from '@/lib/notifications/queue-notification-telegram'

export async function notifySuperAdminsSecurityAlert(options: {
  title: string
  body: string
  link?: string
}): Promise<void> {
  const admins = await getSuperAdmins({ id: true })
  if (!admins.length) return

  await queueTelegramNotification({
    recipients: admins.map(admin => ({ userId: admin.id })),
    title: options.title,
    body: options.body,
    module: 'auth',
    event: 'security',
    priority: 'critical',
    link: options.link ?? '/admin/audit',
  }).catch(err => console.error('[TELEGRAM] notifySuperAdminsSecurityAlert:', err))
}
