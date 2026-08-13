/**
 * GET /api/cron/patrol
 * Endpoint de cron job para mantenimiento del módulo de patrullas.
 * Protegido con CRON_SECRET (mismo patrón que otros cron routes).
 *
 * Ejecutar diariamente (ej: 02:00 AM).
 */

import { NextRequest, NextResponse } from 'next/server'
import { runPatrolMaintenanceJobs } from '@/lib/cron/patrol-maintenance'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    console.log('[CRON] Iniciando mantenimiento de patrullas...')

    const result = await runPatrolMaintenanceJobs()

    console.log('[CRON] Mantenimiento de patrullas completado:', result)

    return NextResponse.json({
      success: true,
      message: `Mantenimiento completado: ${result.reminderssSent} recordatorios, ${result.patrolsMissed} patrullas MISSED, ${result.patrolsAutoClosed} rondas cerradas automáticamente, ${result.patrolsGenerated} generadas, ${result.photosDeleted} fotos eliminadas`,
      data: result,
      timestamp: result.timestamp,
    })
  } catch (error) {
    console.error('[CRON] Error en mantenimiento de patrullas:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error en mantenimiento de patrullas',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
