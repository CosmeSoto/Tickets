import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  assertInventoryFamilyRoute,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

/**
 * GET /api/inventory/families/[id]/types
 * Retorna los tipos de equipo, consumible y licencia activos de una familia.
 * Requiere sesión activa con canManageInventory o rol ADMIN.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { familyId } = await params

    try {
      await assertInventoryFamilyRoute(toInventoryAccessUser(session.user), familyId, 'read')
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const family = await prisma.families.findUnique({
      where: { id: familyId },
    })

    if (!family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    const [equipmentTypes, consumableTypes, licenseTypes] = await Promise.all([
      prisma.equipment_types.findMany({
        where: { familyId, isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.consumable_types.findMany({
        where: { familyId, isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.license_types.findMany({
        where: { familyId, isActive: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return NextResponse.json({ equipmentTypes, consumableTypes, licenseTypes })
  } catch {
    return NextResponse.json({ error: 'Error al obtener los tipos de la familia' }, { status: 500 })
  }
}
