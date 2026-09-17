import { NextRequest, NextResponse } from 'next/server'
import {
  checkContractAlerts,
  checkSubscriptionGovernanceAlerts,
  checkStockAlerts,
  checkMROExpiryAlerts,
  checkWarrantyAlerts,
} from '@/lib/inventory/notifications'
import { CheckLicenseExpirationJob } from '@/lib/jobs/check-license-expiration.job'
import { CheckLicensePaymentJob } from '@/lib/jobs/check-license-payment.job'
import { CheckRentalExpirationJob } from '@/lib/jobs/check-rental-expiration.job'
import { CheckAssignmentExpirationJob } from '@/lib/jobs/check-assignment-expiration.job'
import { checkPaymentAlerts } from '@/lib/cron/check-payment-alerts'
import { isInventoryAlertEnabled } from '@/lib/settings/runtime-settings'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    const [lowStockEnabled, licenseEnabled, licensePaymentEnabled, mroEnabled, warrantyEnabled] =
      await Promise.all([
        isInventoryAlertEnabled('inventory.low_stock_alert_enabled'),
        isInventoryAlertEnabled('inventory.license_alert_enabled'),
        isInventoryAlertEnabled('inventory.license_payment_alert_enabled'),
        isInventoryAlertEnabled('inventory.mro_expiry_alert_enabled'),
        isInventoryAlertEnabled('inventory.warranty_alert_enabled'),
      ])

    // Asignaciones siempre (no es alerta de vencimiento de catálogo).
    const tasks: Promise<unknown>[] = [CheckAssignmentExpirationJob.run()]

    if (lowStockEnabled) tasks.push(checkStockAlerts())
    // Licencias + contratos comerciales + rentas: mismo toggle de Reglas generales
    if (licenseEnabled) {
      tasks.push(CheckLicenseExpirationJob.run())
      tasks.push(checkContractAlerts())
      tasks.push(checkSubscriptionGovernanceAlerts())
      tasks.push(CheckRentalExpirationJob.run())
      tasks.push(checkPaymentAlerts())
    }
    // Alerta de pago para licencias SIN contrato — toggle propio, independiente
    // del de vencimiento, ver inventory.license_payment_alert_enabled.
    if (licensePaymentEnabled) tasks.push(CheckLicensePaymentJob.run())
    if (mroEnabled) tasks.push(checkMROExpiryAlerts())
    if (warrantyEnabled) tasks.push(checkWarrantyAlerts())

    await Promise.allSettled(tasks)

    // Bitácora informativa — un fallo acá (ej. FK userId='system' sin usuario
    // real seedeado en esta instancia) no debe tumbar la respuesta del cron:
    // las alertas de arriba ya corrieron igual vía Promise.allSettled.
    await prisma.audit_logs
      .create({
        data: {
          id: randomUUID(),
          action: 'EXPIRY_CHECK_RUN',
          entityType: 'system',
          entityId: 'cron',
          userId: 'system',
          details: { timestamp: new Date().toISOString() },
        },
      })
      .catch((err: unknown) =>
        console.error('[inventory-alerts] Error registrando audit_logs:', err)
      )

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
