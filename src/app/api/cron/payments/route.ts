import { NextRequest, NextResponse } from 'next/server'
import { checkPaymentAlerts } from '@/lib/cron/check-payment-alerts'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/payments
 * Cron job para verificar alertas de pagos próximos y vencidos
 * Requiere secret en query params para seguridad
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    // Verificar secret
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

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
