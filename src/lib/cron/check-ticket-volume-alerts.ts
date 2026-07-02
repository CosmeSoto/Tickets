/**
 * Notifica cuando el volumen de tickets abiertos de un área supera el umbral configurado.
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationService } from '@/lib/services/notification-service'
import { getFamilyScopedAdmins } from '@/lib/notifications/family-recipients'

const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS'] as const

export async function checkTicketVolumeAlerts(): Promise<{ alertsSent: number }> {
  const configs = await prisma.ticket_family_config.findMany({
    where: {
      alertVolumeThreshold: { not: null },
      ticketsEnabled: true,
    },
    select: {
      familyId: true,
      alertVolumeThreshold: true,
      family: { select: { name: true, code: true } },
    },
  })

  if (configs.length === 0) return { alertsSent: 0 }

  let alertsSent = 0
  const todayKey = new Date().toISOString().slice(0, 10)

  for (const config of configs) {
    const threshold = config.alertVolumeThreshold
    if (!threshold || threshold <= 0) continue

    const openCount = await prisma.tickets.count({
      where: {
        familyId: config.familyId,
        status: { in: [...OPEN_STATUSES] },
      },
    })

    if (openCount <= threshold) continue

    const dedupeKey = `ticket_volume_alert:${config.familyId}:${todayKey}`
    const alreadySent = await prisma.system_settings.findUnique({
      where: { key: dedupeKey },
    })
    if (alreadySent) continue

    const recipients = await getFamilyScopedAdmins(config.familyId)
    const familyLabel = config.family?.name ?? config.familyId

    await Promise.allSettled(
      recipients.map(recipient =>
        NotificationService.createNotification({
          userId: recipient.id,
          title: 'Alto volumen de tickets',
          message: `${familyLabel} tiene ${openCount} tickets abiertos (umbral: ${threshold}).`,
          type: 'WARNING',
          metadata: {
            familyId: config.familyId,
            openCount,
            threshold,
            link: `/admin/settings/tickets?familyId=${config.familyId}`,
          },
        })
      )
    )

    await prisma.system_settings.upsert({
      where: { key: dedupeKey },
      create: {
        id: randomUUID(),
        key: dedupeKey,
        value: String(openCount),
        description: 'Dedupe diario de alerta de volumen de tickets',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: { value: String(openCount), updatedAt: new Date() },
    })

    alertsSent++
  }

  return { alertsSent }
}
