import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'
import prisma from '@/lib/prisma'
import { MsTodoSyncService } from '@/lib/services/ms-todo-sync-service'
import { MS_TODO_PROVIDER } from '@/lib/services/ms-todo-graph-service'

/**
 * Trae de vuelta cambios hechos directo en Microsoft To Do para CADA usuario
 * que tenga su cuenta conectada — a diferencia de /api/cron/planner-pull-changes
 * (un solo plan compartido, una sola llamada a Graph), acá hay una cuenta por
 * usuario, así que se itera una por una. Un token vencido o revocado de una
 * persona no debe tumbar la corrida completa: cada usuario se atrapa por
 * separado y se reporta en errorsByUser en vez de relanzar.
 *
 * GET /api/cron/ms-todo-pull-changes
 * Mismo paso de 5 minutos que el cron de Planner, mismo esquema de crontab:
 *   min-step-5 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/ms-todo-pull-changes
 *   (reemplazar "min-step-5" por el patrón de minuto "asterisco-slash-5")
 */
export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    console.log('[CRON] Ejecutando ms-todo-pull-changes...')

    const accounts = await prisma.oauth_accounts.findMany({
      where: { provider: MS_TODO_PROVIDER },
      select: { providerId: true },
    })

    const totals = { applied: 0, skipped: 0, errors: 0, retried: 0 }
    const errorsByUser: Record<string, string> = {}

    for (const account of accounts) {
      const userId = account.providerId
      try {
        const result = await MsTodoSyncService.pullChangesForUser(userId)
        totals.applied += result.applied
        totals.skipped += result.skipped
        totals.errors += result.errors

        // Reintenta tareas cuyo push nunca llegó a Microsoft (token vencido,
        // 5xx transitorio) — sin esto quedarían desincronizadas para
        // siempre, ya que solo un nuevo POST/PATCH del usuario dispara push.
        const retry = await MsTodoSyncService.retryErroredLinks(userId)
        totals.retried += retry.retried
      } catch (err) {
        totals.errors++
        const message = err instanceof Error ? err.message : 'Error desconocido'
        errorsByUser[userId] = message
        console.error('[CRON] ms-todo-pull-changes: error con el usuario', userId, message)
      }
    }

    return NextResponse.json({
      success: true,
      usersProcessed: accounts.length,
      ...totals,
      errorsByUser,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Error ejecutando ms-todo-pull-changes:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error ejecutando job',
        message: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
