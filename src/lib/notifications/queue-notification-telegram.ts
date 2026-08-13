/**
 * Única puerta de entrada para encolar alertas de Telegram.
 *
 * Paralelo de queue-notification-email:
 *   - Comprueba bot habilitado + switch global de alertas
 *   - Aplica política (solo critical + important)
 *   - Respeta preferencias de usuario
 *   - Encola en telegram_queue (envío async vía cron)
 */

import prisma from '@/lib/prisma'
import {
  getTelegramConfig,
  isTelegramEnabled,
  isTelegramNotificationsEnabled,
} from '@/lib/services/telegram-config'
import { enqueueTelegramAlert, processTelegramQueue } from '@/lib/services/telegram-queue.service'
import type { TelegramModule, TelegramEvent } from './telegram-policy'
import type { TelegramPriority } from '@/lib/services/telegram.service'
import { resolveTelegramPriority, shouldSendViaTelegram } from './telegram-policy'
import { filterUserIdsForTelegramNotification } from './telegram-prefs'

export type QueueTelegramNotificationInput = {
  recipientUserId?: string | null
  recipients?: Array<{ userId: string }>
  title: string
  body: string
  module: TelegramModule
  event?: TelegramEvent
  priority?: TelegramPriority
  link?: string
}

function resolveTgModule(
  module: TelegramModule
): 'tickets' | 'inventory' | 'backups' | 'patrols' | 'system' {
  const map = {
    tickets: 'tickets',
    inventory: 'inventory',
    system: 'system',
    auth: 'system',
    backups: 'backups',
    patrols: 'patrols',
    content: 'system',
    credentials: 'system',
  } as const
  return map[module]
}

/**
 * Encola alertas de Telegram para uno o varios usuarios.
 * Retorna los userIds encolados correctamente.
 */
export async function queueTelegramNotification(
  input: QueueTelegramNotificationInput
): Promise<string[]> {
  if (!(await isTelegramEnabled())) {
    console.log(`[TELEGRAM] Bot no habilitado — omitiendo (${input.module}/${input.event ?? 'n/a'})`)
    return []
  }

  if (!(await isTelegramNotificationsEnabled())) {
    console.log(
      `[TELEGRAM] Alertas globales desactivadas — omitiendo (${input.module}/${input.event ?? 'n/a'})`
    )
    return []
  }

  const priority = resolveTelegramPriority(input.event, input.priority)

  if (!shouldSendViaTelegram(priority)) {
    console.log(`[TELEGRAM] Omitido opcional (${input.module}/${input.event ?? priority})`)
    return []
  }

  const userIds: string[] = []
  if (input.recipients?.length) {
    userIds.push(...input.recipients.map(r => r.userId))
  } else if (input.recipientUserId) {
    userIds.push(input.recipientUserId)
  }

  if (userIds.length === 0) return []

  const allowedUserIds = await filterUserIdsForTelegramNotification(userIds, {
    module: input.module,
    event: input.event,
    priority,
  })

  if (allowedUserIds.length === 0) return []

  const users = await prisma.users.findMany({
    where: { id: { in: allowedUserIds } },
    select: { id: true, telegramChatId: true },
  })

  const queued: string[] = []
  const tgModule = resolveTgModule(input.module)

  for (const user of users) {
    if (!user.telegramChatId) {
      console.log(`[TELEGRAM] User ${user.id} no tiene chatId vinculado — omitido`)
      continue
    }

    try {
      await enqueueTelegramAlert({
        userId: user.id,
        chatId: user.telegramChatId,
        title: input.title,
        body: input.body,
        priority,
        link: input.link,
        module: tgModule,
      })
      queued.push(user.id)
    } catch (err) {
      console.error(`[TELEGRAM] Error encolando user=${user.id}:`, err)
    }
  }

  if (priority === 'critical' && queued.length > 0) {
    void processTelegramQueue().catch(err =>
      console.error('[TELEGRAM] Error en envío inmediato critical:', err)
    )
  }

  return queued
}

export async function getTelegramRuntimeStatus() {
  const cfg = await getTelegramConfig()
  const pending = await prisma.telegram_queue.count({ where: { status: 'pending' } }).catch(() => 0)
  return {
    botEnabled: Boolean(cfg?.enabled && cfg?.botToken),
    notificationsEnabled: Boolean(cfg?.notificationsEnabled),
    pendingQueue: pending,
  }
}
