import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationService } from '@/lib/services/notification-service'
import { getFamilyScopedAdmins } from '@/lib/notifications/family-recipients'
import type { NotificationType } from '@prisma/client'

async function notifyFamilyAdmins(
  familyId: string | null | undefined,
  notification: {
    type: NotificationType
    title: string
    message: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  const admins = await getFamilyScopedAdmins(familyId, { id: true })
  await Promise.all(
    admins.map(admin =>
      NotificationService.push({
        userId: admin.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata,
      }).catch(() => {})
    )
  )
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
    select: {
      id: true,
      name: true,
      expirationDate: true,
      licenseType: { select: { familyId: true } },
    },
  })

  for (const contract of expiringContracts) {
    await notifyFamilyAdmins(contract.licenseType.familyId, {
      type: 'WARNING',
      title: 'Contrato próximo a vencer',
      message: `El contrato "${contract.name}" vence el ${contract.expirationDate?.toLocaleDateString('es-CL') ?? 'fecha desconocida'}.`,
      metadata: { link: '/inventory/licenses' },
    })

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
  const consumables = await prisma.consumables.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      currentStock: true,
      minStock: true,
      consumableType: { select: { familyId: true } },
    },
  })

  const lowStockItems = consumables.filter(item => item.currentStock <= item.minStock)

  for (const item of lowStockItems) {
    await notifyFamilyAdmins(item.consumableType?.familyId ?? null, {
      type: 'WARNING',
      title: 'Stock bajo de suministro',
      message: `El material "${item.name}" tiene stock bajo: ${item.currentStock} unidades (mínimo: ${item.minStock}).`,
      metadata: { link: '/inventory/consumables' },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'NOTIFICATION_SENT',
        entityType: 'asset',
        entityId: item.id,
        details: {
          type: 'LOW_STOCK_ALERT',
          currentStock: item.currentStock,
          minStock: item.minStock,
        },
      },
    })
  }
}

export async function notifyOrphanContract(
  contractId: string,
  source: 'business' | 'legacy' = 'legacy'
): Promise<void> {
  let contractName = contractId
  let link = '/inventory/contracts'
  let familyId: string | null = null

  if (source === 'business') {
    const contract = await prisma.contracts.findUnique({
      where: { id: contractId },
      select: { id: true, name: true, contractNumber: true, familyId: true },
    })
    contractName = contract?.contractNumber ?? contract?.name ?? contractId
    familyId = contract?.familyId ?? null
    link = `/inventory/contracts`
  } else {
    const contract = await prisma.software_licenses.findUnique({
      where: { id: contractId },
      select: { id: true, name: true, licenseType: { select: { familyId: true } } },
    })
    contractName = contract?.name ?? contractId
    familyId = contract?.licenseType?.familyId ?? null
    link = '/inventory/licenses'
  }

  await notifyFamilyAdmins(familyId, {
    type: 'WARNING',
    title: 'Contrato sin activos vinculados',
    message: `El contrato "${contractName}" ha quedado sin activos vinculados.`,
    metadata: { link },
  })

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'NOTIFICATION_SENT',
      entityType: 'contract',
      entityId: contractId,
      details: { type: 'ORPHAN_CONTRACT_ALERT', source },
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
    select: {
      id: true,
      name: true,
      expirationDate: true,
      expiryAlertSentAt: true,
      currentStock: true,
      consumableType: { select: { familyId: true } },
    },
  })

  for (const item of expiringItems) {
    if (item.expiryAlertSentAt) {
      const sentDate = new Date(item.expiryAlertSentAt)
      sentDate.setHours(0, 0, 0, 0)
      if (sentDate.getTime() === today.getTime()) continue
    }

    const familyId = item.consumableType?.familyId ?? null

    await notifyFamilyAdmins(familyId, {
      type: 'WARNING',
      title: 'Suministro próximo a caducar',
      message: `Material "${item.name}" caduca el ${item.expirationDate?.toLocaleDateString('es-CL') ?? 'fecha desconocida'}. Stock actual: ${item.currentStock}.`,
      metadata: { link: '/inventory/consumables' },
    })

    const urgentDate = new Date(today)
    urgentDate.setDate(urgentDate.getDate() + urgentDays)
    if (item.expirationDate && item.expirationDate <= urgentDate) {
      await notifyFamilyAdmins(familyId, {
        type: 'ERROR',
        title: '¡URGENTE! Suministro caduca pronto',
        message: `Material "${item.name}" caduca en menos de ${urgentDays} días (${item.expirationDate.toLocaleDateString('es-CL')}). Stock: ${item.currentStock}.`,
        metadata: { link: '/inventory/consumables' },
      })
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
    select: {
      id: true,
      code: true,
      brand: true,
      model: true,
      warrantyExpiration: true,
      type: { select: { familyId: true } },
    },
  })

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

    await notifyFamilyAdmins(equip.type.familyId, {
      type: 'WARNING',
      title: 'Garantía de equipo por vencer',
      message: `Garantía por vencer: ${equip.brand} ${equip.model} (${equip.code}) vence el ${equip.warrantyExpiration?.toLocaleDateString('es-CL') ?? 'fecha desconocida'}.`,
      metadata: { link: `/inventory/equipment/${equip.id}` },
    })

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
