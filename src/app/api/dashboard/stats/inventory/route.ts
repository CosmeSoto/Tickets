import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { withCache, buildCacheKey } from '@/lib/api-cache'

/**
 * GET /api/dashboard/stats/inventory
 * Métricas de inventario para el dashboard, filtradas por rol y familias asignadas.
 * Devuelve null si el usuario no tiene acceso a ninguna familia con inventario activo.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { role, id: userId } = session.user as { role: string; id: string }
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const canManageInventory = (session.user as any).canManageInventory === true

    // Determinar familias con inventario activo accesibles para este usuario
    let familyIds: string[] | undefined // undefined = todas

    if (role === 'ADMIN' && !isSuperAdmin) {
      const assignments = await prisma.admin_family_assignments.findMany({
        where: { adminId: userId, isActive: true },
        select: { familyId: true },
      })
      if (assignments.length > 0) {
        familyIds = assignments.map(a => a.familyId)
      }
    } else if (role === 'TECHNICIAN' || (role === 'CLIENT' && canManageInventory)) {
      const invFamilies = await prisma.inventory_manager_families.findMany({
        where: { managerId: userId },
        select: { familyId: true },
      })
      if (invFamilies.length === 0) {
        // Sin familias de inventario asignadas → no mostrar módulo
        return NextResponse.json(null)
      }
      familyIds = invFamilies.map(a => a.familyId)
    } else if (role === 'CLIENT' && !canManageInventory) {
      // Cliente sin gestión: solo sus equipos asignados personalmente
      const assignments = await prisma.equipment_assignments.findMany({
        where: { receiverId: userId, isActive: true },
        select: { equipmentId: true },
      })
      if (assignments.length === 0) return NextResponse.json(null)

      const equipmentIds = assignments.map(a => a.equipmentId)
      const [assigned, maintenance, pendingMaintenance] = await Promise.all([
        prisma.equipment.count({ where: { id: { in: equipmentIds } } }),
        prisma.equipment.count({ where: { id: { in: equipmentIds }, status: 'MAINTENANCE' } }),
        prisma.maintenance_records.count({
          where: {
            equipmentId: { in: equipmentIds },
            status: { in: ['REQUESTED', 'SCHEDULED', 'ACCEPTED'] },
          },
        }),
      ])
      return NextResponse.json({
        role: 'CLIENT',
        assignedEquipment: assigned,
        maintenanceEquipment: maintenance,
        pendingMaintenance,
      })
    }

    // Verificar que hay al menos una familia con inventario habilitado
    const invFamilyConfigs = await prisma.inventory_family_config.findMany({
      where: {
        inventoryEnabled: true,
        ...(familyIds ? { familyId: { in: familyIds } } : {}),
      },
      select: { familyId: true },
    })

    if (invFamilyConfigs.length === 0) return NextResponse.json(null)

    const activeFamilyIds = invFamilyConfigs.map(c => c.familyId)
    const familyFilter = { type: { familyId: { in: activeFamilyIds } } }

    const cacheKey = buildCacheKey('dashboard:inventory', {
      uid: userId,
      role,
      families: activeFamilyIds.sort().join(','),
    })

    const stats = await withCache(cacheKey, 120, async () => {
      const [
        totalAssets, availableAssets, assignedAssets, maintenanceAssets, retiredAssets,
        totalConsumables, lowStockConsumables, outOfStockConsumables,
        totalLicenses, expiredLicenses, expiringLicenses,
        pendingDeliveryActs, pendingReturnActs, pendingDecommissions,
      ] = await Promise.all([
        prisma.equipment.count({ where: { ...familyFilter, status: { not: 'RETIRED' } } }),
        prisma.equipment.count({ where: { ...familyFilter, status: 'AVAILABLE' } }),
        prisma.equipment.count({ where: { ...familyFilter, status: 'ASSIGNED' } }),
        prisma.equipment.count({ where: { ...familyFilter, status: 'MAINTENANCE' } }),
        prisma.equipment.count({ where: { ...familyFilter, status: 'RETIRED' } }),
        prisma.consumables.count({ where: { consumableType: { familyId: { in: activeFamilyIds } } } }),
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count FROM consumables c
          INNER JOIN consumable_types ct ON c.type_id = ct.id
          WHERE ct.family_id = ANY(${activeFamilyIds}::text[])
          AND c.current_stock <= c.min_stock AND c.current_stock > 0
        `.then(r => Number(r[0]?.count ?? 0)),
        prisma.consumables.count({
          where: {
            consumableType: { familyId: { in: activeFamilyIds } },
            currentStock: 0,
          },
        }),
        prisma.software_licenses.count({ where: { licenseType: { familyId: { in: activeFamilyIds } } } }),
        prisma.software_licenses.count({
          where: {
            licenseType: { familyId: { in: activeFamilyIds } },
            expirationDate: { lt: new Date() },
          },
        }),
        prisma.software_licenses.count({
          where: {
            licenseType: { familyId: { in: activeFamilyIds } },
            expirationDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        // Actas de entrega pendientes
        prisma.delivery_acts.count({ where: { status: 'PENDING' } }),
        // Actas de devolución pendientes
        (prisma.return_acts as any).count({ where: { status: 'PENDING' } }).catch(() => 0),
        // Solicitudes de baja pendientes
        prisma.decommission_requests.count({ where: { status: 'PENDING' } }),
      ])

      return {
        role,
        // Equipos
        totalAssets,
        availableAssets,
        assignedAssets,
        maintenanceAssets,
        retiredAssets,
        // Consumibles
        totalConsumables,
        lowStockConsumables,
        outOfStockConsumables,
        // Licencias
        totalLicenses,
        expiredLicenses,
        expiringLicenses,
        // Actas y solicitudes pendientes
        pendingDeliveryActs,
        pendingReturnActs,
        pendingDecommissions,
        // Familias activas
        activeFamilyCount: activeFamilyIds.length,
      }
    })

    return NextResponse.json(stats)
  } catch (error) {
    console.error('[Dashboard Inventory Stats]', error)
    return NextResponse.json({ error: 'Error al cargar métricas de inventario' }, { status: 500 })
  }
}
