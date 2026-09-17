import { NextRequest, NextResponse } from 'next/server'
import { CheckLicensePaymentJob } from '@/lib/jobs/check-license-payment.job'
import { isInventoryAlertEnabled } from '@/lib/settings/runtime-settings'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

/**
 * Endpoint para ejecutar el job de aviso de pago próximo de licencias SIN
 * contrato vinculado. Debe ser llamado diariamente por un cron job externo.
 *
 * GET /api/cron/check-license-payment
 *
 * Seguridad: Verificar CRON_SECRET en headers
 */
export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    const enabled = await isInventoryAlertEnabled('inventory.license_payment_alert_enabled')
    if (!enabled) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'inventory.license_payment_alert_enabled=false',
        timestamp: new Date().toISOString(),
      })
    }

    console.log('[CRON] Ejecutando check-license-payment job...')

    const result = await CheckLicensePaymentJob.run()

    return NextResponse.json({
      success: true,
      message: 'Job ejecutado exitosamente',
      data: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Error ejecutando check-license-payment job:', error)

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
