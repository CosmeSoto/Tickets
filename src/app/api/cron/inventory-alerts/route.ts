import { NextRequest, NextResponse } from 'next/server'
import {
  checkContractAlerts,
  checkStockAlerts,
  checkMROExpiryAlerts,
  checkWarrantyAlerts,
} from '@/lib/inventory/notifications'
import { CheckLicenseExpirationJob } from '@/lib/jobs/check-license-expiration.job'
import { CheckRentalExpirationJob } from '@/lib/jobs/check-rental-expiration.job'
import { CheckAssignmentExpirationJob } from '@/lib/jobs/check-assignment-expiration.job'
import { isInventoryAlertEnabled } from '@/lib/settings/runtime-settings'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    const [lowStockEnabled, licenseEnabled, mroEnabled, warrantyEnabled] = await Promise.all([
      isInventoryAlertEnabled('inventory.low_stock_alert_enabled'),
      isInventoryAlertEnabled('inventory.license_alert_enabled'),
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
      tasks.push(CheckRentalExpirationJob.run())
    }
    if (mroEnabled) tasks.push(checkMROExpiryAlerts())
    if (warrantyEnabled) tasks.push(checkWarrantyAlerts())

    await Promise.allSettled(tasks)

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'EXPIRY_CHECK_RUN',
        entityType: 'system',
        entityId: 'cron',
        userId: 'system',
        details: { timestamp: new Date().toISOString() },
      },
    })

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
