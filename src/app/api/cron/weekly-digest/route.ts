/**
 * GET|POST /api/cron/weekly-digest
 * Encola el resumen semanal por email (idempotente: 1x por semana ISO).
 * Protegido con CRON_SECRET.
 *
 * Recomendado: lunes 08:00 (zona del servidor)
 *   0 8 * * 1 curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/weekly-digest"
 */

import { NextResponse } from 'next/server'
import { runWeeklyNotificationDigest } from '@/lib/cron/weekly-notification-digest'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function handle(request: Request) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    console.log('[CRON] Ejecutando digest semanal de notificaciones...')
    const result = await runWeeklyNotificationDigest()
    console.log(
      `[CRON] Digest semanal: ${result.sent} enviados, ${result.skipped} omitidos, ${result.errors} errores (${result.candidates} candidatos)`
    )

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Error en weekly-digest:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
