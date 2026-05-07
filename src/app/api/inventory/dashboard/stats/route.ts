import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/inventory/dashboard/stats
 * Obtiene estadísticas clave del dashboard de inventario
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = session.user as any
    const role = user.role

    // Construir scope de familias según rol del usuario
    const familyScope: any = {}

    if (role === 'CLIENT') {
      // Clientes solo ven equipos asignados a ellos
      if (!user.canManageInventory) {
        return NextResponse.json({
          totalEquipment: 0,
          equipmentByStatus: {},
          totalValue: 0,
          rentalMonthlyCost: 0,
          pendingRequests: 0,
          pendingActs: 0,
        })
      }
      // Clientes con canManageInventory ven su familia
      if (user.familyId) {
        familyScope.familyId = user.familyId
      }
    } else if (role === 'TECHNICIAN') {
      // Técnicos ven su familia si tienen una asignada
      if (user.familyId) {
        familyScope.familyId = user.familyId
      }
    }
    // ADMIN ve todo (sin filtro)

    // Obtener estadísticas en paralelo
    const [
      totalEquipment,
      equipmentByStatus,
      totalValue,
      rentalMonthlyCost,
      pendingRequests,
      pendingActs,
    ] = await Promise.all([
      // Total de equipos
      prisma.equipment.count({ where: familyScope }),

      // Equipos por estado
      prisma.equipment.groupBy({
        by: ['status'],
        where: familyScope,
        _count: true,
      }),

      // Valor total del inventario
      prisma.equipment.aggregate({
        where: familyScope,
        _sum: { purchasePrice: true },
      }),

      // Costo mensual de arrendamientos activos
      prisma.equipment.aggregate({
        where: {
          ...familyScope,
          ownershipType: 'RENTAL',
          status: { not: 'RETIRED' },
        },
        _sum: { rentalMonthlyCost: true },
      }),

      // Solicitudes pendientes
      prisma.asset_requests.count({
        where: { ...familyScope, status: 'PENDING' },
      }),

      // Actas pendientes de firma
      prisma.delivery_acts.count({
        where: { ...familyScope, status: 'PENDING' },
      }),
    ])

    // Transformar equipmentByStatus a objeto
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
