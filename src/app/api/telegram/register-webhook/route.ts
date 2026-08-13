/**
 * POST /api/telegram/register-webhook
 * GET  /api/telegram/register-webhook
 *
 * Solo Super Admin. Registra o consulta el webhook del bot.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import {
  registerTelegramWebhook,
  getTelegramWebhookInfo,
} from '@/lib/services/telegram.service'
import { getTelegramConfig, isTelegramEnabled } from '@/lib/services/telegram-config'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const check = await requireSuperAdmin(session)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const body = await request.json().catch(() => ({}))
  const explicitToken: string | undefined = body?.botToken

  const configured = explicitToken ? true : await isTelegramEnabled()
  if (!configured) {
    return NextResponse.json(
      {
        error:
          'El bot de Telegram no está configurado. Guarda el token primero en Admin → Configuración → Telegram.',
      },
      { status: 503 }
    )
  }

  const cfg = await getTelegramConfig()
  const hasSecret = Boolean(
    cfg?.webhookSecret ||
      process.env.TELEGRAM_WEBHOOK_SECRET ||
      body?.webhookSecret?.trim()
  )
  if (process.env.NODE_ENV === 'production' && !hasSecret) {
    return NextResponse.json(
      {
        error:
          'Configura TELEGRAM_WEBHOOK_SECRET (Admin → Telegram → Webhook Secret) antes de registrar el webhook en producción.',
      },
      { status: 400 }
    )
  }

  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const webhookUrl = body?.webhookUrl ?? `${appUrl}/api/telegram/webhook`

  const ok = await registerTelegramWebhook(webhookUrl, explicitToken)
  if (!ok) {
    return NextResponse.json(
      { error: 'No se pudo registrar el webhook. Revisa los logs del servidor.' },
      { status: 500 }
    )
  }

  const info = await getTelegramWebhookInfo(explicitToken)
  return NextResponse.json({ success: true, webhookUrl, info })
}

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  const check = await requireSuperAdmin(session)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const enabled = await isTelegramEnabled()
  if (!enabled) {
    return NextResponse.json({ configured: false, webhookInfo: null })
  }

  const cfg = await getTelegramConfig()
  const info = await getTelegramWebhookInfo()
  return NextResponse.json({
    configured: true,
    botUsername: cfg?.botUsername ?? null,
    webhookInfo: info,
  })
}
