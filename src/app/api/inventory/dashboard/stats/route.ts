import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'
import {
  buildDeliveryActFamilyWhere,
  buildEquipmentFamilyWhere,
  buildInventoryFamilyWhere,
} from '@/lib/inventory/scope-filter'

/**
 * GET /api/inventory/dashboard/stats
 * Obtiene estadísticas clave del dashboard de inventario
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const role = session.user.role
    const ctx = await getInventorySessionContext(session.user)

    if (role === 'CLIENT' && !ctx.canManageInventory) {
      return NextResponse.json({
        totalEquipment: 0,
        equipmentByStatus: {},
        totalValue: 0,
        rentalMonthlyCost: 0,
        pendingRequests: 0,
        pendingActs: 0,
      })
    }

    if (ctx.scope.noAccess) {
      return NextResponse.json({
        totalEquipment: 0,
        equipmentByStatus: {},
        totalValue: 0,
        rentalMonthlyCost: 0,
        pendingRequests: 0,
        pendingActs: 0,
      })
    }

    const familyIds = ctx.user.isSuperAdmin ? undefined : ctx.scope.familyIds
    const equipmentScope = buildEquipmentFamilyWhere(familyIds)
    const requestScope = buildInventoryFamilyWhere(familyIds)
    const actsScope = buildDeliveryActFamilyWhere(familyIds)

    const [
      totalEquipment,
      equipmentByStatus,
      totalValue,
      rentalMonthlyCost,
      pendingRequests,
      pendingActs,
    ] = await Promise.all([
      prisma.equipment.count({ where: equipmentScope }),

      prisma.equipment.groupBy({
        by: ['status'],
        where: equipmentScope,
        _count: true,
      }),

      prisma.equipment.aggregate({
        where: equipmentScope,
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

      prisma.asset_requests.count({
        where: { ...requestScope, status: 'PENDING' },
      }),

      // delivery_acts no tiene familyId directo
      prisma.delivery_acts.count({
        where: { ...actsScope, status: 'PENDING' },
      }),
    ])

    const statusMap = Object.fromEntries(equipmentByStatus.map(s => [s.status, s._count]))

    return NextResponse.json({
      totalEquipment,
      equipmentByStatus: statusMap,
      totalValue: totalValue._sum.purchasePrice || 0,
      rentalMonthlyCost: rentalMonthlyCost._sum.rentalMonthlyCost || 0,
      pendingRequests,
      pendingActs,
    })
  } catch (error) {
    console.error('Error obteniendo estadísticas del dashboard:', error)
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 })
  }
}
