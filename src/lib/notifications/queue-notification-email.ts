/**
 * Única puerta de entrada para correos de notificación.
 * - Respeta SMTP unificado (emailEnabled) y preferencias
 * - Intenta envío inmediato; solo encola si SMTP falla o el envío está programado
 */

import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { isSystemEmailEnabled } from '@/lib/services/email/smtp-config'
import { canSendNotificationEmail } from './email-prefs'
import type { EmailModule, EmailPriority, NotificationEmailEvent } from './email-policy'
import { resolveEmailPriority } from './email-policy'
import {
  inlineAppImagesForEmail,
  serializeAttachments,
} from '@/lib/services/email/email-inline-images'
import type { Attachment } from 'nodemailer/lib/mailer'

export type QueueNotificationEmailInput = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  recipientUserId?: string | null
  /** Varios destinatarios usuario→email (filtra prefs uno a uno) */
  recipients?: Array<{ userId: string; email: string }>
  module: EmailModule
  event?: NotificationEmailEvent
  priority?: EmailPriority
  templateName?: string
  templateData?: Record<string, unknown>
  scheduledAt?: Date
  attachments?: Attachment[]
  /** Quien dispara (auditoría opcional; no se usa aún en cola) */
  actorUserId?: string
}

async function prepareBody(html: string, extraAttachments?: Attachment[]) {
  const inlined = await inlineAppImagesForEmail(html || '')
  return {
    html: inlined.html,
    attachments: [...(extraAttachments || []), ...inlined.attachments],
  }
}

async function persistToQueue(params: {
  to: string
  subject: string
  html: string
  templateName?: string
  templateData?: Record<string, unknown>
  scheduledAt?: Date
  attachments?: Attachment[]
  errorMessage?: string
  attempts?: number
  status?: 'pending' | 'failed'
}): Promise<string> {
  const prepared = await prepareBody(params.html, params.attachments)
  const serialized = serializeAttachments(prepared.attachments)
  const templatePayload = {
    ...(params.templateData || {}),
    ...(serialized.length ? { __attachments: serialized } : {}),
  }

  const row = await prisma.email_queue.create({
    data: {
      id: randomUUID(),
      toEmail: params.to,
      subject: params.subject,
      body: prepared.html || '',
      status: params.status || 'pending',
      attempts: params.attempts ?? 0,
      maxAttempts: 3,
      scheduledAt: params.scheduledAt || new Date(),
      templateName: params.templateName ?? null,
      templateData: Object.keys(templatePayload).length ? JSON.stringify(templatePayload) : null,
      errorMessage: params.errorMessage ?? null,
    },
  })
  return row.id
}

/**
 * Envía de inmediato si SMTP y preferencias lo permiten.
 * Si falla (o está programado a futuro), deja el mensaje en cola para reintento.
 */
export async function queueNotificationEmail(
  input: QueueNotificationEmailInput
): Promise<{ sent: number; queuedIds: string[] }> {
  if (!(await isSystemEmailEnabled())) {
    console.log(`[EMAIL] Omitido (${input.module}/${input.event ?? 'n/a'}): SMTP off`)
    return { sent: 0, queuedIds: [] }
  }

  const priority = resolveEmailPriority(input.event, input.priority)
  const queuedIds: string[] = []
  let sent = 0
  const scheduledAt = input.scheduledAt
  const isFuture = Boolean(scheduledAt && scheduledAt.getTime() > Date.now() + 5000)

  const sendOrQueue = async (to: string, userId?: string | null) => {
    if (userId) {
      const ok = await canSendNotificationEmail(userId, {
        module: input.module,
        event: input.event,
        priority,
      })
      if (!ok) {
        console.log(
          `[EMAIL] Omitido por prefs user=${userId} ${input.module}/${input.event ?? priority}`
        )
        return
      }
    } else if (priority === 'optional') {
      console.log(`[EMAIL] Omitido opcional sin userId (${input.event})`)
      return
    }

    if (isFuture) {
      const id = await persistToQueue({
        to,
        subject: input.subject,
        html: input.html || input.text || '',
        templateName: input.templateName,
        templateData: input.templateData,
        scheduledAt,
        attachments: input.attachments,
      })
      queuedIds.push(id)
      return
    }

    try {
      const { EmailService } = await import('@/lib/services/email/email-service')
      const prepared = await prepareBody(input.html || input.text || '', input.attachments)
      const ok = await EmailService.sendEmail({
        to,
        subject: input.subject,
        html: prepared.html,
        text: input.text,
        attachments: prepared.attachments,
        recipientUserId: userId ?? undefined,
        module: input.module,
        event: input.event,
        notificationPriority: priority,
      })
      if (ok) {
        sent += 1
        console.log(
          `[EMAIL] Enviado de inmediato → ${to} (${input.module}/${input.event ?? 'n/a'})`
        )
        return
      }
      throw new Error('sendEmail devolvió false')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error SMTP desconocido'
      console.error(`[EMAIL] Falló envío inmediato → ${to}: ${message}. Encolando para reintento.`)
      const id = await persistToQueue({
        to,
        subject: input.subject,
        html: input.html || input.text || '',
        templateName: input.templateName,
        templateData: input.templateData,
        scheduledAt,
        attachments: input.attachments,
        errorMessage: message,
        attempts: 1,
        status: 'pending',
      })
      queuedIds.push(id)
    }
  }

  if (input.recipients?.length) {
    for (const r of input.recipients) {
      if (!r.email) continue
      await sendOrQueue(r.email, r.userId)
    }
    return { sent, queuedIds }
  }

  const list = Array.isArray(input.to) ? input.to : [input.to]
  for (const to of list) {
    if (!to) continue
    await sendOrQueue(to, input.recipientUserId)
  }
  return { sent, queuedIds }
}
