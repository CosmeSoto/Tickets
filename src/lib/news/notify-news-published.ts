/**
 * Notificación unificada al publicar una noticia: in-app (push + SSE)
 * siempre, y además email y/o Telegram si el autor activó esos toggles
 * en la noticia (news.notifyEmail / news.notifyTelegram).
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
import { queueTelegramNotification } from '@/lib/notifications/queue-notification-telegram'
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

/** Solo se intenta incrustar la portada si es una ruta propia de la app o
 *  una URL que termina en extensión de imagen — enlaces de YouTube/Google
 *  Drive/OneDrive (comunes en news.imageUrl, ver detectMedia) no son
 *  imágenes embebibles y se omiten en el correo. */
const DIRECT_IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i
function isEmbeddableImageUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/')) return true
  return DIRECT_IMAGE_RE.test(trimmed)
}

export interface NotifyNewsPublishedInput {
  newsId: string
  title: string
  summary?: string | null
  content?: string | null
  imageUrl?: string | null
  type: string
  priority: string
  actorUserId: string
  /** El autor decide por noticia si además del in-app se envía por estos canales. */
  notifyEmail: boolean
  notifyTelegram: boolean
}

/** Envía el email de "nueva noticia publicada", agrupando destinatarios por
 *  el enlace que les corresponde (según rol) para no re-renderizar el
 *  correo una vez por usuario. No bloquea ni lanza — cualquier fallo se
 *  registra y se ignora (la notificación in-app ya se hizo). */
async function sendNewsPublishedEmails(
  recipients: NotifyRecipient[],
  news: Pick<
    NotifyNewsPublishedInput,
    'title' | 'summary' | 'content' | 'imageUrl' | 'type' | 'priority'
  >,
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

  const imageHtml =
    news.imageUrl && isEmbeddableImageUrl(news.imageUrl)
      ? `<img src="${escapeHtml(resolveAbsoluteUrl(baseUrl, news.imageUrl))}" alt="" style="display:block;width:100%;max-width:456px;height:auto;border-radius:6px;margin:0 0 12px;" />`
      : ''

  for (const [link, group] of groups) {
    try {
      const { html, text } = await buildOperationalEmail({
        headline: 'Nueva noticia publicada',
        preheader: news.title,
        introHtml: `
          <p style="margin:0 0 8px;">Se publicó ${isUrgent ? 'una noticia <strong>urgente</strong>' : 'una nueva noticia'} que te corresponde ver.</p>
          ${imageHtml}
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

/** Envía la alerta de Telegram — solo si el autor activó el toggle en la
 *  noticia. El evento newsPublished tiene prioridad 'optional' por defecto
 *  (nunca se envía automáticamente, ver telegram-policy.ts); al ser un
 *  toggle explícito por noticia, forzamos 'important' para saltar ese
 *  filtro solo en este envío puntual. */
async function sendNewsPublishedTelegram(
  recipients: NotifyRecipient[],
  news: Pick<NotifyNewsPublishedInput, 'title' | 'summary' | 'content' | 'priority'>
) {
  if (recipients.length === 0) return

  const groups = new Map<string, NotifyRecipient[]>()
  for (const r of recipients) {
    const link = getNewsNotificationLink(r)
    const list = groups.get(link)
    if (list) list.push(r)
    else groups.set(link, [r])
  }

  const isUrgent = news.priority === 'URGENT'
  const excerpt = truncateForEmail(news.summary || news.content || '', 200)
  const title = `${isUrgent ? '🚨' : '📰'} Nueva noticia publicada`
  const body = excerpt ? `${news.title}\n\n${excerpt}` : news.title

  for (const [link, group] of groups) {
    try {
      await queueTelegramNotification({
        recipients: group.map(r => ({ userId: r.id })),
        title,
        body,
        module: 'content',
        event: 'newsPublished',
        priority: 'important',
        link,
      })
    } catch (error) {
      console.error('[NEWS] Error enviando Telegram de noticia publicada:', error)
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
      input.notifyEmail
        ? sendNewsPublishedEmails(targetUsers, input, input.actorUserId)
        : Promise.resolve(),
      input.notifyTelegram ? sendNewsPublishedTelegram(targetUsers, input) : Promise.resolve(),
    ])
  } catch {
    // no-op: notificación opcional
  }
}
