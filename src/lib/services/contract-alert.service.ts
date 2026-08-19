import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationService } from './notification-service'
import { getFamilyScopedAdmins } from '@/lib/notifications/family-recipients'
import { getSetting } from '@/lib/api-cache'
import { notifyContractOps } from '@/lib/contracts/notify-contract-ops'

type AlertFlag = 'alert60DaysSent' | 'alert30DaysSent' | 'alert15DaysSent'

export class ContractAlertService {
  /**
   * Umbrales de alerta derivados de contract_alert_days (config global).
   * Ej. 30 días → alertas a 60, 30 y 15 días antes del vencimiento.
   */
  private static async getAlertThresholds(): Promise<
    Array<{ days: number; upper: number; flag: AlertFlag }>
  > {
    // UI /api/settings/inventory guarda con prefijo inventory.*
    const raw = await getSetting('inventory.contract_alert_days', 600, '30')
    const base = Math.max(7, parseInt(raw ?? '30', 10) || 30)
    const urgent = Math.max(7, Math.round(base / 2))
    const early = Math.min(365, base * 2)

    return [
      { days: early, upper: base + 1, flag: 'alert60DaysSent' },
      { days: base, upper: urgent + 1, flag: 'alert30DaysSent' },
      { days: urgent, upper: 1, flag: 'alert15DaysSent' },
    ]
  }

  /**
   * Verifica contratos próximos a vencer y envía alertas
   */
  static async checkExpirations() {
    const now = new Date()
    const thresholds = await this.getAlertThresholds()
    const alerts = {
      sent60Days: 0,
      sent30Days: 0,
      sent15Days: 0,
      contractsChecked: 0,
      contractsExpired: 0,
    }

    // Obtener contratos activos con fecha de fin
    const contracts = await prisma.contracts.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { not: null },
      },
      include: {
        supplier: { select: { name: true, email: true, phone: true } },
        family: { select: { id: true, name: true } },
        model: { select: { brand: true, model: true } },
        batch: { select: { batchCode: true } },
      },
    })

    alerts.contractsChecked = contracts.length

    for (const contract of contracts) {
      if (!contract.endDate) continue

      const daysUntilExpiry = Math.ceil(
        (contract.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Si el contrato define un aviso mayor (ej. 120 días en renta), usarlo como umbral temprano
      const contractThresholds = [...thresholds]
      const noticeDays = contract.renewalNoticeDays ?? 0
      if (noticeDays > contractThresholds[0].days) {
        contractThresholds[0] = {
          days: Math.min(365, noticeDays),
          upper: contractThresholds[0].upper,
          flag: 'alert60DaysSent',
        }
      }

      for (const threshold of contractThresholds) {
        const alreadySent = contract[threshold.flag] as boolean
        if (
          daysUntilExpiry <= threshold.days &&
          daysUntilExpiry >= threshold.upper &&
          !alreadySent
        ) {
          await this.sendExpirationAlert(contract, threshold.days, daysUntilExpiry)
          await prisma.contracts.update({
            where: { id: contract.id },
            data: {
              [threshold.flag]: true,
              lastAlertSentAt: now,
            },
          })
          if (threshold.flag === 'alert60DaysSent') alerts.sent60Days++
          else if (threshold.flag === 'alert30DaysSent') alerts.sent30Days++
          else alerts.sent15Days++
        }
      }

      // Marcar como expirado si ya venció
      if (daysUntilExpiry <= 0 && contract.status === 'ACTIVE') {
        await prisma.contracts.update({
          where: { id: contract.id },
          data: { status: 'EXPIRED' },
        })
        alerts.contractsExpired++
      }
    }

    // Auditoría
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'CONTRACT_ALERTS_CHECKED',
        entityType: 'contract',
        entityId: 'system',
        userId: 'system',
        details: alerts,
        createdAt: now,
      },
    })

    const lineAlerts = await this.checkLineExpirations(now, thresholds)

    return { ...alerts, lineAlerts }
  }

  /**
   * Equipos/líneas con fin de renta propio (distinto al encabezado).
   */
  private static async checkLineExpirations(
    now: Date,
    thresholds: Array<{ days: number; upper: number; flag: AlertFlag }>
  ) {
    const maxDays = Math.max(...thresholds.map(t => t.days))
    const until = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000)
    const lines = await prisma.contract_lines.findMany({
      where: {
        serviceEndDate: { gte: now, lte: until },
        contract: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        description: true,
        serviceEndDate: true,
        equipmentId: true,
        contract: {
          select: {
            id: true,
            name: true,
            familyId: true,
            custodianUserId: true,
            backupCustodianUserId: true,
            createdBy: true,
          },
        },
      },
    })

    let sent = 0
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)

    for (const line of lines) {
      if (!line.serviceEndDate) continue
      const daysUntil = Math.ceil(
        (line.serviceEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      const already = await prisma.audit_logs.findFirst({
        where: {
          action: 'NOTIFICATION_SENT',
          entityType: 'contract_line',
          entityId: line.id,
          createdAt: { gte: today },
          details: { path: ['alertType'], equals: 'LINE_RENTAL_END' },
        },
      })
      if (already) continue

      const hits = thresholds.some(t => daysUntil <= t.days && daysUntil >= t.upper)
      if (!hits && daysUntil !== 1) continue

      await notifyContractOps({
        familyId: line.contract.familyId,
        extraUserIds: [
          line.contract.custodianUserId,
          line.contract.backupCustodianUserId,
          line.contract.createdBy,
        ],
        title: `Fin de renta de activo (${daysUntil} día${daysUntil === 1 ? '' : 's'})`,
        message: `La línea "${line.description}" del contrato "${line.contract.name}" deja de estar en renta el ${line.serviceEndDate.toLocaleDateString('es-MX')}. El próximo mes no debe cobrarse ese activo.`,
        link: '/inventory/payments',
        metadata: {
          kind: 'CONTRACT_LINE_RENTAL_END',
          contractId: line.contract.id,
          lineId: line.id,
          equipmentId: line.equipmentId,
          daysUntil,
        },
      })

      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'NOTIFICATION_SENT',
          entityType: 'contract_line',
          entityId: line.id,
          userId: 'system',
          details: { alertType: 'LINE_RENTAL_END', daysUntil, contractId: line.contract.id },
        },
      })
      sent++
    }

    return sent
  }

  /**
   * Envía alerta de vencimiento de contrato
   */
  private static async sendExpirationAlert(
    contract: any,
    _daysThreshold: number,
    actualDays: number
  ) {
    const message = `
El contrato "${contract.name}" vence en ${actualDays} día(s).

Detalles:
- Proveedor: ${contract.supplier?.name || 'No especificado'}
- Categoría: ${this.getCategoryLabel(contract.category)}
- Fecha de vencimiento: ${contract.endDate.toLocaleDateString('es-MX')}
${contract.monthlyCost ? `- Costo de referencia: $${contract.monthlyCost.toLocaleString()}` : ''}

Revise renovación, devolución de equipos o ajuste de líneas aún en renta.
    `.trim()

    await notifyContractOps({
      familyId: contract.familyId,
      extraUserIds: [contract.custodianUserId, contract.backupCustodianUserId, contract.createdBy],
      title: `Contrato próximo a vencer (${actualDays} días)`,
      message,
      link: '/inventory/contracts',
      metadata: {
        kind: 'CONTRACT_EXPIRING',
        contractId: contract.id,
        contractName: contract.name,
        daysUntilExpiry: actualDays,
        supplierId: contract.supplierId,
        priority: actualDays <= 15 ? 'HIGH' : 'MEDIUM',
      },
    })
  }

  /**
   * Obtiene estadísticas de contratos próximos a vencer.
   * Buckets derivados de inventory.contract_alert_days (urgente / base / temprano).
   * Las claves in15Days/in30Days/in60Days se conservan por compatibilidad de API.
   */
  static async getExpiringStats(familyId?: string) {
    const now = new Date()
    const thresholds = await this.getAlertThresholds()
    const urgentDays = thresholds[2].days
    const baseDays = thresholds[1].days
    const earlyDays = thresholds[0].days

    const inUrgent = new Date(now.getTime() + urgentDays * 24 * 60 * 60 * 1000)
    const inBase = new Date(now.getTime() + baseDays * 24 * 60 * 60 * 1000)
    const inEarly = new Date(now.getTime() + earlyDays * 24 * 60 * 60 * 1000)

    const where: any = {
      status: 'ACTIVE',
      endDate: { not: null },
    }

    if (familyId) {
      where.familyId = familyId
    }

    const [expiringUrgent, expiringBase, expiringEarly, active] = await Promise.all([
      prisma.contracts.count({
        where: {
          ...where,
          endDate: {
            gte: now,
            lte: inUrgent,
          },
        },
      }),
      prisma.contracts.count({
        where: {
          ...where,
          endDate: {
            gte: now,
            lte: inBase,
          },
        },
      }),
      prisma.contracts.count({
        where: {
          ...where,
          endDate: {
            gte: now,
            lte: inEarly,
          },
        },
      }),
      prisma.contracts.count({
        where: familyId ? { status: 'ACTIVE', familyId } : { status: 'ACTIVE' },
      }),
    ])

    return {
      active,
      total: expiringEarly,
      in15Days: expiringUrgent,
      in30Days: expiringBase,
      in60Days: expiringEarly,
      thresholds: { urgentDays, baseDays, earlyDays },
    }
  }

  /**
   * Obtiene lista de contratos próximos a vencer
   */
  static async getExpiringContracts(familyId?: string, days?: number) {
    const now = new Date()
    let windowDays = days
    if (windowDays == null || Number.isNaN(windowDays)) {
      const raw = await getSetting('inventory.contract_alert_days', 600, '30')
      windowDays = Math.max(1, parseInt(raw ?? '30', 10) || 30)
    }
    const targetDate = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000)

    const where: any = {
      status: 'ACTIVE',
      endDate: {
        gte: now,
        lte: targetDate,
      },
    }

    if (familyId) {
      where.familyId = familyId
    }

    const contracts = await prisma.contracts.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        family: { select: { name: true, color: true } },
        model: { select: { brand: true, model: true } },
      },
      orderBy: { endDate: 'asc' },
    })

    return contracts.map(contract => ({
      ...contract,
      daysUntilExpiry: Math.ceil(
        (contract.endDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))
  }

  private static getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      PURCHASE: 'Compra',
      RENTAL: 'Arrendamiento',
      MAINTENANCE: 'Mantenimiento',
      SERVICE: 'Servicio',
      LICENSE: 'Licencia',
      OTHER: 'Otro',
    }
    return labels[category] || category
  }

  /**
   * Alerta administradores sobre suscripciones con custodio, pago o cliente incompletos.
   */
  static async checkSubscriptionGovernance() {
    const { ContractService } = await import('./contract-service')
    const atRisk = await ContractService.listAtRisk({})
    let alertsSent = 0

    for (const contract of atRisk) {
      if (!contract.familyId || contract.risks.length === 0) continue

      const admins = await getFamilyScopedAdmins(contract.familyId, {
        id: true,
        name: true,
        email: true,
      })

      const riskList = contract.risks.join(' · ')
      for (const admin of admins) {
        await NotificationService.createNotification({
          userId: admin.id,
          type: 'INVENTORY',
          title: `Suscripción en riesgo: ${contract.name}`,
          message: `${riskList}. Revise facturación, custodio y asignación al cliente.`,
          metadata: {
            kind: 'CONTRACT_SUBSCRIPTION_RISK',
            contractId: contract.id,
            risks: contract.risks,
            riskLevel: contract.riskLevel,
          },
        })
        alertsSent++
      }
    }

    return { contractsAtRisk: atRisk.length, alertsSent }
  }
}
