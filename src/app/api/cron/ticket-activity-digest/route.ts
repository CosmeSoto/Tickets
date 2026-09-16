/**
 * GET|POST /api/cron/ticket-activity-digest
 * Vacía la cola de digest de comentarios/actualizaciones menores de tickets,
 * consolidando en un solo correo por (ticket, destinatario). Protegido con
 * CRON_SECRET. Idempotente: si no hay nada pendiente, o si aún no pasó el
 * intervalo configurado (Admin -> Configuración -> Tickets, default 30 min —
 * ver src/lib/cron/ticket-activity-digest.ts), no hace nada.
 *
 * Recomendado: cada 5 minutos (el intervalo real de envío se controla desde
 * la UI, no desde esta línea de crontab)
 *   0,5,10,15,20,25,30,35,40,45,50,55 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/ticket-activity-digest"
 */

import { NextResponse } from 'next/server'
import { runTicketActivityDigest } from '@/lib/cron/ticket-activity-digest'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function handle(request: Request) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    console.log('[CRON] Ejecutando digest de actividad de tickets...')
    const result = await runTicketActivityDigest()
    console.log(
      `[CRON] Digest de actividad: ${result.sent}/${result.groups} enviados, ${result.errors} errores`
    )

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Error en ticket-activity-digest:', error)
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
