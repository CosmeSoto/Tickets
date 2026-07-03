import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationService } from './notification-service'
import { getFamilyScopedAdmins } from '@/lib/notifications/family-recipients'
import { getSetting } from '@/lib/api-cache'

type AlertFlag = 'alert60DaysSent' | 'alert30DaysSent' | 'alert15DaysSent'

export class ContractAlertService {
  /**
   * Umbrales de alerta derivados de contract_alert_days (config global).
   * Ej. 30 días → alertas a 60, 30 y 15 días antes del vencimiento.
   */
  private static async getAlertThresholds(): Promise<
    Array<{ days: number; upper: number; flag: AlertFlag }>
  > {
    const raw = await getSetting('contract_alert_days', 600, '30')
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

      for (const threshold of thresholds) {
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

    return alerts
  }

  /**
   * Envía alerta de vencimiento de contrato
   */
  private static async sendExpirationAlert(
    contract: any,
    daysThreshold: number,
    actualDays: number
  ) {
    // Obtener administradores de la familia
    const admins = await getFamilyScopedAdmins(contract.familyId, {
      id: true,
      name: true,
      email: true,
    })

    const message = `
El contrato "${contract.name}" vence en ${actualDays} día(s).

**Detalles del contrato:**
- Proveedor: ${contract.supplier?.name || 'No especificado'}
- Categoría: ${this.getCategoryLabel(contract.category)}
- Fecha de vencimiento: ${contract.endDate.toLocaleDateString('es-MX')}
${contract.model ? `- Modelo: ${contract.model.brand} ${contract.model.model}` : ''}
${contract.batch ? `- Lote: ${contract.batch.batchCode}` : ''}
${contract.monthlyCost ? `- Costo mensual: $${contract.monthlyCost.toLocaleString()}` : ''}
${contract.totalValue ? `- Valor total: $${contract.totalValue.toLocaleString()}` : ''}

**Contacto del proveedor:**
- Email: ${contract.supplier?.email || 'No disponible'}
- Teléfono: ${contract.supplier?.phone || 'No disponible'}

Por favor, revise el contrato y considere su renovación.
    `.trim()

    // Enviar notificaciones
    for (const admin of admins) {
      await NotificationService.createNotification({
        userId: admin.id,
        type: 'INVENTORY',
        title: `Contrato próximo a vencer (${actualDays} días)`,
        message,
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
  }

  /**
   * Obtiene estadísticas de contratos próximos a vencer
   */
  static async getExpiringStats(familyId?: string) {
    const now = new Date()
    const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

    const where: any = {
      status: 'ACTIVE',
      endDate: { not: null },
    }

    if (familyId) {
      where.familyId = familyId
    }

    const [expiring15, expiring30, expiring60, active] = await Promise.all([
      prisma.contracts.count({
        where: {
          ...where,
          endDate: {
            gte: now,
            lte: in15Days,
          },
        },
      }),
      prisma.contracts.count({
        where: {
          ...where,
          endDate: {
            gte: now,
            lte: in30Days,
          },
        },
      }),
      prisma.contracts.count({
        where: {
          ...where,
          endDate: {
            gte: now,
            lte: in60Days,
          },
        },
      }),
      prisma.contracts.count({
        where: familyId ? { status: 'ACTIVE', familyId } : { status: 'ACTIVE' },
      }),
    ])

    return {
      active,
      total: expiring60,
      in15Days: expiring15,
      in30Days: expiring30,
      in60Days: expiring60,
    }
  }

  /**
   * Obtiene lista de contratos próximos a vencer
   */
  static async getExpiringContracts(familyId?: string, days: number = 60) {
    const now = new Date()
    const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

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
}
