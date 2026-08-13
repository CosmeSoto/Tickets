import { NextRequest, NextResponse } from 'next/server'
import { checkBatchUtilization } from '@/lib/cron/check-batch-utilization'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

/**
 * GET /api/cron/batch-utilization
 * Cron diario para alertas de stock/utilización en lotes.
 *
 * Configurar en cron:
 * 0 8 * * * curl "https://tu-dominio.com/api/cron/batch-utilization?secret=TU_SECRET"
 */
export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    const result = await checkBatchUtilization()

    return NextResponse.json({
      success: true,
      alertsSent: result.alertsSent,
      emailsSent: result.emailsSent,
      batchesChecked: result.batchesChecked,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in batch utilization cron:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error al verificar lotes',
      },
      { status: 500 }
    )
  }
}
