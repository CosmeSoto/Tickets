/**
 * GET /api/cron/telegram-poll
 *
 * Polling de Telegram — alternativa al webhook para redes locales sin URL pública.
 *
 * Cómo funciona:
 *   1. Llama a getUpdates de la Bot API con long-polling (timeout=25 s).
 *   2. Procesa cada update con processUpdate() (misma lógica que el webhook).
 *   3. Guarda el último offset en system_settings para no reprocesar mensajes.
 *   4. Si hay un webhook activo en Telegram, este endpoint no hace nada (Telegram
 *      rechazará getUpdates mientras haya webhook registrado).
 *
 * Activación automática:
 *   - Local/desarrollo: llamar cada 30 s desde el entrypoint o un cron del SO.
 *   - Producción con URL pública: registrar el webhook con "Registrar Webhook"
 *     en Admin → Configuración → Telegram y dejar de llamar este endpoint.
 *
 * Seguridad: requiere Authorization: Bearer <CRON_SECRET> igual que los demás crons.
 *
 * Ejemplo crontab (cada 30 s, dos entradas):
 *   * * * * * curl -s -H "Authorization: Bearer SECRET" http://localhost:3000/api/cron/telegram-poll
 *   * * * * * sleep 30 && curl -s -H "Authorization: Bearer SECRET" http://localhost:3000/api/cron/telegram-poll
 */

import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'
import { getTelegramConfig, buildApiBase } from '@/lib/services/telegram-config'
import { processUpdate, type TelegramUpdateMessage } from '@/lib/telegram/process-update'

export const dynamic = 'force-dynamic'
export const maxDuration = 55 // justo por debajo del límite de 60 s de Next.js

// Clave donde se guarda el último offset procesado
const OFFSET_KEY = 'telegramPollOffset'

/** Evita llenar logs cuando la red no llega a api.telegram.org (LAN sin salida, firewall, etc.) */
let lastNetworkWarnAt = 0
const NETWORK_WARN_INTERVAL_MS = 5 * 60 * 1000

function logNetworkPollError(err: unknown) {
  const now = Date.now()
  if (now - lastNetworkWarnAt < NETWORK_WARN_INTERVAL_MS) return
  lastNetworkWarnAt = now
  const code =
    err instanceof Error && err.cause && typeof err.cause === 'object' && 'code' in err.cause
      ? String((err.cause as { code?: string }).code)
      : undefined
  console.warn(
    `[TELEGRAM poll] Sin conexión a api.telegram.org${code ? ` (${code})` : ''}. ` +
      'El cron reintentará; no afecta al resto del sistema. En LAN sin internet es normal; ' +
      'en hosting con salida HTTPS desaparece (o usa webhook en producción).'
  )
}

export async function GET(request: Request) {
  const unauthorized = verifyCronAuth(request)
  if (unauthorized) return unauthorized

  // ── Config del bot ──────────────────────────────────────────────────────────
  const cfg = await getTelegramConfig()
  if (!cfg?.enabled || !cfg.botToken) {
    return NextResponse.json({ success: true, skipped: true, reason: 'bot no habilitado' })
  }

  const apiBase = buildApiBase(cfg.botToken)

  // ── Leer offset guardado ────────────────────────────────────────────────────
  const offsetRow = await prisma.system_settings.findUnique({
    where: { key: OFFSET_KEY },
    select: { value: true },
  })
  const offset = offsetRow?.value ? parseInt(offsetRow.value, 10) : 0

  // ── getUpdates ──────────────────────────────────────────────────────────────
  let updates: TelegramUpdateMessage[] = []
  try {
    const res = await fetch(
      `${apiBase}/getUpdates?offset=${offset}&limit=50&timeout=25&allowed_updates=["message"]`,
      {
        // El fetch de Node tiene su propio timeout; 30 s > long-poll de 25 s
        signal: AbortSignal.timeout(30_000),
      }
    )

    if (!res.ok) {
      const body = await res.text()
      // 409 = hay un webhook activo — polling no permitido. No es un error real.
      if (res.status === 409) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'webhook activo — polling desactivado automáticamente',
        })
      }
      console.error(`[TELEGRAM poll] getUpdates HTTP ${res.status}: ${body}`)
      return NextResponse.json({ success: false, error: `HTTP ${res.status}` }, { status: 500 })
    }

    const data = await res.json()
    if (!data.ok) {
      // Descripción: "Conflict: can't use getUpdates method while webhook is active"
      if (
        typeof data.description === 'string' &&
        data.description.toLowerCase().includes('webhook')
      ) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'webhook activo — polling desactivado automáticamente',
        })
      }
      console.error('[TELEGRAM poll] getUpdates error:', data.description)
      return NextResponse.json({ success: false, error: data.description }, { status: 500 })
    }

    updates = data.result ?? []
  } catch (err) {
    // Timeout o error de red — no es crítico, el próximo ciclo lo reintentará
    logNetworkPollError(err)
    return NextResponse.json({ success: true, processed: 0, reason: 'error de red' })
  }

  if (!updates.length) {
    return NextResponse.json({ success: true, processed: 0 })
  }

  // ── Procesar updates ────────────────────────────────────────────────────────
  let processed = 0
  let newOffset = offset

  for (const update of updates) {
    // Avanzar offset ANTES de procesar (garantiza que aunque falle no se reprocese)
    if (update.update_id >= newOffset) {
      newOffset = update.update_id + 1
    }

    await processUpdate(update)
    processed++
  }

  // ── Guardar nuevo offset ────────────────────────────────────────────────────
  if (newOffset > offset) {
    await prisma.system_settings.upsert({
      where: { key: OFFSET_KEY },
      update: { value: String(newOffset), updatedAt: new Date() },
      create: {
        id: randomUUID(),
        key: OFFSET_KEY,
        value: String(newOffset),
        description: 'Último offset de Telegram getUpdates (polling mode)',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
  }

  return NextResponse.json({ success: true, processed, newOffset })
}
