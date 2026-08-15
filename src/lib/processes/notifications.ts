import { NotificationType } from '@prisma/client'
import { NotificationService } from '@/lib/services/notification-service'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'
import { queueTelegramNotification } from '@/lib/notifications/queue-notification-telegram'

const statusLabel: Record<string, string> = {
  DRAFT: 'borrador',
  PENDING_AREA_REVIEW: 'pendiente de revisión de área',
  PENDING_EXTERNAL_DPD: 'pendiente de revisión externa',
  PUBLISHED: 'publicado',
  REJECTED: 'rechazado',
  OBSOLETE: 'obsoleto',
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function notifyProcessStatusChange(input: {
  processId: string
  code: string
  title: string
  status: string
  owner: { id: string; email: string; name: string }
  actorId: string
}) {
  if (input.owner.id === input.actorId) return

  const label = statusLabel[input.status] || input.status
  const message = `${input.code} · ${input.title} ahora está ${label}.`
  const safeMessage = `${escapeHtml(input.code)} · ${escapeHtml(input.title)} ahora está ${escapeHtml(label)}.`
  const event =
    input.status === 'PUBLISHED'
      ? 'processPublished'
      : input.status === 'PENDING_AREA_REVIEW' || input.status === 'PENDING_EXTERNAL_DPD'
        ? 'processReview'
        : 'generic'

  await Promise.allSettled([
    NotificationService.push({
      userId: input.owner.id,
      type: NotificationType.INFO,
      title: 'Actualización de proceso',
      message,
      metadata: { link: `/processes/${input.processId}`, processId: input.processId },
    }),
    queueNotificationEmail({
      to: input.owner.email,
      recipientUserId: input.owner.id,
      subject: `Proceso actualizado: ${input.code}`,
      html: `<p>Hola ${escapeHtml(input.owner.name)},</p><p>${safeMessage}</p>`,
      text: message,
      module: 'processes',
      event,
      actorUserId: input.actorId,
    }),
    queueTelegramNotification({
      recipientUserId: input.owner.id,
      title: 'Actualización de proceso',
      body: message,
      module: 'processes',
      event,
      link: `/processes/${input.processId}`,
    }),
  ])
}
