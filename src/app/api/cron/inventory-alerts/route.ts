import { NextRequest, NextResponse } from 'next/server'
import { checkContractAlerts, checkStockAlerts, checkMROExpiryAlerts, checkWarrantyAlerts } from '@/lib/inventory/notifications'
import { CheckLicenseExpirationJob } from '@/lib/jobs/check-license-expiration.job'
import { CheckRentalExpirationJob } from '@/lib/jobs/check-rental-expiration.job'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const [mroEnabled, warrantyEnabled] = await Promise.all([
      prisma.system_settings.findUnique({ where: { key: 'inventory.mro_expiry_alert_enabled' } }),
      prisma.system_settings.findUnique({ where: { key: 'inventory.warranty_alert_enabled' } }),
    ])

    const tasks: Promise<unknown>[] = [
      checkContractAlerts(),
      checkStockAlerts(),
      CheckLicenseExpirationJob.run(),
      CheckRentalExpirationJob.run(),
    ]

    if (mroEnabled?.value !== 'false') tasks.push(checkMROExpiryAlerts())
    if (warrantyEnabled?.value !== 'false') tasks.push(checkWarrantyAlerts())

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
