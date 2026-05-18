import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/inventory/family-config
 * Devuelve el estado inventoryEnabled de las familias accesibles para el usuario.
 * Super Admin ve todas. Admin Normal solo ve las de su scope de inventario.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    let configs: Array<{ familyId: string; inventoryEnabled: boolean }>
    if (isSuperAdmin) {
      configs = await prisma.inventory_family_config.findMany({
        select: { familyId: true, inventoryEnabled: true },
      })
    } else {
      // Admin Normal: solo configs de sus familias de inventario
      const { getInventorySessionContext } = await import('@/lib/inventory/inventory-session')
      const scope = (await getInventorySessionContext(session.user)).scope
      if (scope.familyIds && scope.familyIds.length > 0) {
        configs = await prisma.inventory_family_config.findMany({
          where: { familyId: { in: scope.familyIds } },
          select: { familyId: true, inventoryEnabled: true },
        })
      } else {
        configs = []
      }
    }

    // Mapa familyId → inventoryEnabled
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
