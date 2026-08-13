import { NextRequest, NextResponse } from 'next/server'
import { checkPaymentAlerts } from '@/lib/cron/check-payment-alerts'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/payments
 * Cron job para verificar alertas de pagos próximos y vencidos
 * Requiere secret en query params para seguridad
 */
export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    const result = await checkPaymentAlerts()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error en cron de pagos:', error)
    return NextResponse.json({ error: 'Error al verificar pagos' }, { status: 500 })
  }
}
