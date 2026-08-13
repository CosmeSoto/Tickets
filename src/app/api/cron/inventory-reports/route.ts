import { NextRequest, NextResponse } from 'next/server'
import { runScheduledInventoryReports } from '@/lib/cron/run-scheduled-reports'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * GET /api/cron/inventory-reports
 * Ejecuta reportes de inventario programados y envía CSV por email.
 */
export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    const result = await runScheduledInventoryReports()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] inventory-reports:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error en cron de reportes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
