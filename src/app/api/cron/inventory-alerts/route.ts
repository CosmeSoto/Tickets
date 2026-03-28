import { NextRequest, NextResponse } from 'next/server'
import { checkContractAlerts, checkStockAlerts } from '@/lib/inventory/notifications'

/**
 * Endpoint para ejecutar las alertas de inventario (contratos por vencer y stock bajo).
 * Debe ser llamado diariamente por un cron job externo.
 *
 * GET /api/cron/inventory-alerts
 *
 * Seguridad: Verificar CRON_SECRET en headers
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await Promise.all([checkContractAlerts(), checkStockAlerts()])

    return NextResponse.json({
      success: true,
      message: 'Alertas procesadas',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Error procesando alertas',
        message: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
