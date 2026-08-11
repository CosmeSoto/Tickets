/**
 * POST /api/telegram/webhook
 *
 * Recibe updates de Telegram (modo producción — URL pública con HTTPS).
 * Verifica el secret token y delega el procesamiento a processUpdate().
 *
 * Modo local/desarrollo: usa /api/cron/telegram-poll en su lugar.
 * Ambos modos comparten la misma lógica de comandos (process-update.ts).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTelegramConfig } from '@/lib/services/telegram-config'
import { processUpdate } from '@/lib/telegram/process-update'

export async function POST(request: NextRequest) {
  // 1. Verificar secret token — desde BD (UI admin) o fallback a ENV
  const cfg = await getTelegramConfig().catch(() => null)
  const webhookSecret = cfg?.webhookSecret || ''

  if (webhookSecret) {
    const incoming = request.headers.get('x-telegram-bot-api-secret-token')
    if (incoming !== webhookSecret) {
      console.warn('[TELEGRAM webhook] Secret token inválido — ignorando update')
      return NextResponse.json({ ok: true }) // 200 siempre para que Telegram no reintente
    }
  }

  let update: unknown
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  // 2. Procesar con la lógica compartida (fire-and-forget, no bloquea la respuesta)
  processUpdate(update as Parameters<typeof processUpdate>[0]).catch(err =>
    console.error('[TELEGRAM webhook] Error en processUpdate:', err)
  )

  return NextResponse.json({ ok: true })
}
