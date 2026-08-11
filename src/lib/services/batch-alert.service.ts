/**
 * BatchAlertService — Alertas operativas de lotes (stock bajo, alta utilización).
 * Ejecutado por cron diario; notifica a admins de la familia del modelo.
 */

import { prisma } from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification-service'
import { getFamilyScopedAdmins } from '@/lib/notifications/family-recipients'
import { getBatchUtilizationAlerts } from '@/lib/inventory/batch-alerts'
import { buildBatchAlertEmailHtml } from '@/lib/inventory/batch-alert-email'
import { getBatchAlertSettings } from '@/lib/inventory/batch-alert-settings'
import { enqueueEmail } from '@/lib/api/notify'
import { getSystemBranding } from '@/lib/branding'
import type { BatchMetrics } from '@/types/inventory/batch-inventory'

const DEDUP_HOURS = 24

export class BatchAlertService {
  static async checkUtilizationAlerts(): Promise<{
    alertsSent: number
    emailsSent: number
    batchesChecked: number
    skippedDisabled: boolean
  }> {
    const batches = await prisma.equipment_batches.findMany({
      where: { status: { not: 'cancelled' } },
      select: {
        id: true,
        batchCode: true,
        quantity: true,
        model: {
          select: {
            model: true,
            brand: { select: { name: true } },
            type: { select: { familyId: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    if (batches.length === 0) {
      return { alertsSent: 0, emailsSent: 0, batchesChecked: 0, skippedDisabled: false }
    }

    const batchIds = batches.map(b => b.id)
    const statusCounts = await prisma.equipment.groupBy({
      by: ['batchId', 'status'],
      where: { batchId: { in: batchIds } },
      _count: { id: true },
    })

    const metricsMap = new Map<string, BatchMetrics>()
    for (const row of statusCounts) {
      if (!row.batchId) continue
      if (!metricsMap.has(row.batchId)) {
        metricsMap.set(row.batchId, {
          total: 0,
          available: 0,
          assigned: 0,
          maintenance: 0,
          retired: 0,
          utilizationRate: 0,
        })
      }
      const m = metricsMap.get(row.batchId)!
      const count = row._count.id
      m.total += count
      if (row.status === 'AVAILABLE') m.available = count
      if (row.status === 'ASSIGNED') m.assigned = count
      if (row.status === 'MAINTENANCE') m.maintenance = count
      if (row.status === 'RETIRED') m.retired = count
    }

    const since = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000)
    let alertsSent = 0
    let emailsSent = 0
    const { systemName } = await getSystemBranding()

    for (const batch of batches) {
      const metrics = metricsMap.get(batch.id)
      if (!metrics || metrics.total === 0) continue

      metrics.utilizationRate = metrics.total > 0 ? (metrics.assigned / metrics.total) * 100 : 0

      const familyId = batch.model.type?.familyId ?? null
      const settings = await getBatchAlertSettings(familyId)
      if (!settings.enabled) continue

      const alerts = getBatchUtilizationAlerts(metrics, {
        lowStockThresholdPct: settings.lowStockThresholdPct,
      }).filter(a => a.level === 'critical' || a.level === 'warning')
      if (alerts.length === 0) continue

      const admins = await getFamilyScopedAdmins(familyId, { id: true, name: true, email: true })
      if (admins.length === 0) continue

      const primary = alerts[0]
      const brandModel = `${batch.model.brand?.name ?? ''} ${batch.model.model}`.trim()
      const sendEmail =
        (primary.level === 'critical' && settings.emailOnCritical) ||
        (primary.level === 'warning' && settings.emailOnWarning)

      for (const admin of admins) {
        const recent = await prisma.notifications.findFirst({
          where: {
            userId: admin.id,
            createdAt: { gte: since },
            AND: [
              { metadata: { path: ['type'], equals: 'batch_utilization' } },
              { metadata: { path: ['batchId'], equals: batch.id } },
            ],
          },
        })
        if (recent) continue

        const title = `Lote ${batch.batchCode}: ${primary.title}`
        const message = `${brandModel} — ${primary.message}`

        await NotificationService.push({
          userId: admin.id,
          type: primary.level === 'critical' ? 'WARNING' : 'INFO',
          title,
          message,
          metadata: {
            type: 'batch_utilization',
            batchId: batch.id,
            batchCode: batch.batchCode,
            alertLevel: primary.level,
            link: `/inventory/batches/${batch.id}`,
          },
        })
        alertsSent++

        if (sendEmail && admin.email) {
          const subjectPrefix =
            primary.level === 'critical' ? '[Inventario - Urgente]' : '[Inventario - Aviso]'
          await enqueueEmail({
            to: admin.email,
            subject: `${subjectPrefix} Lote ${batch.batchCode}: ${primary.title}`,
            html: buildBatchAlertEmailHtml({
              adminName: admin.name || 'Administrador',
              batchCode: batch.batchCode,
              brandModel,
              alert: primary,
              metrics,
              batchId: batch.id,
              systemName,
            }),
            recipientUserId: admin.id,
            module: 'inventory',
            event: 'inventoryAlert',
            // Crítico = important; aviso de uso = optional (menos ruido)
            priority: primary.level === 'critical' ? 'important' : 'optional',
          }).catch(() => {})
          emailsSent++
        }

        // Telegram: solo alertas críticas de inventario
        if (primary.level === 'critical') {
          const { queueTelegramNotification } = await import(
            '@/lib/notifications/queue-notification-telegram'
          )
          queueTelegramNotification({
            recipientUserId: admin.id,
            title: `Lote ${batch.batchCode}: ${primary.title}`,
            body: `${brandModel} — ${primary.message}`,
            module: 'inventory',
            event: 'inventoryAlert',
            priority: 'important',
            link: `/inventory/batches/${batch.id}`,
            telegramModule: 'inventory',
          }).catch(() => {})
        }
      }
    }

    return { alertsSent, emailsSent, batchesChecked: batches.length, skippedDisabled: false }
  }
}
