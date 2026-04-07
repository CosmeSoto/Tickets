import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationService } from '@/lib/services/notification-service'

async function getAdminIds(): Promise<string[]> {
  const admins = await prisma.users.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  })
  return admins.map(a => a.id)
}

export async function checkContractAlerts(): Promise<void> {
  const alertDaysSetting = await prisma.system_settings.findUnique({
    where: { key: 'inventory.contract_alert_days' },
  })
  const alertDays = alertDaysSetting ? parseInt(alertDaysSetting.value, 10) : 30

  const today = new Date()
  const alertDate = new Date()
  alertDate.setDate(alertDate.getDate() + alertDays)

  const expiringContracts = await prisma.software_licenses.findMany({
    where: { expirationDate: { gte: today, lte: alertDate } },
    select: { id: true, name: true, expirationDate: true },
  })

  const adminIds = await getAdminIds()

  for (const contract of expiringContracts) {
    await Promise.all(adminIds.map(id =>
      NotificationService.push({
        userId: id,
        type: 'WARNING',
        title: 'Contrato próximo a vencer',
        message: `El contrato "${contract.name}" vence el ${contract.expirationDate?.toLocaleDateString('es-CL') ?? 'fecha desconocida'}.`,
        metadata: { link: '/inventory/licenses' },
      }).catch(() => {})
    ))

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'NOTIFICATION_SENT',
        entityType: 'contract',
        entityId: contract.id,
        details: { type: 'CONTRACT_EXPIRY_ALERT', alertDays },
      },
    })
  }
}

export async function checkStockAlerts(): Promise<void> {
  const lowStockItems = await prisma.$queryRaw<
    { id: string; name: string; currentStock: number; minStock: number }[]
  >`SELECT id, name, current_stock AS "currentStock", min_stock AS "minStock" FROM consumables WHERE current_stock <= min_stock`

  const adminIds = await getAdminIds()

  for (const item of lowStockItems) {
    await Promise.all(adminIds.map(id =>
      NotificationService.push({
        userId: id,
        type: 'WARNING',
        title: 'Stock bajo de material MRO',
        message: `El material "${item.name}" tiene stock bajo: ${item.currentStock} unidades (mínimo: ${item.minStock}).`,
        metadata: { link: '/inventory/consumables' },
      }).catch(() => {})
    ))

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'NOTIFICATION_SENT',
        entityType: 'asset',
        entityId: item.id,
        details: { type: 'LOW_STOCK_ALERT', currentStock: item.currentStock, minStock: item.minStock },
      },
    })
  }
}

export async function notifyOrphanContract(contractId: string): Promise<void> {
  const contract = await prisma.software_licenses.findUnique({
    where: { id: contractId },
    select: { id: true, name: true },
  })

  const adminIds = await getAdminIds()
  await Promise.all(adminIds.map(id =>
    NotificationService.push({
      userId: id,
      type: 'WARNING',
      title: 'Contrato sin activos vinculados',
      message: `El contrato "${contract?.name ?? contractId}" ha quedado sin activos vinculados.`,
      metadata: { link: '/inventory/licenses' },
    }).catch(() => {})
  ))

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'NOTIFICATION_SENT',
      entityType: 'contract',
      entityId: contractId,
      details: { type: 'ORPHAN_CONTRACT_ALERT' },
    },
  })
}

export async function checkMROExpiryAlerts(): Promise<void> {
  const enabledSetting = await prisma.system_settings.findUnique({
    where: { key: 'inventory.mro_expiry_alert_enabled' },
  })
  if (enabledSetting?.value === 'false') return

  const [daysSetting, urgentSetting] = await Promise.all([
    prisma.system_settings.findUnique({ where: { key: 'inventory.mro_expiry_alert_days' } }),
    prisma.system_settings.findUnique({ where: { key: 'inventory.mro_expiry_alert_days_urgent' } }),
  ])
  const alertDays = daysSetting ? parseInt(daysSetting.value, 10) : 30
  const urgentDays = urgentSetting ? parseInt(urgentSetting.value, 10) : 7

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const alertDate = new Date(today)
  alertDate.setDate(alertDate.getDate() + alertDays)

  const expiredItems = await prisma.consumables.findMany({
    where: { expirationDate: { lt: today }, status: { notIn: ['EXPIRED', 'RETIRED'] } },
    select: { id: true },
  })
  if (expiredItems.length > 0) {
    await prisma.consumables.updateMany({
      where: { id: { in: expiredItems.map(i => i.id) } },
      data: { status: 'EXPIRED' },
    })
  }

  const expiringItems = await prisma.consumables.findMany({
    where: {
      expirationDate: { gte: today, lte: alertDate },
      status: { notIn: ['EXPIRED', 'RETIRED'] },
    },
    select: { id: true, name: true, expirationDate: true, expiryAlertSentAt: true, currentStock: true },
  })

  const adminIds = await getAdminIds()

  for (const item of expiringItems) {
    if (item.expiryAlertSentAt) {
      const sentDate = new Date(item.expiryAlertSentAt)
      sentDate.setHours(0, 0, 0, 0)
      if (sentDate.getTime() === today.getTime()) continue
    }

    await Promise.all(adminIds.map(id =>
      NotificationService.push({
        userId: id,
        type: 'WARNING',
        title: 'Material MRO próximo a caducar',
        message: `Material "${item.name}" caduca el ${item.expirationDate?.toLocaleDateString('es-CL') ?? 'fecha desconocida'}. Stock actual: ${item.currentStock}.`,
        metadata: { link: '/inventory/consumables' },
      }).catch(() => {})
    ))

    const urgentDate = new Date(today)
    urgentDate.setDate(urgentDate.getDate() + urgentDays)
    if (item.expirationDate && item.expirationDate <= urgentDate) {
      await Promise.all(adminIds.map(id =>
        NotificationService.push({
          userId: id,
          type: 'ERROR',
          title: '¡URGENTE! Material MRO caduca pronto',
          message: `Material "${item.name}" caduca en menos de ${urgentDays} días (${item.expirationDate!.toLocaleDateString('es-CL')}). Stock: ${item.currentStock}.`,
          metadata: { link: '/inventory/consumables' },
        }).catch(() => {})
      ))
    }

    await prisma.consumables.update({
      where: { id: item.id },
      data: { expiryAlertSentAt: new Date() },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'NOTIFICATION_SENT',
        entityType: 'asset',
        entityId: item.id,
        details: { alertType: 'MRO_EXPIRY_ALERT', alertDays },
      },
    })
  }
}

export async function checkWarrantyAlerts(): Promise<void> {
  const enabledSetting = await prisma.system_settings.findUnique({
    where: { key: 'inventory.warranty_alert_enabled' },
  })
  if (enabledSetting?.value === 'false') return

  const daysSetting = await prisma.system_settings.findUnique({
    where: { key: 'inventory.warranty_alert_days' },
  })
  const alertDays = daysSetting ? parseInt(daysSetting.value, 10) : 30

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const alertDate = new Date(today)
  alertDate.setDate(alertDate.getDate() + alertDays)

  const expiringEquipment = await prisma.equipment.findMany({
    where: {
      warrantyExpiration: { gte: today, lte: alertDate },
      status: { not: 'RETIRED' },
    },
    select: { id: true, code: true, brand: true, model: true, warrantyExpiration: true },
  })

  const adminIds = await getAdminIds()

  for (const equip of expiringEquipment) {
    const alreadySent = await prisma.audit_logs.findFirst({
      where: {
        action: 'NOTIFICATION_SENT',
        entityType: 'asset',
        entityId: equip.id,
        createdAt: { gte: today },
        details: { path: ['alertType'], equals: 'WARRANTY_EXPIRY_ALERT' },
      },
    })
    if (alreadySent) continue

    await Promise.all(adminIds.map(id =>
      NotificationService.push({
        userId: id,
        type: 'WARNING',
        title: 'Garantía de equipo por vencer',
        message: `Garantía por vencer: ${equip.brand} ${equip.model} (${equip.code}) vence el ${equip.warrantyExpiration?.toLocaleDateString('es-CL') ?? 'fecha desconocida'}.`,
        metadata: { link: `/inventory/equipment/${equip.id}` },
      }).catch(() => {})
    ))

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'NOTIFICATION_SENT',
        entityType: 'asset',
        entityId: equip.id,
        details: { alertType: 'WARRANTY_EXPIRY_ALERT', alertDays },
      },
    })
  }
}
