import { NextRequest, NextResponse } from 'next/server'
import { getTelegramConfig } from '@/lib/services/telegram-config'
import { processUpdate } from '@/lib/telegram/process-update'

export async function POST(request: NextRequest) {
  const cfg = await getTelegramConfig().catch(() => null)
  const webhookSecret = cfg?.webhookSecret || ''

  if (!webhookSecret) {
    const isProd = process.env.NODE_ENV === 'production'
    const msg = '[TELEGRAM webhook] TELEGRAM_WEBHOOK_SECRET no configurado'
    if (isProd) {
      console.error(`${msg} — rechazando update en producción`)
      return NextResponse.json({ ok: true })
    }
    console.warn(`${msg} — aceptando update solo en desarrollo`)
  } else {
    const incoming = request.headers.get('x-telegram-bot-api-secret-token')
    if (incoming !== webhookSecret) {
      console.warn('[TELEGRAM webhook] Secret token inválido — ignorando update')
      return NextResponse.json({ ok: true })
    }
  }

  let update: unknown
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  processUpdate(update as Parameters<typeof processUpdate>[0]).catch(err =>
    console.error('[TELEGRAM webhook] Error en processUpdate:', err)
  )

  return NextResponse.json({ ok: true })
}
