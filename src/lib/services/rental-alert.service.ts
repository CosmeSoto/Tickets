/**
 * RentalAlertService — Gestión de alertas de vencimiento de arrendamientos
 *
 * Responsabilidades:
 *  - Detectar equipos arrendados próximos a vencer
 *  - Enviar notificaciones a administradores
 *  - Integración con contratos de arrendamiento
 *  - Registro de auditoría
 */

import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { createAuditLog } from '@/lib/audit'
import { NotificationService } from '@/lib/services/notification-service'
import { getFamilyScopedAdmins } from '@/lib/notifications/family-recipients'
import { getSetting } from '@/lib/api-cache'

export class RentalAlertService {
  /**
   * Verifica arrendamientos próximos a vencer y envía alertas
   * Llamado por cron job diario
   */
  static async checkExpirations() {
    const now = new Date()
    const daysRaw = await getSetting('inventory.contract_alert_days', 600, '30')
    const expiringDays = Math.max(1, parseInt(daysRaw ?? '30', 10) || 30)
    const alertThreshold = new Date(now.getTime() + expiringDays * 24 * 60 * 60 * 1000)

    // Equipos arrendados que vencen en los próximos días configurados
    const expiringRentals = await prisma.equipment.findMany({
      where: {
        ownershipType: 'RENTAL',
        status: { notIn: ['RETIRED', 'SOLD'] },
        rentalEndDate: { lte: alertThreshold, gte: now },
        rentalAlertSentAt: null, // No se ha enviado alerta aún
      },
      include: {
        model: { select: { brand: true, model: true } },
        type: { include: { family: { select: { id: true, name: true } } } },
        assignments: {
          where: { isActive: true },
          include: { receiver: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    })

    const alertsSent: string[] = []

    for (const equipment of expiringRentals) {
      const daysUntilExpiry = Math.floor(
        (equipment.rentalEndDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Buscar administradores de la familia del equipo
      const admins = await getFamilyScopedAdmins(equipment.type.family?.id ?? null, {
        id: true,
        name: true,
        email: true,
      })

      // Información del equipo
      const equipmentInfo = `${equipment.model?.brand || equipment.brand} ${equipment.model?.model || equipment.modelDeprecated} (${equipment.code})`
      const assignedTo = equipment.assignments[0]?.receiver?.name || 'Sin asignar'

      // Enviar notificación a cada administrador
      for (const admin of admins) {
        await NotificationService.push({
          userId: admin.id,
          type: 'WARNING',
          title: `Arrendamiento por vencer: ${equipmentInfo}`,
          message: `El arrendamiento del equipo ${equipmentInfo} vence en ${daysUntilExpiry} día(s). Proveedor: ${equipment.rentalProvider || 'No especificado'}. Actualmente asignado a: ${assignedTo}.`,
          metadata: {
            equipmentId: equipment.id,
            equipmentCode: equipment.code,
            daysUntilExpiry,
            rentalEndDate: equipment.rentalEndDate?.toISOString(),
            rentalProvider: equipment.rentalProvider,
            rentalContractNumber: equipment.rentalContractNumber,
            monthlyCost: equipment.rentalMonthlyCost,
          },
        })
      }

      // Marcar como alertado
      await prisma.equipment.update({
        where: { id: equipment.id },
        data: { rentalAlertSentAt: now },
      })

      // Auditoría
      await createAuditLog({
        entityType: 'equipment',
        entityId: equipment.id,
        action: 'rental_expiry_alert_sent',
        userId: admins[0]?.id || 'system',
        changes: {
          daysUntilExpiry,
          rentalEndDate: equipment.rentalEndDate?.toISOString(),
          rentalProvider: equipment.rentalProvider,
          alertsSentTo: admins.length,
        },
      })

      alertsSent.push(equipment.code)
    }

    // Buscar contratos de arrendamiento próximos a vencer (integración)
    const expiringContracts = await this.checkContractRentals(now, alertThreshold)

    return {
      alertsSent: alertsSent.length,
      equipmentCodes: alertsSent,
      contractsExpiring: expiringContracts,
    }
  }

  /**
   * Verifica contratos de arrendamiento próximos a vencer
   * Integración con módulo de contratos
   */
  private static async checkContractRentals(now: Date, alertThreshold: Date) {
    const expiringContracts = await prisma.contracts.findMany({
      where: {
        category: 'EQUIPMENT_RENTAL',
        status: { in: ['ACTIVE', 'EXPIRING'] },
        endDate: { lte: alertThreshold, gte: now },
        expiryAlertSentAt: null,
      },
      include: {
        model: { select: { brand: true, model: true } },
        supplier: { select: { name: true } },
        family: { select: { name: true } },
      },
    })

    const contractAlerts: string[] = []

    for (const contract of expiringContracts) {
      const daysUntilExpiry = Math.floor(
        (contract.endDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Buscar administradores de la familia
      const admins = await getFamilyScopedAdmins(contract.familyId, {
        id: true,
        name: true,
        email: true,
      })

      const modelInfo = contract.model
        ? `${contract.model.brand} ${contract.model.model}`
        : 'Modelo no especificado'

      // Enviar notificación
      for (const admin of admins) {
        await NotificationService.push({
          userId: admin.id,
          type: 'WARNING',
          title: `Contrato de arrendamiento por vencer: ${contract.name}`,
          message: `El contrato "${contract.name}" (${modelInfo}) vence en ${daysUntilExpiry} día(s). Proveedor: ${contract.supplier?.name || 'No especificado'}. Costo mensual: $${contract.monthlyCost || 0}.`,
          metadata: {
            contractId: contract.id,
            contractName: contract.name,
            daysUntilExpiry,
            endDate: contract.endDate?.toISOString(),
            monthlyCost: contract.monthlyCost,
            modelId: contract.modelId,
          },
        })
      }

      // Marcar como alertado
      await prisma.contracts.update({
        where: { id: contract.id },
        data: { expiryAlertSentAt: now, status: 'EXPIRING' },
      })

      contractAlerts.push(contract.name)
    }

    return contractAlerts
  }

  /**
   * Obtiene estadísticas de arrendamientos
   */
  static async getStats(familyId?: string) {
    const where: any = {
      ownershipType: 'RENTAL',
      status: { notIn: ['RETIRED', 'SOLD'] },
    }

    if (familyId) where.familyId = familyId

    const now = new Date()
    const daysRaw = await getSetting('inventory.contract_alert_days', 600, '30')
    const alertDays = Math.max(1, parseInt(daysRaw ?? '30', 10) || 30)
    const windowEnd = new Date(now.getTime() + alertDays * 24 * 60 * 60 * 1000)

    const [total, expiringSoon, expired, totalMonthlyCost] = await Promise.all([
      prisma.equipment.count({ where }),
      prisma.equipment.count({
        where: {
          ...where,
          rentalEndDate: { lte: windowEnd, gte: now },
        },
      }),
      prisma.equipment.count({
        where: {
          ...where,
          rentalEndDate: { lt: now },
        },
      }),
      prisma.equipment.aggregate({
        where,
        _sum: { rentalMonthlyCost: true },
      }),
    ])

    return {
      total,
      expiringSoon,
      expired,
      totalMonthlyCost: totalMonthlyCost._sum.rentalMonthlyCost || 0,
    }
  }

  /**
   * Obtiene lista de arrendamientos próximos a vencer
   */
  static async getExpiringRentals(familyId?: string, days: number = 30) {
    const now = new Date()
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const where: any = {
      ownershipType: 'RENTAL',
      status: { notIn: ['RETIRED', 'SOLD'] },
      rentalEndDate: { lte: threshold, gte: now },
    }

    if (familyId) where.type = { familyId }

    const rentals = await prisma.equipment.findMany({
      where,
      include: {
        model: { select: { brand: true, model: true } },
        type: { include: { family: { select: { name: true, color: true } } } },
        assignments: {
          where: { isActive: true },
          include: { receiver: { select: { name: true, email: true } } },
          take: 1,
        },
      },
      orderBy: { rentalEndDate: 'asc' },
    })

    return rentals.map(r => ({
      ...r,
      daysUntilExpiry: Math.floor(
        (r.rentalEndDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
      assignedTo: r.assignments[0]?.receiver?.name || null,
    }))
  }
}
