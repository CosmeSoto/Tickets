import { NextRequest, NextResponse } from 'next/server'
import { SLAService } from '@/lib/services/sla-service'

/**
 * Cron Job: Verificar deadlines de SLA próximos a vencer
 * Ejecutar cada hora
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar que la petición viene del cron (seguridad)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    console.log('[CRON] Iniciando verificación de deadlines SLA...')

    // Verificar tickets próximos a vencer
    await SLAService.checkUpcomingDeadlines()

    console.log('[CRON] Verificación de deadlines SLA completada')

    return NextResponse.json({
      success: true,
      message: 'Verificación de deadlines SLA completada',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[CRON] Error verificando deadlines SLA:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error verificando deadlines SLA',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
