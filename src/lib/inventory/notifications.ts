import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

async function getAdminUserId(): Promise<string | null> {
  const admin = await prisma.users.findFirst({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  })
  return admin?.id ?? null
}

/**
 * Verifica contratos próximos a vencer y envía notificaciones in-app.
 * Llamado por cron job diario.
 */
export async function checkContractAlerts(): Promise<void> {
  const alertDaysSetting = await prisma.system_settings.findUnique({
    where: { key: 'inventory_contract_alert_days' },
  })
  const alertDays = alertDaysSetting ? parseInt(alertDaysSetting.value, 10) : 30

  const today = new Date()
  const alertDate = new Date()
  alertDate.setDate(alertDate.getDate() + alertDays)

  const expiringContracts = await prisma.software_licenses.findMany({
    where: {
      expirationDate: { gte: today, lte: alertDate },
    },
    select: { id: true, name: true, expirationDate: true },
  })

  const adminId = await getAdminUserId()

  for (const contract of expiringContracts) {
    if (adminId) {
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          userId: adminId,
          type: 'WARNING',
          title: 'Contrato próximo a vencer',
          message: `El contrato "${contract.name}" vence el ${contract.expirationDate?.toLocaleDateString('es-CL') ?? 'fecha desconocida'}.`,
          isRead: false,
        },
      })
    }

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

/**
 * Verifica materiales MRO con stock bajo y envía notificaciones in-app.
 * Llamado por cron job diario.
 */
export async function checkStockAlerts(): Promise<void> {
  const lowStockItems = await prisma.$queryRaw<
    { id: string; name: string; currentStock: number; minStock: number }[]
  >`SELECT id, name, current_stock AS "currentStock", min_stock AS "minStock" FROM consumables WHERE current_stock <= min_stock`

  const adminId = await getAdminUserId()

  for (const item of lowStockItems) {
    if (adminId) {
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          userId: adminId,
          type: 'WARNING',
          title: 'Stock bajo de material MRO',
          message: `El material "${item.name}" tiene stock bajo: ${item.currentStock} unidades (mínimo: ${item.minStock}).`,
          isRead: false,
        },
      })
    }

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

/**
 * Notifica al ADMIN cuando un contrato queda sin activos vinculados.
 */
export async function notifyOrphanContract(contractId: string): Promise<void> {
  const contract = await prisma.software_licenses.findUnique({
    where: { id: contractId },
    select: { id: true, name: true },
  })

  const adminId = await getAdminUserId()

  if (adminId) {
    await prisma.notifications.create({
      data: {
        id: randomUUID(),
        userId: adminId,
        type: 'WARNING',
        title: 'Contrato sin activos vinculados',
        message: `El contrato "${contract?.name ?? contractId}" ha quedado sin activos vinculados.`,
        isRead: false,
      },
    })
  }

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
