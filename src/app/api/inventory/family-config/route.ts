import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import { getInventoryManageFamilyIds } from '@/lib/inventory/family-access'

/**
 * GET /api/inventory/family-config
 * Devuelve inventoryEnabled de las familias accesibles.
 * Super Admin / ADMIN con scope / gestores de inventario.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const userId = session.user.id
    const role = session.user.role
    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true

    let configs: Array<{ familyId: string; inventoryEnabled: boolean }>

    if (role === 'ADMIN' && isSuperAdmin) {
      configs = await prisma.inventory_family_config.findMany({
        select: { familyId: true, inventoryEnabled: true },
      })
    } else {
      const manages =
        role === 'ADMIN' ? true : await canManageInventory(userId, role)
      if (role !== 'ADMIN' && !manages) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }

      const familyIds = await getInventoryManageFamilyIds(
        userId,
        role,
        isSuperAdmin,
        manages
      )

      if (familyIds === undefined) {
        // ADMIN sin restricción de familias
        configs = await prisma.inventory_family_config.findMany({
          select: { familyId: true, inventoryEnabled: true },
        })
      } else if (familyIds.length === 0) {
        configs = []
      } else {
        configs = await prisma.inventory_family_config.findMany({
          where: { familyId: { in: familyIds } },
          select: { familyId: true, inventoryEnabled: true },
        })
      }
    }

    const map: Record<string, boolean> = {}
    configs.forEach(c => {
      map[c.familyId] = c.inventoryEnabled
    })

    return NextResponse.json({ success: true, data: map })
  } catch (error) {
    console.error('[inventory-config] GET all:', error)
    return NextResponse.json({ error: 'Error al obtener configuraciones' }, { status: 500 })
  }
}
