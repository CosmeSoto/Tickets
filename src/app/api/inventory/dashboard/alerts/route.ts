import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'
import { BatchService } from '@/lib/services/batch-inventory.service'
import { getSetting } from '@/lib/api-cache'
import {
  buildConsumableFamilyWhere,
  buildDeliveryActFamilyWhere,
  buildEquipmentFamilyWhere,
  buildInventoryFamilyWhere,
  buildLicenseFamilyWhere,
} from '@/lib/inventory/scope-filter'

const EMPTY_ALERTS = {
  lowStockConsumables: 0,
  maintenanceDue: 0,
  expiringContracts: 0,
  expiringRentals: 0,
  expiringLicenses: 0,
  pendingActs: 0,
  pendingRequests: 0,
  batchCriticalBatches: 0,
  batchWarningBatches: 0,
  licenseAlertDays: 30,
  contractAlertDays: 30,
  maintenanceAlertDays: 30,
}

/**
 * GET /api/inventory/dashboard/alerts
 * Obtiene alertas importantes del dashboard de inventario
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const ctx = await getInventorySessionContext(session.user)
    const role = session.user.role

    if (role === 'CLIENT' && !ctx.canManageInventory) {
      return NextResponse.json(EMPTY_ALERTS)
    }

    if (ctx.scope.noAccess) {
      return NextResponse.json(EMPTY_ALERTS)
    }

    const familyIds = ctx.user.isSuperAdmin ? undefined : ctx.scope.familyIds
    const consumableScope = buildConsumableFamilyWhere(familyIds)
    const equipmentScope = buildEquipmentFamilyWhere(familyIds)
    const licenseScope = buildLicenseFamilyWhere(familyIds)
    const directFamilyScope = buildInventoryFamilyWhere(familyIds)
    const actsScope = buildDeliveryActFamilyWhere(familyIds)

    const now = new Date()
    const [licenseDaysRaw, contractDaysRaw, maintenanceDaysRaw] = await Promise.all([
      getSetting('inventory.license_alert_days_first', 600, '30'),
      getSetting('inventory.contract_alert_days', 600, '30'),
      getSetting('inventory.maintenance_alert_days', 600, '30'),
    ])
    const licenseDays = Math.max(1, parseInt(licenseDaysRaw ?? '30', 10) || 30)
    const contractDays = Math.max(1, parseInt(contractDaysRaw ?? '30', 10) || 30)
    const maintenanceDays = Math.max(1, parseInt(maintenanceDaysRaw ?? '30', 10) || 30)

    const licenseWindow = new Date(now.getTime() + licenseDays * 24 * 60 * 60 * 1000)
    const contractWindow = new Date(now.getTime() + contractDays * 24 * 60 * 60 * 1000)
    const maintenanceWindow = new Date(now.getTime() + maintenanceDays * 24 * 60 * 60 * 1000)

    const [
      lowStockConsumables,
      maintenanceDue,
      expiringContracts,
      expiringRentals,
      expiringLicenses,
      pendingActs,
      pendingRequests,
      batchOverview,
    ] = await Promise.all([
      (async () => {
        const candidates = await prisma.consumables.findMany({
          where: consumableScope,
          select: { currentStock: true, minStock: true },
        })
        return candidates.filter(c => c.currentStock <= c.minStock && c.currentStock > 0).length
      })(),

      prisma.maintenance_records.count({
        where: {
          equipment: equipmentScope,
          status: 'SCHEDULED',
          date: { lte: maintenanceWindow },
        },
      }),

      prisma.contracts.count({
        where: {
          ...directFamilyScope,
          status: 'ACTIVE',
          endDate: { lte: contractWindow, gte: now },
        },
      }),

      prisma.equipment.count({
        where: {
          ...equipmentScope,
          ownershipType: 'RENTAL',
          status: { not: 'RETIRED' },
          rentalEndDate: { lte: contractWindow, gte: now },
        },
      }),

      prisma.software_licenses.count({
        where: {
          ...licenseScope,
          expirationDate: { lte: licenseWindow, gte: now },
        },
      }),

      // delivery_acts no tiene familyId directo
      prisma.delivery_acts.count({
        where: {
          ...actsScope,
          status: 'PENDING',
        },
      }),

      prisma.asset_requests.count({
        where: {
          ...directFamilyScope,
          status: 'PENDING',
        },
      }),

      ctx.canManageInventory
        ? BatchService.getUtilizationOverview().catch(() => null)
        : Promise.resolve(null),
    ])

    return NextResponse.json({
      lowStockConsumables,
      maintenanceDue,
      expiringContracts,
      expiringRentals,
      expiringLicenses,
      pendingActs,
      pendingRequests,
      batchCriticalBatches: batchOverview?.summary.criticalCount ?? 0,
      batchWarningBatches: batchOverview?.summary.warningCount ?? 0,
      licenseAlertDays: licenseDays,
      contractAlertDays: contractDays,
      maintenanceAlertDays: maintenanceDays,
    })
  } catch (error) {
    console.error('Error obteniendo alertas del dashboard:', error)
    return NextResponse.json({ error: 'Error al obtener alertas' }, { status: 500 })
  }
}
