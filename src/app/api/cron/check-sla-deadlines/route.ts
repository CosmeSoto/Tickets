import { NextRequest, NextResponse } from 'next/server'
import { runSLAMonitor } from '@/lib/cron/sla-monitor'
import { checkTicketVolumeAlerts } from '@/lib/cron/check-ticket-volume-alerts'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

/**
 * Cron Job: Monitor SLA (avisos, violaciones, métricas) + alertas de volumen
 * Ejecutar cada hora
 */
export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    console.log('[CRON] Iniciando monitoreo SLA...')

    await runSLAMonitor()

    const volumeResult = await checkTicketVolumeAlerts()

    console.log('[CRON] Monitoreo SLA completado')

    return NextResponse.json({
      success: true,
      message: 'Monitoreo SLA completado',
      volumeAlertsSent: volumeResult.alertsSent,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Error en monitoreo SLA:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error en monitoreo SLA',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
