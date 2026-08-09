import { NextRequest, NextResponse } from 'next/server'
import { runSLAMonitor } from '@/lib/cron/sla-monitor'
import { checkTicketVolumeAlerts } from '@/lib/cron/check-ticket-volume-alerts'

/**
 * Cron Job: Monitor SLA (avisos, violaciones, métricas) + alertas de volumen
 * Ejecutar cada hora
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[CRON] CRON_SECRET no configurado — rechazando check-sla-deadlines')
      return NextResponse.json(
        { success: false, message: 'CRON_SECRET no configurado' },
        { status: 503 }
      )
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

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
