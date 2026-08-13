/**
 * Cola persistente de alertas Telegram con reintentos.
 * Paralelo a EmailService.processQueue().
 */

import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import {
  sendTelegramAlert,
  type TelegramPriority,
} from '@/lib/services/telegram.service'

export type EnqueueTelegramAlertInput = {
  userId?: string | null
  chatId: string
  title: string
  body: string
  priority: TelegramPriority
  module?: 'tickets' | 'inventory' | 'backups' | 'patrols' | 'system'
  link?: string
  scheduledAt?: Date
}

export async function enqueueTelegramAlert(input: EnqueueTelegramAlertInput): Promise<string> {
  const row = await prisma.telegram_queue.create({
    data: {
      id: randomUUID(),
      userId: input.userId ?? null,
      chatId: input.chatId,
      title: input.title,
      body: input.body,
      priority: input.priority,
      module: input.module ?? null,
      link: input.link ?? null,
      status: 'pending',
      scheduledAt: input.scheduledAt ?? new Date(),
    },
  })
  return row.id
}

export async function processTelegramQueue(): Promise<{ sent: number; failed: number }> {
  try {
    const now = new Date()
    const pending = await prisma.telegram_queue.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: now },
      },
      take: 50,
      orderBy: { scheduledAt: 'asc' },
    })

    const actionable = pending.filter(row => row.attempts < row.maxAttempts)
    let sent = 0
    let failed = 0

    for (const row of actionable) {
      try {
        await prisma.telegram_queue.update({
          where: { id: row.id },
          data: { status: 'sending', attempts: { increment: 1 } },
        })

        const ok = await sendTelegramAlert({
          chatId: row.chatId,
          title: row.title,
          body: row.body,
          priority: row.priority as TelegramPriority,
          link: row.link ?? undefined,
          module: (row.module as EnqueueTelegramAlertInput['module']) ?? 'system',
        })

        if (!ok) throw new Error('sendTelegramAlert devolvió false')

        await prisma.telegram_queue.update({
          where: { id: row.id },
          data: { status: 'sent', sentAt: new Date(), errorMessage: null },
        })
        sent++
      } catch (error) {
        const current = await prisma.telegram_queue.findUnique({
          where: { id: row.id },
          select: { attempts: true, maxAttempts: true },
        })
        const exhausted = current ? current.attempts >= current.maxAttempts : true
        await prisma.telegram_queue.update({
          where: { id: row.id },
          data: {
            status: exhausted ? 'failed' : 'pending',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            scheduledAt: exhausted ? undefined : new Date(Date.now() + 60_000),
          },
        })
        if (exhausted) failed++
      }
    }

    if (sent > 0 || failed > 0) {
      console.log(`[TELEGRAM-QUEUE] Procesado: ${sent} enviadas, ${failed} fallidas definitivas`)
    }

    return { sent, failed }
  } catch (error) {
    console.error('[TELEGRAM-QUEUE] Error procesando cola:', error)
    return { sent: 0, failed: 0 }
  }
}

/** Limpia filas enviadas antiguas (retención 7 días). */
export async function purgeOldTelegramQueueRows(days = 7): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const { count } = await prisma.telegram_queue.deleteMany({
    where: {
      status: { in: ['sent', 'failed'] },
      createdAt: { lt: cutoff },
    },
  })
  return count
}
