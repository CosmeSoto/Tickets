import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationService } from '@/lib/services/notification-service'
import { ContractAlertService } from '@/lib/services/contract-alert.service'
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

/**
 * Alertas de contratos comerciales (tabla contracts).
 * Antes consultaba software_licenses y duplicaba el job de licencias.
 */
export async function checkContractAlerts(): Promise<void> {
  await ContractAlertService.checkExpirations()
}

/**
 * Gobernanza de suscripciones (custodio/pago/cliente incompletos) — vivía
 * únicamente en la ruta de cron /api/cron/contracts, que nunca se instaló y
 * se retiró por duplicidad con /api/cron/inventory-alerts (ver auditoría de
 * ciclo de vida de contratos). Se mueve acá para no perder la función.
 */
export async function checkSubscriptionGovernanceAlerts(): Promise<void> {
  await ContractAlertService.checkSubscriptionGovernance()
}

/**
 * Dedup compartido de la alerta de stock bajo — mismo marcador de audit_logs
 * (action=NOTIFICATION_SENT, alertType=LOW_STOCK_ALERT) usado tanto por el
 * cron diario (checkStockAlerts) como por el aviso en tiempo real que dispara
 * cada movimiento de stock (ver POST /api/inventory/consumables/[id]/movements)
 * — antes el aviso en tiempo real no tenía ningún dedup y reenviaba el mismo
 * correo/notificación en cada consumo o reposición del día mientras el
 * material siguiera bajo el mínimo.
 */
export async function hasLowStockAlertBeenSentToday(consumableId: string): Promise<boolean> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const alreadySent = await prisma.audit_logs.findFirst({
    where: {
      action: 'NOTIFICATION_SENT',
      entityType: 'asset',
      entityId: consumableId,
      createdAt: { gte: today },
      details: { path: ['alertType'], equals: 'LOW_STOCK_ALERT' },
    },
  })
  return !!alreadySent
}

export async function markLowStockAlertSent(item: {
  id: string
  currentStock: number
  minStock: number
}): Promise<void> {
  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'NOTIFICATION_SENT',
      entityType: 'asset',
      entityId: item.id,
      details: {
        alertType: 'LOW_STOCK_ALERT',
        currentStock: item.currentStock,
        minStock: item.minStock,
      },
    },
  })
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
    if (await hasLowStockAlertBeenSentToday(item.id)) continue

    await notifyFamilyAdmins(item.consumableType?.familyId ?? null, {
      type: 'WARNING',
      title: 'Stock bajo de suministro',
      message: `El material "${item.name}" tiene stock bajo: ${item.currentStock} unidades (mínimo: ${item.minStock}).`,
      metadata: { link: '/inventory/consumables' },
    })

    await markLowStockAlertSent(item)
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
    link = `/inventory/license/${contractId}`
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
      assignments: {
        where: { isActive: true },
        select: { receiverId: true },
        take: 1,
      },
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

    const message = `Garantía por vencer: ${equip.brand} ${equip.model} (${equip.code}) vence el ${equip.warrantyExpiration?.toLocaleDateString('es-CL') ?? 'fecha desconocida'}.`

    await notifyFamilyAdmins(equip.type.familyId, {
      type: 'WARNING',
      title: 'Garantía de equipo por vencer',
      message,
      metadata: { link: `/inventory/equipment/${equip.id}` },
    })

    // El usuario que tiene el equipo asignado también debe enterarse — antes
    // la alerta solo llegaba a admins y quien lo usa a diario no se enteraba.
    const receiverId = equip.assignments[0]?.receiverId
    if (receiverId) {
      await NotificationService.push({
        userId: receiverId,
        type: 'WARNING',
        title: 'Garantía de tu equipo por vencer',
        message,
        metadata: { link: `/inventory/equipment/${equip.id}` },
      }).catch(() => {})
    }

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

/**
 * Antes la inconsistencia cantidad-registrada vs. equipos-vinculados
 * (ValidationService.validateBatchIntegrity) solo se veía si alguien abría
 * la ficha del lote — nadie se enteraba de un lote roto sin visitarlo. Se
 * corre a diario junto al resto de alertas de inventario, con el mismo
 * dedup por día que las demás (audit_logs, alertType=BATCH_INTEGRITY_ALERT).
 */
export async function checkBatchIntegrityAlerts(): Promise<void> {
  const batches = await prisma.equipment_batches.findMany({
    select: {
      id: true,
      batchCode: true,
      quantity: true,
      model: { select: { type: { select: { familyId: true } } } },
    },
  })
  if (batches.length === 0) return

  const counts = await prisma.equipment.groupBy({
    by: ['batchId'],
    where: { batchId: { in: batches.map(b => b.id) } },
    _count: { _all: true },
  })
  const countByBatch = new Map(counts.map(c => [c.batchId, c._count._all]))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const batch of batches) {
    const actualCount = countByBatch.get(batch.id) ?? 0
    if (actualCount === batch.quantity) continue

    const alreadySent = await prisma.audit_logs.findFirst({
      where: {
        action: 'NOTIFICATION_SENT',
        entityType: 'asset',
        entityId: batch.id,
        createdAt: { gte: today },
        details: { path: ['alertType'], equals: 'BATCH_INTEGRITY_ALERT' },
      },
    })
    if (alreadySent) continue

    await notifyFamilyAdmins(batch.model?.type?.familyId ?? null, {
      type: 'WARNING',
      title: 'Inconsistencia en lote de equipos',
      message: `El lote ${batch.batchCode} registra ${batch.quantity} unidad(es) pero hay ${actualCount} equipo(s) vinculado(s).`,
      metadata: { link: `/inventory/batches/${batch.id}` },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'NOTIFICATION_SENT',
        entityType: 'asset',
        entityId: batch.id,
        details: {
          alertType: 'BATCH_INTEGRITY_ALERT',
          recordedQuantity: batch.quantity,
          actualEquipmentCount: actualCount,
        },
      },
    })
  }
}

type SupplierLifecycleEvent = 'created' | 'deactivated' | 'reactivated' | 'deleted'

/**
 * Notifica a admins del área (o globales) cambios de ciclo de vida del maestro de proveedores.
 * No cubre ediciones rutinarias (ruido); sí create/deactivate/reactivate/delete.
 */
export async function notifySupplierLifecycle(params: {
  familyId: string | null | undefined
  supplierId: string
  supplierName: string
  event: SupplierLifecycleEvent
  actorName?: string | null
  extra?: string
}): Promise<void> {
  const { familyId, supplierId, supplierName, event, actorName, extra } = params
  const by = actorName ? ` por ${actorName}` : ''
  const suffix = extra ? ` ${extra}` : ''

  const config: Record<
    SupplierLifecycleEvent,
    { type: NotificationType; title: string; message: string }
  > = {
    created: {
      type: 'INVENTORY',
      title: 'Nuevo proveedor',
      message: `Se registró el proveedor "${supplierName}"${by}.${suffix}`,
    },
    deactivated: {
      type: 'WARNING',
      title: 'Proveedor desactivado',
      message: `El proveedor "${supplierName}" fue desactivado${by}.${suffix}`,
    },
    reactivated: {
      type: 'SUCCESS',
      title: 'Proveedor reactivado',
      message: `El proveedor "${supplierName}" volvió a estar activo${by}.${suffix}`,
    },
    deleted: {
      type: 'WARNING',
      title: 'Proveedor eliminado',
      message: `El proveedor "${supplierName}" fue eliminado permanentemente${by}.${suffix}`,
    },
  }

  const n = config[event]
  await notifyFamilyAdmins(familyId, {
    type: n.type,
    title: n.title,
    message: n.message,
    metadata: {
      link: event === 'deleted' ? '/inventory/suppliers' : `/inventory/suppliers/${supplierId}`,
      supplierId,
      event: `SUPPLIER_${event.toUpperCase()}`,
    },
  })
}
