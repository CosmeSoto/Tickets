import { NextRequest, NextResponse } from 'next/server'
import { checkProcessReviewsDue } from '@/lib/cron/check-process-reviews'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/process-reviews
 * Ejecutar diariamente desde el scheduler externo con CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const unauthorized = verifyCronAuth(request)
  if (unauthorized) return unauthorized

  try {
    const result = await checkProcessReviewsDue()
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('[CRON] Error verificando revisiones de procesos:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al verificar revisiones de procesos',
      },
      { status: 500 }
    )
  }
}
