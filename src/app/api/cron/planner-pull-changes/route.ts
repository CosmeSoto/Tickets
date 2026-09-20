import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'
import { PlannerSyncService } from '@/lib/services/planner-sync-service'

/**
 * Fase 2 de Planner: trae de vuelta cambios hechos directo en Microsoft
 * Planner (estado/progreso, título, fecha límite) — la sincronización app→
 * Planner (Fase 1) es inmediata y no usa este cron.
 *
 * Termina de inmediato (`skipped: true`) si el módulo no está conectado o si
 * el admin no activó "Recibir cambios hechos en Planner" en Configuración →
 * Tareas/Planner (por defecto queda apagado — es opt-in).
 *
 * GET /api/cron/planner-pull-changes
 * Cada 5 minutos alcanza de sobra (Planner no es tan urgente como un chat) y
 * mantiene el costo en una sola llamada a Microsoft Graph por corrida.
 * Ejemplo de crontab (paso de 5 minutos), con el curl en una sola línea:
 *   min-step-5 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/planner-pull-changes
 *   (reemplazar "min-step-5" por el patrón de minuto "asterisco-slash-5" — se separa aquí para no cerrar este comentario)
 *
 * Seguridad: verifica CRON_SECRET igual que el resto de crons del proyecto.
 */
export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    console.log('[CRON] Ejecutando planner-pull-changes...')

    const result = await PlannerSyncService.pullChanges()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Error ejecutando planner-pull-changes:', error)
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
