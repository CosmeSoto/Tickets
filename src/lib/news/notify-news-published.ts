/**
 * Notificación unificada al publicar una noticia: in-app (push + SSE) y,
 * de forma adicional, email a los mismos destinatarios de la visibilidad.
 *
 * Antes esta lógica vivía duplicada (~40 líneas idénticas) en el POST de
 * /api/admin/news y el PUT de /api/admin/news/[id]; ahora ambos llaman a
 * notifyNewsPublished() una sola vez.
 */

import { NotificationType } from '@prisma/client'
import { NotificationService } from '@/lib/services/notification-service'
import { NotificationEvents } from '@/lib/notification-events'
import { getNewsNotificationLink, getNewsNotificationRecipientIds } from './news-access'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'
import { buildOperationalEmail } from '@/lib/services/email/operational-email'
import { getEmailBranding } from '@/lib/services/email/email-branding'
import { escapeHtml } from '@/lib/services/email/email-layout'
import {
  truncateForEmail,
  resolveAbsoluteUrl,
  PRIORITY_LABELS,
} from '@/lib/services/email/email-template-utils'

type NotifyRecipient = { id: string; role: string; canManageNews: boolean; email: string | null }

const NEWS_TYPE_LABELS: Record<string, string> = {
  NEWS: 'Noticia',
  ANNOUNCEMENT: 'Comunicado',
  EVENT: 'Evento',
  BIRTHDAY: 'Cumpleaños',
  HOLIDAY: 'Festividad',
  ALERT: 'Alerta',
  INTERNAL_AD: 'Publicidad Interna',
  RECOGNITION: 'Reconocimiento',
}

export interface NotifyNewsPublishedInput {
  newsId: string
  title: string
  summary?: string | null
  content?: string | null
  type: string
  priority: string
  actorUserId: string
}

/** Envía el email de "nueva noticia publicada", agrupando destinatarios por
 *  el enlace que les corresponde (según rol) para no re-renderizar el
 *  correo una vez por usuario. No bloquea ni lanza — cualquier fallo se
 *  registra y se ignora (la notificación in-app ya se hizo). */
async function sendNewsPublishedEmails(
  recipients: NotifyRecipient[],
  news: Pick<NotifyNewsPublishedInput, 'title' | 'summary' | 'content' | 'type' | 'priority'>,
  actorUserId: string
) {
  const withEmail = recipients.filter(r => !!r.email)
  if (withEmail.length === 0) return

  const groups = new Map<string, NotifyRecipient[]>()
  for (const r of withEmail) {
    const link = getNewsNotificationLink(r)
    const list = groups.get(link)
    if (list) list.push(r)
    else groups.set(link, [r])
  }

  const typeLabel = NEWS_TYPE_LABELS[news.type] ?? news.type
  const priorityLabel = PRIORITY_LABELS[news.priority] ?? news.priority
  const excerpt = truncateForEmail(news.summary || news.content || '')
  const isUrgent = news.priority === 'URGENT'

  let baseUrl = ''
  try {
    baseUrl = (await getEmailBranding()).baseUrl
  } catch {
    // sin baseUrl los enlaces quedan relativos; buildOperationalEmail igual funciona
  }

  for (const [link, group] of groups) {
    try {
      const { html, text } = await buildOperationalEmail({
        headline: 'Nueva noticia publicada',
        preheader: news.title,
        introHtml: `
          <p style="margin:0 0 8px;">Se publicó ${isUrgent ? 'una noticia <strong>urgente</strong>' : 'una nueva noticia'} que te corresponde ver.</p>
          <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#18181b;">${escapeHtml(news.title)}</p>
          ${excerpt ? `<p style="margin:0 0 8px;color:#71717a;font-size:13px;line-height:1.5;">${escapeHtml(excerpt).replace(/\n/g, '<br/>')}</p>` : ''}
        `,
        infoRows: [
          { label: 'Tipo', value: typeLabel },
          { label: 'Prioridad', value: priorityLabel },
        ],
        cta: { href: resolveAbsoluteUrl(baseUrl, link), label: 'Ver noticia' },
      })

      await queueNotificationEmail({
        recipients: group.map(r => ({ userId: r.id, email: r.email as string })),
        subject: `${isUrgent ? '🚨 ' : ''}Nueva noticia: ${news.title}`,
        html,
        text,
        module: 'content',
        event: 'newsPublished',
        // Programado unos segundos a futuro → queueNotificationEmail encola en
        // vez de enviar SMTP en línea, para no bloquear la respuesta si hay
        // muchos destinatarios (mismo patrón que alertas de contratos/licencias).
        scheduledAt: new Date(Date.now() + 15_000),
        actorUserId,
      })
    } catch (error) {
      console.error('[NEWS] Error enviando email de noticia publicada:', error)
    }
  }
}

export async function notifyNewsPublished(input: NotifyNewsPublishedInput): Promise<void> {
  try {
    const targetUsers = await getNewsNotificationRecipientIds(input.newsId, input.actorUserId)
    if (targetUsers.length === 0) return

    const targetIds = targetUsers.map(u => u.id)
    NotificationEvents.emitToMany?.(targetIds, {
      type: 'news_published',
      newsId: input.newsId,
      newsType: input.type,
    })

    const priorityLabel =
      input.priority === 'URGENT' ? '🚨 ' : input.priority === 'HIGH' ? '⚠️ ' : ''

    await Promise.allSettled([
      ...targetUsers.map(u =>
        NotificationService.push({
          userId: u.id,
          type:
            input.priority === 'URGENT' || input.priority === 'HIGH'
              ? NotificationType.WARNING
              : NotificationType.INFO,
          title: `${priorityLabel}Nueva noticia publicada`,
          message: input.title,
          metadata: { link: getNewsNotificationLink(u), newsId: input.newsId },
        })
      ),
      sendNewsPublishedEmails(targetUsers, input, input.actorUserId),
    ])
  } catch {
    // no-op: notificación opcional
  }
}
