import { NextRequest, NextResponse } from 'next/server'
import { CheckLicenseExpirationJob } from '@/lib/jobs/check-license-expiration.job'
import { isInventoryAlertEnabled } from '@/lib/settings/runtime-settings'

/**
 * Endpoint para ejecutar el job de verificación de licencias próximas a expirar
 * Debe ser llamado diariamente por un cron job externo
 *
 * GET /api/cron/check-license-expiration
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

    const enabled = await isInventoryAlertEnabled('inventory.license_alert_enabled')
    if (!enabled) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'inventory.license_alert_enabled=false',
        timestamp: new Date().toISOString(),
      })
    }

    console.log('[CRON] Ejecutando check-license-expiration job...')

    const result = await CheckLicenseExpirationJob.run()

    return NextResponse.json({
      success: true,
      message: 'Job ejecutado exitosamente',
      data: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Error ejecutando check-license-expiration job:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Error ejecutando job',
        message: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
