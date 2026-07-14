import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  buildConsumableFamilyWhere,
  buildEquipmentFamilyWhere,
  buildLicenseFamilyWhere,
} from '@/lib/inventory/scope-filter'

/**
 * Servicio para generación de reportes de inventario
 */
export class InventoryReportService {
  /**
   * Reporte de inventario por modelo
   */
  static async getEquipmentByModel(params: {
    familyId?: string
    familyIds?: string[]
    modelId?: string
    userId?: string
    userRole?: string
  }) {
    try {
      const familyIds =
        params.familyIds ?? (params.familyId ? [params.familyId] : undefined)
      const familyWhere = buildEquipmentFamilyWhere(familyIds)
      const instancesWhere: Prisma.equipmentWhereInput = {
        ...(Object.keys(familyWhere).length > 0 ? familyWhere : {}),
      }

      const models = await prisma.equipment_models.findMany({
        where: params.modelId ? { id: params.modelId } : {},
        include: {
          brand: true,
          instances: {
            where: instancesWhere,
            select: {
              id: true,
              code: true,
              status: true,
              purchasePrice: true,
              rentalMonthlyCost: true,
              ownershipType: true,
            },
          },
          type: { select: { name: true } },
        },
      })

      return models.map(model => ({
        modelId: model.id,
        brand: model.brand?.name ?? '',
        model: model.model,
        sku: model.sku,
        type: model.type.name,
        total: model.instances.length,
        available: model.instances.filter(e => e.status === 'AVAILABLE').length,
        assigned: model.instances.filter(e => e.status === 'ASSIGNED').length,
        maintenance: model.instances.filter(e => e.status === 'MAINTENANCE').length,
        retired: model.instances.filter(e => e.status === 'RETIRED').length,
        totalValue: model.instances.reduce((sum, e) => sum + (e.purchasePrice || 0), 0),
        rentalCount: model.instances.filter(e => e.ownershipType === 'RENTAL').length,
        rentalMonthlyCost: model.instances
          .filter(e => e.ownershipType === 'RENTAL')
          .reduce((sum, e) => sum + (e.rentalMonthlyCost || 0), 0),
      }))
    } catch (error) {
      console.error('Error generando reporte de equipos por modelo:', error)
      throw error
    }
  }

  /**
   * Reporte de mantenimientos por modelo
   */
  static async getMaintenanceByModel(params: {
    familyId?: string
    familyIds?: string[]
    modelId?: string
    startDate?: Date
    endDate?: Date
  }) {
    try {
      const familyIds =
        params.familyIds ?? (params.familyId ? [params.familyId] : undefined)
      const familyWhere = buildEquipmentFamilyWhere(familyIds)

      const where: Prisma.maintenance_recordsWhereInput = {
        equipment: {
          ...(params.modelId ? { modelId: params.modelId } : {}),
          ...(Object.keys(familyWhere).length > 0 ? familyWhere : {}),
        },
      }

      if (params.startDate || params.endDate) {
        where.date = {}
        if (params.startDate) where.date.gte = params.startDate
        if (params.endDate) where.date.lte = params.endDate
      }

      const maintenances = await prisma.maintenance_records.groupBy({
        by: ['equipmentId'],
        where,
        _count: true,
        _avg: { cost: true },
        _sum: { cost: true },
      })

      // Obtener información de equipos y modelos
      const equipmentIds = maintenances.map(m => m.equipmentId)
      const equipment = await prisma.equipment.findMany({
        where: { id: { in: equipmentIds } },
        select: {
          id: true,
          modelId: true,
          model: {
            select: { id: true, brand: true, model: true },
          },
        },
      })

      // Agrupar por modelo
      const byModel = new Map<
        string,
        {
          modelId: string
          brand: string
          model: string
          totalMaintenances: number
          totalCost: number
          avgCost: number
        }
      >()

      maintenances.forEach(m => {
        const eq = equipment.find(e => e.id === m.equipmentId)
        if (!eq?.model) return

        const key = eq.model.id
        const existing = byModel.get(key)

        if (existing) {
          existing.totalMaintenances += m._count
          existing.totalCost += m._sum.cost || 0
          existing.avgCost = existing.totalCost / existing.totalMaintenances
        } else {
          byModel.set(key, {
            modelId: eq.model.id,
            brand:
              typeof eq.model.brand === 'object'
                ? ((eq.model.brand as any)?.name ?? '')
                : (eq.model.brand ?? ''),
            model: eq.model.model,
            totalMaintenances: m._count,
            totalCost: m._sum.cost || 0,
            avgCost: m._avg.cost || 0,
          })
        }
      })

      return Array.from(byModel.values())
    } catch (error) {
      console.error('Error generando reporte de mantenimientos por modelo:', error)
      throw error
    }
  }

  /**
   * Reporte de equipos por lote
   */
  static async getEquipmentByBatch(params: {
    familyId?: string
    familyIds?: string[]
    batchId?: string
    supplierId?: string
  }) {
    try {
      const familyIds =
        params.familyIds ?? (params.familyId ? [params.familyId] : undefined)
      const familyWhere = buildEquipmentFamilyWhere(familyIds)

      const where: any = {}

      if (params.batchId) where.id = params.batchId
      if (params.supplierId) where.supplierId = params.supplierId

      const batches = await prisma.equipment_batches.findMany({
        where,
        include: {
          model: { include: { brand: true } },
          supplier: { select: { name: true } },
          equipment: {
            where: Object.keys(familyWhere).length > 0 ? familyWhere : {},
            select: {
              id: true,
              code: true,
              status: true,
            },
          },
        },
      })

      return batches.map(batch => ({
        batchId: batch.id,
        batchCode: batch.batchCode,
        model: `${batch.model.brand?.name ?? ''} ${batch.model.model}`.trim(),
        supplier: batch.supplier?.name ?? '—',
        quantity: batch.quantity,
        unitPrice: batch.unitPrice,
        totalPrice: batch.totalPrice,
        purchaseDate: batch.purchaseDate,
        equipmentCount: batch.equipment.length,
        available: batch.equipment.filter(e => e.status === 'AVAILABLE').length,
        assigned: batch.equipment.filter(e => e.status === 'ASSIGNED').length,
        maintenance: batch.equipment.filter(e => e.status === 'MAINTENANCE').length,
        retired: batch.equipment.filter(e => e.status === 'RETIRED').length,
      }))
    } catch (error) {
      console.error('Error generando reporte de equipos por lote:', error)
      throw error
    }
  }

  /**
   * Reporte de resumen de equipos por estado, tipo y condición
   */
  static async getEquipmentSummaryReport(filters?: {
    startDate?: Date
    endDate?: Date
    departmentId?: string
    familyIds?: string[]
  }) {
    try {
      const where: Prisma.equipmentWhereInput = {
        ...buildEquipmentFamilyWhere(filters?.familyIds),
      }

      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {}
        if (filters.startDate) where.createdAt.gte = filters.startDate
        if (filters.endDate) where.createdAt.lte = filters.endDate
      }

      const [total, byStatus, byType, byCondition, byOwnership, totalValue, rentedEquipment] =
        await Promise.all([
          prisma.equipment.count({ where }),
          prisma.equipment.groupBy({
            by: ['status'],
            where,
            _count: true,
          }),
          prisma.equipment.groupBy({
            by: ['typeId'],
            where,
            _count: true,
          }),
          prisma.equipment.groupBy({
            by: ['condition'],
            where,
            _count: true,
          }),
          prisma.equipment.groupBy({
            by: ['ownershipType'],
            where,
            _count: true,
          }),
          prisma.equipment.aggregate({
            where,
            _sum: { purchasePrice: true },
          }),
          prisma.equipment.findMany({
            where: {
              ...where,
              ownershipType: 'RENTAL',
              status: { not: 'RETIRED' },
            },
            select: {
              id: true,
              code: true,
              brand: true,
              model: true,
              rentalProvider: true,
              rentalMonthlyCost: true,
              rentalEndDate: true,
            },
          }),
        ])

      return {
        total,
        byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
        byType: Object.fromEntries(byType.map(t => [t.typeId, t._count])),
        byCondition: Object.fromEntries(byCondition.map(c => [c.condition, c._count])),
        byOwnership: Object.fromEntries(byOwnership.map(o => [o.ownershipType, o._count])),
        totalValue: totalValue._sum.purchasePrice || 0,
        rentedEquipment: {
          count: rentedEquipment.length,
          totalMonthlyCost: rentedEquipment.reduce((sum, e) => sum + (e.rentalMonthlyCost || 0), 0),
          items: rentedEquipment,
        },
      }
    } catch (error) {
      console.error('Error generando reporte de equipos:', error)
      throw error
    }
  }

  /**
   * Reporte de asignaciones con historial
   */
  static async getAssignmentsReport(filters?: {
    startDate?: Date
    endDate?: Date
    userId?: string
    equipmentId?: string
    isActive?: boolean
    familyIds?: string[]
  }) {
    try {
      const where: Prisma.equipment_assignmentsWhereInput = {}

      if (filters?.familyIds) {
        where.equipment = buildEquipmentFamilyWhere(filters.familyIds)
      }

      if (filters?.startDate || filters?.endDate) {
        where.startDate = {}
        if (filters.startDate) where.startDate.gte = filters.startDate
        if (filters.endDate) where.startDate.lte = filters.endDate
      }

      if (filters?.userId) {
        where.receiverId = filters.userId
      }

      if (filters?.equipmentId) {
        where.equipmentId = filters.equipmentId
      }

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive
      }

      const [assignments, total, avgDuration] = await Promise.all([
        prisma.equipment_assignments.findMany({
          where,
          include: {
            equipment: true,
            receiver: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
            deliverer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            deliveryAct: {
              select: {
                folio: true,
                status: true,
                acceptedAt: true,
              },
            },
          },
          orderBy: { startDate: 'desc' },
          take: 1000, // cap de seguridad
        }),
        prisma.equipment_assignments.count({ where }),
        prisma.$queryRaw<Array<{ avg: number }>>`
          SELECT AVG(EXTRACT(EPOCH FROM (actual_end_date - start_date)) / 86400) as avg
          FROM equipment_assignments
          WHERE actual_end_date IS NOT NULL
        `,
      ])

      return {
        assignments,
        total,
        avgDurationDays: avgDuration[0]?.avg || 0,
      }
    } catch (error) {
      console.error('Error generando reporte de asignaciones:', error)
      throw error
    }
  }

  /**
   * Reporte de actas pendientes y expiradas
   */
  static async getPendingActsReport(familyIds?: string[]) {
    try {
      const now = new Date()
      const equipmentScope = familyIds ? buildEquipmentFamilyWhere(familyIds) : {}

      const [deliveryActs, returnActs] = await Promise.all([
        prisma.delivery_acts.findMany({
          where: {
            status: { in: ['PENDING', 'EXPIRED'] },
            ...(familyIds ? { assignment: { equipment: equipmentScope } } : {}),
          },
          include: {
            assignment: {
              include: {
                equipment: true,
                receiver: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
          orderBy: { expirationDate: 'asc' },
        }),
        prisma.return_acts.findMany({
          where: {
            status: { in: ['PENDING', 'EXPIRED'] },
            ...(familyIds ? { assignment: { equipment: equipmentScope } } : {}),
          },
          include: {
            assignment: {
              include: {
                equipment: true,
              },
            },
          },
          orderBy: { expirationDate: 'asc' },
        }),
      ])

      const deliveryPending = deliveryActs.filter(
        a => a.status === 'PENDING' && new Date(a.expirationDate) > now
      )
      const deliveryExpired = deliveryActs.filter(
        a => a.status === 'EXPIRED' || new Date(a.expirationDate) <= now
      )
      const returnPending = returnActs.filter(
        a => a.status === 'PENDING' && new Date(a.expirationDate) > now
      )
      const returnExpired = returnActs.filter(
        a => a.status === 'EXPIRED' || new Date(a.expirationDate) <= now
      )

      return {
        delivery: {
          pending: deliveryPending,
          expired: deliveryExpired,
          total: deliveryActs.length,
        },
        return: {
          pending: returnPending,
          expired: returnExpired,
          total: returnActs.length,
        },
      }
    } catch (error) {
      console.error('Error generando reporte de actas pendientes:', error)
      throw error
    }
  }

  /**
   * Reporte de costos de mantenimiento por período
   */
  static async getMaintenanceCostsReport(filters?: {
    startDate?: Date
    endDate?: Date
    equipmentId?: string
    type?: 'PREVENTIVE' | 'CORRECTIVE'
    familyIds?: string[]
  }) {
    try {
      const where: Prisma.maintenance_recordsWhereInput = {}

      if (filters?.familyIds) {
        where.equipment = buildEquipmentFamilyWhere(filters.familyIds)
      }

      if (filters?.startDate || filters?.endDate) {
        where.date = {}
        if (filters.startDate) where.date.gte = filters.startDate
        if (filters.endDate) where.date.lte = filters.endDate
      }

      if (filters?.equipmentId) {
        where.equipmentId = filters.equipmentId
      }

      if (filters?.type) {
        where.type = filters.type
      }

      const [records, totalCost, byType, byEquipment] = await Promise.all([
        prisma.maintenance_records.findMany({
          where,
          include: {
            equipment: {
              select: {
                id: true,
                code: true,
                brand: true,
                model: true,
              },
            },
            technician: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 500,
        }),
        prisma.maintenance_records.aggregate({
          where,
          _sum: { cost: true },
        }),
        prisma.maintenance_records.groupBy({
          by: ['type'],
          where,
          _sum: { cost: true },
          _count: true,
        }),
        prisma.maintenance_records.groupBy({
          by: ['equipmentId'],
          where,
          _sum: { cost: true },
          _count: true,
          orderBy: { _sum: { cost: 'desc' } },
          take: 10,
        }),
      ])

      return {
        records,
        totalCost: totalCost._sum.cost || 0,
        byType: Object.fromEntries(
          byType.map(t => [t.type, { count: t._count, cost: t._sum.cost || 0 }])
        ),
        topEquipmentByCost: byEquipment,
      }
    } catch (error) {
      console.error('Error generando reporte de costos de mantenimiento:', error)
      throw error
    }
  }

  /**
   * Reporte de uso de consumibles por período
   */
  static async getConsumableUsageReport(filters?: {
    startDate?: Date
    endDate?: Date
    consumableId?: string
    familyIds?: string[]
  }) {
    try {
      const where: Prisma.stock_movementsWhereInput = {}

      if (filters?.familyIds) {
        where.consumable = buildConsumableFamilyWhere(filters.familyIds)
      }

      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {}
        if (filters.startDate) where.createdAt.gte = filters.startDate
        if (filters.endDate) where.createdAt.lte = filters.endDate
      }

      if (filters?.consumableId) {
        where.consumableId = filters.consumableId
      }

      const [movements, byType, byConsumable] = await Promise.all([
        prisma.stock_movements.findMany({
          where,
          include: {
            consumable: {
              select: {
                id: true,
                name: true,
                consumableType: { select: { name: true } },
                unitOfMeasure: { select: { name: true, symbol: true } },
              },
            },
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        }),
        prisma.stock_movements.groupBy({
          by: ['type'],
          where,
          _sum: { quantity: true },
          _count: true,
        }),
        prisma.stock_movements.groupBy({
          by: ['consumableId'],
          where: { ...where, type: 'EXIT' },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 10,
        }),
      ])

      return {
        movements,
        byType: Object.fromEntries(
          byType.map(t => [t.type, { count: t._count, quantity: t._sum.quantity || 0 }])
        ),
        topConsumablesByUsage: byConsumable,
      }
    } catch (error) {
      console.error('Error generando reporte de uso de consumibles:', error)
      throw error
    }
  }

  /**
   * Reporte de licencias próximas a expirar
   */
  static async getLicenseExpirationReport(days: number = 30, familyIds?: string[]) {
    try {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + days)
      const licenseScope = buildLicenseFamilyWhere(familyIds)

      const [expiring, expired, byType] = await Promise.all([
        prisma.software_licenses.findMany({
          where: {
            ...licenseScope,
            expirationDate: {
              gte: new Date(),
              lte: targetDate,
            },
          },
          include: {
            licenseType: true,
            equipment: {
              select: {
                id: true,
                code: true,
                brand: true,
                model: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { expirationDate: 'asc' },
        }),
        prisma.software_licenses.findMany({
          where: {
            ...licenseScope,
            expirationDate: {
              lt: new Date(),
            },
          },
          include: {
            licenseType: true,
            equipment: {
              select: {
                id: true,
                code: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        prisma.software_licenses.groupBy({
          by: ['typeId'],
          where: {
            ...licenseScope,
            expirationDate: {
              gte: new Date(),
              lte: targetDate,
            },
          },
          _count: true,
        }),
      ])

      // Resolver nombres de tipos
      const typeIds = byType.map(t => t.typeId)
      const types =
        typeIds.length > 0
          ? await prisma.license_types.findMany({
              where: { id: { in: typeIds } },
              select: { id: true, name: true },
            })
          : []
      const typeMap = Object.fromEntries(types.map(t => [t.id, t.name]))

      return {
        expiring,
        expired,
        byType: Object.fromEntries(byType.map(t => [typeMap[t.typeId] || t.typeId, t._count])),
      }
    } catch (error) {
      console.error('Error generando reporte de expiración de licencias:', error)
      throw error
    }
  }

  /**
   * Reporte de valor de inventario y depreciación
   */
  static async getInventoryValueReport(familyIds?: string[]) {
    try {
      const equipmentScope = buildEquipmentFamilyWhere(familyIds)
      const consumableScope = buildConsumableFamilyWhere(familyIds)
      const licenseScope = buildLicenseFamilyWhere(familyIds)

      const [
        totalPurchaseValue,
        rentalMonthlyCost,
        licenseCost,
        consumableValue,
        equipmentByOwnership,
      ] = await Promise.all([
        prisma.equipment.aggregate({
          where: { ...equipmentScope, ownershipType: 'FIXED_ASSET' },
          _sum: { purchasePrice: true },
        }),
        prisma.equipment.aggregate({
          where: {
            ...equipmentScope,
            ownershipType: 'RENTAL',
            status: { not: 'RETIRED' },
          },
          _sum: { rentalMonthlyCost: true },
        }),
        prisma.software_licenses.aggregate({
          where: licenseScope,
          _sum: { cost: true },
        }),
        familyIds === undefined
          ? prisma.$queryRaw<Array<{ total: number }>>`
              SELECT SUM(current_stock * COALESCE(cost_per_unit, 0)) as total FROM consumables
            `
          : prisma.consumables
              .findMany({
                where: consumableScope,
                select: { currentStock: true, costPerUnit: true },
              })
              .then(rows => [
                { total: rows.reduce((s, r) => s + r.currentStock * (r.costPerUnit ?? 0), 0) },
              ]),
        prisma.equipment.groupBy({
          by: ['ownershipType'],
          where: equipmentScope,
          _count: true,
          _sum: { purchasePrice: true },
        }),
      ])

      const totalAssetValue =
        (totalPurchaseValue._sum.purchasePrice || 0) +
        (licenseCost._sum.cost || 0) +
        (consumableValue[0]?.total || 0)

      return {
        fixedAssets: {
          value: totalPurchaseValue._sum.purchasePrice || 0,
          count: equipmentByOwnership.find(e => e.ownershipType === 'FIXED_ASSET')?._count || 0,
        },
        rentals: {
          monthlyCost: rentalMonthlyCost._sum.rentalMonthlyCost || 0,
          annualCost: (rentalMonthlyCost._sum.rentalMonthlyCost || 0) * 12,
          count: equipmentByOwnership.find(e => e.ownershipType === 'RENTAL')?._count || 0,
        },
        licenses: {
          value: licenseCost._sum.cost || 0,
        },
        consumables: {
          value: consumableValue[0]?.total || 0,
        },
        total: {
          assetValue: totalAssetValue,
          annualRentalCost: (rentalMonthlyCost._sum.rentalMonthlyCost || 0) * 12,
        },
      }
    } catch (error) {
      console.error('Error generando reporte de valor de inventario:', error)
      throw error
    }
  }

  /**
   * Reporte consolidado de equipos rentados
   */
  static async getRentalEquipmentReport(familyIds?: string[]) {
    try {
      const rentals = await prisma.equipment.findMany({
        where: {
          ...buildEquipmentFamilyWhere(familyIds),
          ownershipType: 'RENTAL',
          status: { not: 'RETIRED' },
        },
        select: {
          id: true,
          code: true,
          brand: true,
          model: true,
          typeId: true,
          status: true,
          rentalProvider: true,
          rentalContractNumber: true,
          rentalStartDate: true,
          rentalEndDate: true,
          rentalMonthlyCost: true,
          rentalContactName: true,
          rentalContactEmail: true,
          rentalContactPhone: true,
        },
        orderBy: { rentalEndDate: 'asc' },
      })

      const now = new Date()
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

      const expiringContracts = rentals.filter(
        r =>
          r.rentalEndDate &&
          new Date(r.rentalEndDate) <= thirtyDaysFromNow &&
          new Date(r.rentalEndDate) >= now
      )

      const byProvider = rentals.reduce(
        (acc, r) => {
          const provider = r.rentalProvider || 'Sin proveedor'
          if (!acc[provider]) {
            acc[provider] = { count: 0, monthlyCost: 0, items: [] }
          }
          acc[provider].count++
          acc[provider].monthlyCost += r.rentalMonthlyCost || 0
          acc[provider].items.push(r)
          return acc
        },
        {} as Record<string, any>
      )

      return {
        rentals,
        total: rentals.length,
        totalMonthlyCost: rentals.reduce((sum, r) => sum + (r.rentalMonthlyCost || 0), 0),
        expiringContracts,
        byProvider,
      }
    } catch (error) {
      console.error('Error generando reporte de equipos rentados:', error)
      throw error
    }
  }
}
