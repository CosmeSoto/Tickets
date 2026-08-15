import { NotificationType } from '@prisma/client'
import prisma from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification-service'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'
import { queueTelegramNotification } from '@/lib/notifications/queue-notification-telegram'

const REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Informa al responsable de procesos publicados cuya fecha de revisión venció.
 * `lastReviewReminderAt` evita notificaciones duplicadas cuando el cron corre
 * más de una vez al día; mientras no se genere una nueva versión, reavisa cada
 * siete días.
 */
export async function checkProcessReviewsDue() {
  const now = new Date()
  const remindBefore = new Date(now.getTime() - REMINDER_INTERVAL_MS)
  const processes = await (prisma as any).processes.findMany({
    where: {
      status: 'PUBLISHED',
      nextReviewAt: { lte: now },
      OR: [{ lastReviewReminderAt: null }, { lastReviewReminderAt: { lte: remindBefore } }],
    },
    select: {
      id: true,
      code: true,
      title: true,
      nextReviewAt: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  })

  const results = await Promise.allSettled(
    processes.map(async (process: any) => {
      const dueDate = process.nextReviewAt.toLocaleDateString('es-EC')
      const message = `${process.code} · ${process.title} requiere revisión desde ${dueDate}.`
      const safeMessage = `${escapeHtml(process.code)} · ${escapeHtml(process.title)} requiere revisión desde ${escapeHtml(dueDate)}.`

      await Promise.all([
        NotificationService.push({
          userId: process.owner.id,
          type: NotificationType.WARNING,
          title: 'Revisión de proceso vencida',
          message,
          metadata: { link: `/processes/${process.id}`, processId: process.id },
        }),
        queueNotificationEmail({
          to: process.owner.email,
          recipientUserId: process.owner.id,
          subject: `Revisión vencida: ${process.code}`,
          html: `<p>Hola ${escapeHtml(process.owner.name)},</p><p>${safeMessage}</p>`,
          text: message,
          module: 'processes',
          event: 'processReviewDue',
        }),
        queueTelegramNotification({
          recipientUserId: process.owner.id,
          title: 'Revisión de proceso vencida',
          body: message,
          module: 'processes',
          event: 'processReviewDue',
          link: `/processes/${process.id}`,
        }),
      ])

      await (prisma as any).processes.update({
        where: { id: process.id },
        data: { lastReviewReminderAt: now },
      })
      return process.id
    })
  )

  const sent = results.filter(result => result.status === 'fulfilled').length
  const errors = results.length - sent
  if (errors) {
    console.error(`[CRON] ${errors} recordatorio(s) de revisión de procesos fallaron`)
  }
  return { found: processes.length, sent, errors }
}
