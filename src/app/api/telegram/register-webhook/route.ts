/**
 * POST /api/telegram/register-webhook
 *
 * Solo ADMIN/SUPER_ADMIN. Registra o actualiza el webhook del bot en Telegram.
 * Lee el token desde system_settings (BD) con fallback a ENV.
 *
 * Body (opcional): { webhookUrl?: string, botToken?: string }
 *   - webhookUrl: si no se envía, se construye desde NEXTAUTH_URL
 *   - botToken: permite probar con un token recién guardado sin hacer GET primero
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  registerTelegramWebhook,
  getTelegramWebhookInfo,
} from '@/lib/services/telegram.service'
import { getTelegramConfig, isTelegramEnabled } from '@/lib/services/telegram-config'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!['ADMIN'].includes(session.user.role ?? '') && !session.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const explicitToken: string | undefined = body?.botToken

  // Verificar que hay configuración disponible
  const configured = explicitToken ? true : await isTelegramEnabled()
  if (!configured) {
    return NextResponse.json(
      { error: 'El bot de Telegram no está configurado. Guarda el token primero en Admin → Configuración → Telegram.' },
      { status: 503 }
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
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!['ADMIN'].includes(session.user.role ?? '') && !session.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

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
