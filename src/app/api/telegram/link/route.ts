/**
 * POST /api/telegram/link    — Genera un token de vinculación de 6 caracteres alfanuméricos.
 * DELETE /api/telegram/link  — Desvincula la cuenta Telegram del usuario actual.
 * GET /api/telegram/link     — Estado actual de vinculación.
 *
 * El token expira en 15 minutos y se invalida al usarse.
 * El usuario lo escribe en el bot: /vincular <token>
 *
 * NOTA: la config del bot se lee desde system_settings (BD) con fallback a ENV.
 * No se necesita TELEGRAM_BOT_TOKEN en el .env si el admin lo configuró desde la UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { getTelegramConfig, isTelegramEnabled } from '@/lib/services/telegram-config'

/** Genera un código de 6 caracteres A-Z0-9 legible */
function generateLinkCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin O, 0, I, 1 para evitar confusiones
  const bytes = randomBytes(6)
  return Array.from(bytes)
    .map(b => chars[b % chars.length])
    .join('')
}

// ─── GET: estado de vinculación ──────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const [user, pendingToken, cfg] = await Promise.all([
    prisma.users.findUnique({
      where: { id: session.user.id },
      select: {
        telegramChatId: true,
        phone: true,
        user_settings: { select: { telegramNotifications: true } },
      },
    }),
    prisma.telegram_link_tokens.findFirst({
      where: {
        userId: session.user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { token: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    // Leer config desde BD (donde el admin la guardó) con fallback a ENV
    getTelegramConfig(),
  ])

  return NextResponse.json({
    linked: !!user?.telegramChatId,
    telegramChatId: user?.telegramChatId ?? null,
    telegramNotifications: user?.user_settings?.telegramNotifications ?? true,
    phone: user?.phone ?? null,
    pendingToken: pendingToken
      ? { token: pendingToken.token, expiresAt: pendingToken.expiresAt }
      : null,
    // botConfigured = true si hay token en BD O en ENV, y el bot está habilitado
    botConfigured: !!(cfg?.enabled && cfg.botToken),
    botUsername: cfg?.botUsername ?? null,
  })
}

// ─── POST: generar token de vinculación ─────────────────────────────────────

export async function POST(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Verificar que el bot esté configurado (BD o ENV)
  const enabled = await isTelegramEnabled()
  if (!enabled) {
    return NextResponse.json(
      {
        error:
          'El bot de Telegram no está habilitado. El administrador debe configurarlo en Admin → Configuración → Telegram.',
      },
      { status: 503 }
    )
  }

  const cfg = await getTelegramConfig()
  const userId = session.user.id

  // Invalidar tokens anteriores no usados del mismo usuario
  await prisma.telegram_link_tokens.updateMany({
    where: { userId, usedAt: null },
    data: { expiresAt: new Date() },
  })

  const token = generateLinkCode()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 min

  await prisma.telegram_link_tokens.create({
    data: {
      id: `tlt_${randomBytes(12).toString('hex')}`,
      userId,
      token,
      expiresAt,
    },
  })

  return NextResponse.json({
    token,
    expiresAt,
    command: `/vincular ${token}`,
    botUrl: cfg?.botUsername ? `https://t.me/${cfg.botUsername}` : null,
  })
}

// ─── DELETE: desvincular ─────────────────────────────────────────────────────

export async function DELETE(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  await prisma.users.update({
    where: { id: session.user.id },
    data: { telegramChatId: null },
  })

  // Limpiar tokens pendientes
  await prisma.telegram_link_tokens.updateMany({
    where: { userId: session.user.id, usedAt: null },
    data: { expiresAt: new Date() },
  })

  return NextResponse.json({ success: true, message: 'Cuenta Telegram desvinculada' })
}
