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

const EXPIRING_DAYS = 30 // Alertar 30 días antes del vencimiento

export class RentalAlertService {
  /**
   * Verifica arrendamientos próximos a vencer y envía alertas
   * Llamado por cron job diario
   */
  static async checkExpirations() {
    const now = new Date()
    const alertThreshold = new Date(now.getTime() + EXPIRING_DAYS * 24 * 60 * 60 * 1000)

    // Equipos arrendados que vencen en los próximos EXPIRING_DAYS días
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
      const admins = await this.getFamilyAdmins(equipment.type.family?.id ?? null)

      // Información del equipo
      const equipmentInfo = `${equipment.model?.brand || equipment.brand} ${equipment.model?.model || equipment.model_old} (${equipment.code})`
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
      const admins = await this.getFamilyAdmins(contract.familyId)

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
   * Obtiene administradores de una familia
   */
  private static async getFamilyAdmins(familyId: string | null) {
    if (!familyId) {
      // Si no hay familia, notificar a todos los admins
      return prisma.users.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true, name: true, email: true },
      })
    }

    // Administradores asignados a la familia
    const adminAssignments = await prisma.admin_family_assignments.findMany({
      where: { familyId, isActive: true },
      include: { admin: { select: { id: true, name: true, email: true, isActive: true } } },
    })

    const admins = adminAssignments.filter(a => a.admin.isActive).map(a => a.admin)

    // Si no hay admins asignados, usar gestores de inventario de la familia
    if (admins.length === 0) {
      const managers = await prisma.inventory_manager_families.findMany({
        where: { familyId },
        include: {
          manager: { select: { id: true, name: true, email: true, isActive: true } },
        },
      })

      return managers.filter(m => m.manager.isActive).map(m => m.manager)
    }

    return admins
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
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [total, expiringSoon, expired, totalMonthlyCost] = await Promise.all([
      prisma.equipment.count({ where }),
      prisma.equipment.count({
        where: {
          ...where,
          rentalEndDate: { lte: thirtyDaysFromNow, gte: now },
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
