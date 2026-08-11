/**
 * Cron Job: Limpiar tokens de vinculación Telegram expirados
 *
 * Elimina filas de telegram_link_tokens que:
 *   - ya expiraron (expiresAt < ahora), O
 *   - ya se usaron (usedAt != null) y tienen más de 24 horas
 *
 * Frecuencia recomendada: una vez al día (ej. 03:00 UTC).
 * Invocar con: GET /api/cron/telegram-cleanup
 * Header requerido: Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: Request) {
  // ── Autenticación ────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET ?? 'change-me-in-production'

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const now = new Date()
    // Tokens usados con más de 24 h de antigüedad
    const usedCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const { count } = await prisma.telegram_link_tokens.deleteMany({
      where: {
        OR: [
          // Expirados sin usar
          { expiresAt: { lt: now }, usedAt: null },
          // Ya usados con más de 24 h
          { usedAt: { lt: usedCutoff } },
        ],
      },
    })

    console.log(`[CRON telegram-cleanup] Eliminados ${count} tokens expirados/usados`)

    return NextResponse.json({
      success: true,
      deleted: count,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('[CRON telegram-cleanup] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al limpiar tokens' },
      { status: 500 }
    )
  }
}
