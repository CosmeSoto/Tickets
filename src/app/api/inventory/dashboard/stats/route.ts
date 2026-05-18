import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'

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
    const canManageFromDb = (await getInventorySessionContext(session.user)).canManageInventory

    // Construir scope de familias según rol del usuario
    const familyScope: any = {}
    const requestScope: any = {}

    if (role === 'CLIENT') {
      // Clientes solo ven equipos asignados a ellos
      if (!canManageFromDb) {
        return NextResponse.json({
          totalEquipment: 0,
          equipmentByStatus: {},
          totalValue: 0,
          rentalMonthlyCost: 0,
          pendingRequests: 0,
          pendingActs: 0,
        })
      }
      // Clientes con canManageInventory ven su familia (a través de typeId)
      if (user.familyId) {
        const typesInFamily = await prisma.equipment_types.findMany({
          where: { familyId: user.familyId },
          select: { id: true },
        })
        familyScope.typeId = { in: typesInFamily.map(t => t.id) }
      }
    } else if (role === 'TECHNICIAN') {
      // Técnicos ven su familia si tienen una asignada (a través de typeId)
      if (user.familyId) {
        const typesInFamily = await prisma.equipment_types.findMany({
          where: { familyId: user.familyId },
          select: { id: true },
        })
        familyScope.typeId = { in: typesInFamily.map(t => t.id) }
      }
    } else if (role === 'ADMIN') {
      // Admin Normal: filtrar por sus familias de inventario asignadas
      if (!user.isSuperAdmin) {
        const { getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
        const inventoryFamilyIds = await getModuleFamilyIds(user.id, 'inventory')
        if (inventoryFamilyIds.length > 0) {
          // Obtener typeIds que pertenecen a las familias del scope
          const typesInScope = await prisma.equipment_types.findMany({
            where: { familyId: { in: inventoryFamilyIds } },
            select: { id: true },
          })
          const typeIds = typesInScope.map(t => t.id)
          if (typeIds.length > 0) {
            familyScope.typeId = { in: typeIds }
          } else {
            familyScope.id = '__NONE__' // No hay tipos en scope, no mostrar nada
          }
          // Para asset_requests y delivery_acts (tienen familyId directo)
          requestScope.familyId = { in: inventoryFamilyIds }
        } else {
          familyScope.id = '__NONE__' // Sin familias asignadas
          requestScope.id = '__NONE__'
        }
      }
      // Super Admin: sin filtro (ve todo)
    }

    // Scope separado para asset_requests y delivery_acts (TECHNICIAN/CLIENT con familyId)
    if (role === 'TECHNICIAN' && user.familyId) {
      requestScope.familyId = user.familyId
    } else if (role === 'CLIENT' && canManageFromDb && user.familyId) {
      requestScope.familyId = user.familyId
    }

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
        where: { ...requestScope, status: 'PENDING' },
      }),

      // Actas pendientes de firma
      prisma.delivery_acts.count({
        where: { ...requestScope, status: 'PENDING' },
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
