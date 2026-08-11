/**
 * Única puerta de entrada para enviar alertas de Telegram.
 *
 * Paralelo exacto de queue-notification-email:
 *   - Comprueba que el bot esté configurado (TELEGRAM_BOT_TOKEN)
 *   - Aplica la política (solo critical + important)
 *   - Respeta el master switch del usuario (telegramNotifications)
 *   - Resuelve telegramChatId del usuario desde la BD
 *   - No lanza excepciones: fallo silencioso para no romper el flujo principal
 */

import prisma from '@/lib/prisma'
import { sendTelegramAlert } from '@/lib/services/telegram.service'
import { isTelegramEnabled } from '@/lib/services/telegram-config'
import type { TelegramModule, TelegramEvent } from './telegram-policy'
import type { TelegramPriority } from '@/lib/services/telegram.service'
import { resolveTelegramPriority, shouldSendViaTelegram } from './telegram-policy'

export type QueueTelegramNotificationInput = {
  /** Un userId o array de userIds destino */
  recipientUserId?: string | null
  recipients?: Array<{ userId: string }>
  title: string
  body: string
  module: TelegramModule
  event?: TelegramEvent
  priority?: TelegramPriority
  /** Link relativo o absoluto al backoffice */
  link?: string
  /** Para herencia de tipo de módulo en el emoji */
  telegramModule?: 'tickets' | 'inventory' | 'backups' | 'patrols' | 'system'
}

/**
 * Resuelve el módulo Telegram a partir del TelegramModule.
 */
function resolveTgModule(
  module: TelegramModule
): QueueTelegramNotificationInput['telegramModule'] {
  const map: Record<TelegramModule, QueueTelegramNotificationInput['telegramModule']> = {
    tickets: 'tickets',
    inventory: 'inventory',
    system: 'system',
    auth: 'system',
    backups: 'backups',
    patrols: 'patrols',
    content: 'system',
    credentials: 'system',
  }
  return map[module]
}

/**
 * Envía alertas de Telegram a uno o varios usuarios.
 * Retorna los userIds que recibieron la alerta correctamente.
 */
export async function queueTelegramNotification(
  input: QueueTelegramNotificationInput
): Promise<string[]> {
  if (!(await isTelegramEnabled())) {
    console.log(`[TELEGRAM] Bot no habilitado — omitiendo (${input.module}/${input.event ?? 'n/a'})`)
    return []
  }

  const priority = resolveTelegramPriority(input.event, input.priority)

  if (!shouldSendViaTelegram(priority)) {
    console.log(`[TELEGRAM] Omitido opcional (${input.module}/${input.event ?? priority})`)
    return []
  }

  // Construir lista de userIds a notificar
  const userIds: string[] = []
  if (input.recipients?.length) {
    userIds.push(...input.recipients.map(r => r.userId))
  } else if (input.recipientUserId) {
    userIds.push(input.recipientUserId)
  }

  if (userIds.length === 0) return []

  const sent: string[] = []

  for (const userId of userIds) {
    try {
      // Leer chatId + preferencia en una sola query
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          telegramChatId: true,
          user_settings: {
            select: { telegramNotifications: true },
          },
        },
      })

      if (!user?.telegramChatId) {
        console.log(`[TELEGRAM] User ${userId} no tiene chatId vinculado — omitido`)
        continue
      }

      const telegramEnabled = user.user_settings?.telegramNotifications ?? true
      if (!telegramEnabled) {
        console.log(`[TELEGRAM] User ${userId} tiene Telegram desactivado — omitido`)
        continue
      }

      const ok = await sendTelegramAlert({
        chatId: user.telegramChatId,
        title: input.title,
        body: input.body,
        priority,
        link: input.link,
        module: input.telegramModule ?? resolveTgModule(input.module),
      })

      if (ok) sent.push(userId)
    } catch (err) {
      console.error(`[TELEGRAM] Error enviando a user=${userId}:`, err)
      // Continuar con el siguiente — no bloquear
    }
  }

  return sent
}
