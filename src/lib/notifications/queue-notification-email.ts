/**
 * Única puerta de entrada para encolar correos de notificación.
 * - Respeta SMTP unificado (emailEnabled)
 * - Aplica política por módulo / prioridad / prefs
 * - Evita email_queue.create dispersos
 */

import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { isSystemEmailEnabled } from '@/lib/services/email/smtp-config'
import { canSendNotificationEmail } from './email-prefs'
import type { EmailModule, EmailPriority, NotificationEmailEvent } from './email-policy'
import { resolveEmailPriority } from './email-policy'

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
  /** Quien dispara (auditoría opcional; no se usa aún en cola) */
  actorUserId?: string
}

/**
 * Encola uno o varios correos si SMTP y preferencias lo permiten.
 * @returns ids encolados (vacío si se omitió)
 */
export async function queueNotificationEmail(
  input: QueueNotificationEmailInput
): Promise<string[]> {
  if (!(await isSystemEmailEnabled())) {
    console.log(`[EMAIL] Omitido (${input.module}/${input.event ?? 'n/a'}): SMTP off`)
    return []
  }

  const priority = resolveEmailPriority(input.event, input.priority)
  const ids: string[] = []

  const enqueueOne = async (to: string, userId?: string | null) => {
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
      // Sin usuario y opcional → no enviar (evita spam a externos en eventos ruidosos)
      console.log(`[EMAIL] Omitido opcional sin userId (${input.event})`)
      return
    }

    const row = await prisma.email_queue.create({
      data: {
        id: randomUUID(),
        toEmail: to,
        subject: input.subject,
        body: input.html || input.text || '',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        scheduledAt: input.scheduledAt || new Date(),
        templateName: input.templateName ?? null,
        templateData: input.templateData ? JSON.stringify(input.templateData) : null,
      },
    })
    ids.push(row.id)
  }

  if (input.recipients?.length) {
    for (const r of input.recipients) {
      if (!r.email) continue
      await enqueueOne(r.email, r.userId)
    }
    return ids
  }

  const list = Array.isArray(input.to) ? input.to : [input.to]
  for (const to of list) {
    if (!to) continue
    await enqueueOne(to, input.recipientUserId)
  }
  return ids
}
