import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationService } from './notification-service'
import { getFamilyScopedAdmins } from '@/lib/notifications/family-recipients'

export class ContractAlertService {
  /**
   * Verifica contratos próximos a vencer y envía alertas
   */
  static async checkExpirations() {
    const now = new Date()
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

      // Alerta 60 días
      if (daysUntilExpiry <= 60 && daysUntilExpiry > 30 && !contract.alert60DaysSent) {
        await this.sendExpirationAlert(contract, 60, daysUntilExpiry)
        await prisma.contracts.update({
          where: { id: contract.id },
          data: {
            alert60DaysSent: true,
            lastAlertSentAt: now,
          },
        })
        alerts.sent60Days++
      }

      // Alerta 30 días
      if (daysUntilExpiry <= 30 && daysUntilExpiry > 15 && !contract.alert30DaysSent) {
        await this.sendExpirationAlert(contract, 30, daysUntilExpiry)
        await prisma.contracts.update({
          where: { id: contract.id },
          data: {
            alert30DaysSent: true,
            lastAlertSentAt: now,
          },
        })
        alerts.sent30Days++
      }

      // Alerta 15 días
      if (daysUntilExpiry <= 15 && daysUntilExpiry > 0 && !contract.alert15DaysSent) {
        await this.sendExpirationAlert(contract, 15, daysUntilExpiry)
        await prisma.contracts.update({
          where: { id: contract.id },
          data: {
            alert15DaysSent: true,
            lastAlertSentAt: now,
          },
        })
        alerts.sent15Days++
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

    const [total, expiring15, expiring30, expiring60] = await Promise.all([
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
    ])

    return {
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
