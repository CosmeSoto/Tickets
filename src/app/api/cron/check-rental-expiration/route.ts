import { NextRequest, NextResponse } from 'next/server'
import { CheckRentalExpirationJob } from '@/lib/jobs/check-rental-expiration.job'
import { isInventoryAlertEnabled } from '@/lib/settings/runtime-settings'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

/**
 * Endpoint para ejecutar el job de verificación de contratos de renta próximos a expirar
 * Debe ser llamado diariamente por un cron job externo
 *
 * GET /api/cron/check-rental-expiration
 *
 * Seguridad: Verificar CRON_SECRET en headers
 */
export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    // Mismo toggle de Reglas: licencias y contratos (incluye rentas)
    const enabled = await isInventoryAlertEnabled('inventory.license_alert_enabled')
    if (!enabled) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'inventory.license_alert_enabled=false',
        timestamp: new Date().toISOString(),
      })
    }

    console.log('[CRON] Ejecutando check-rental-expiration job...')

    const result = await CheckRentalExpirationJob.run()

    return NextResponse.json({
      success: true,
      message: 'Job ejecutado exitosamente',
      data: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Error ejecutando check-rental-expiration job:', error)

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
