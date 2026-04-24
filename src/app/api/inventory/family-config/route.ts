import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/inventory/family-config
 * Devuelve el estado inventoryEnabled de todas las familias en una sola query.
 * Usado por la página de configuración de inventario para mostrar los toggles.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const configs = await prisma.inventory_family_config.findMany({
      select: { familyId: true, inventoryEnabled: true },
    })

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
