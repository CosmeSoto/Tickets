/**
 * Cron Job: Procesar cola de alertas Telegram
 * Frecuencia recomendada: cada 1–5 minutos.
 */

import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'
import {
  processTelegramQueue,
  purgeOldTelegramQueueRows,
} from '@/lib/services/telegram-queue.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const unauthorized = verifyCronAuth(request)
  if (unauthorized) return unauthorized

  try {
    const result = await processTelegramQueue()
    const purged = await purgeOldTelegramQueueRows(7)

    console.log(
      `[CRON telegram-queue] Enviados: ${result.sent}, fallidos: ${result.failed}, purgados: ${purged}`
    )

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      purged,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON telegram-queue] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
