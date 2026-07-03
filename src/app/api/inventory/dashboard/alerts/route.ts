import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'
import { BatchService } from '@/lib/services/batch-inventory.service'

/**
 * GET /api/inventory/dashboard/alerts
 * Obtiene alertas importantes del dashboard de inventario
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = session.user as any
    const role = user.role
    const canManageFromDb = (await getInventorySessionContext(session.user)).canManageInventory

    // Construir scope de familias según rol del usuario
    const familyScope: any = {}

    if (role === 'CLIENT') {
      if (!canManageFromDb) {
        return NextResponse.json({
          lowStockConsumables: 0,
          maintenanceDue: 0,
          expiringContracts: 0,
          expiringRentals: 0,
          expiringLicenses: 0,
          pendingActs: 0,
          pendingRequests: 0,
          batchCriticalBatches: 0,
          batchWarningBatches: 0,
        })
      }
      if (user.familyId) {
        familyScope.familyId = user.familyId
      }
    } else if (role === 'TECHNICIAN') {
      if (user.familyId) {
        familyScope.familyId = user.familyId
      }
    }

    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Obtener alertas en paralelo
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
      // Consumibles con stock bajo - usar queryRaw para comparar campos
      (async () => {
        if (familyScope.familyId) {
          const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count
            FROM consumables
            WHERE family_id = ${familyScope.familyId}
            AND current_stock <= min_stock
          `
          return Number(result[0]?.count || 0)
        } else {
          const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count
            FROM consumables
            WHERE current_stock <= min_stock
          `
          return Number(result[0]?.count || 0)
        }
      })(),

      // Mantenimientos vencidos o próximos
      prisma.maintenance_records.count({
        where: {
          ...(familyScope.familyId && { equipment: { familyId: familyScope.familyId } }),
          status: 'SCHEDULED',
          date: { lte: thirtyDaysFromNow },
        },
      }),

      // Contratos próximos a vencer
      prisma.contracts.count({
        where: {
          ...familyScope,
          status: 'ACTIVE',
          endDate: {
            lte: thirtyDaysFromNow,
            gte: now,
          },
        },
      }),

      // Arrendamientos próximos a vencer
      prisma.equipment.count({
        where: {
          ...familyScope,
          ownershipType: 'RENTAL',
          status: { not: 'RETIRED' },
          rentalEndDate: {
            lte: thirtyDaysFromNow,
            gte: now,
          },
        },
      }),

      // Licencias próximas a expirar
      prisma.software_licenses.count({
        where: {
          ...familyScope,
          expirationDate: {
            lte: thirtyDaysFromNow,
            gte: now,
          },
        },
      }),

      // Actas pendientes de firma
      prisma.delivery_acts.count({
        where: { ...familyScope, status: 'PENDING' },
      }),

      // Solicitudes pendientes de aprobación
      prisma.asset_requests.count({
        where: { ...familyScope, status: 'PENDING' },
      }),

      role === 'ADMIN' || canManageFromDb
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
    })
  } catch (error) {
    console.error('Error obteniendo alertas del dashboard:', error)
    return NextResponse.json({ error: 'Error al obtener alertas' }, { status: 500 })
  }
}
