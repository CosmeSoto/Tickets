/**
 * RentalAlertService — Lectura de arrendamientos de equipos para la UI
 * (estadísticas y listado de próximos a vencer). El envío de alertas de
 * vencimiento vive en CheckRentalExpirationJob (equipos) y
 * ContractAlertService (contratos), vía el cron maestro
 * /api/cron/inventory-alerts.
 */

import { prisma } from '@/lib/prisma'
import { getSetting } from '@/lib/api-cache'

export class RentalAlertService {
  // Nota: el envío de alertas de vencimiento (equipos RENTAL y contratos
  // EQUIPMENT_RENTAL) vivía acá en checkExpirations()/checkContractRentals(),
  // duplicando lo que ya hace el cron maestro /api/cron/inventory-alerts vía
  // CheckRentalExpirationJob (equipos) y ContractAlertService (contratos, de
  // cualquier categoría). Se retiró por auditoría de duplicidades — esta
  // clase ahora solo expone lectura (getStats/getExpiringRentals) para la UI.

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
