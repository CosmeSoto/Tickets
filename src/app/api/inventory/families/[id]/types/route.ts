import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'

/**
 * GET /api/inventory/families/[id]/types
 * Retorna los tipos de equipo, consumible y licencia activos de una familia.
 * Requiere sesión activa con canManageInventory o rol ADMIN.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { user } = session
    const isAdmin = user.role === 'ADMIN'
    const isManager = await canManageInventory(user.id, user.role)

    if (!isAdmin && !isManager) {
      return NextResponse.json(
        { error: 'No tienes permiso para acceder al inventario' },
        { status: 403 }
      )
    }

    const { id } = await params

    const family = await prisma.inventory_families.findUnique({
      where: { id },
    })

    if (!family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    const [equipmentTypes, consumableTypes, licenseTypes] = await Promise.all([
      prisma.equipment_types.findMany({
        where: { familyId: id, isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.consumable_types.findMany({
        where: { familyId: id, isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.license_types.findMany({
        where: { familyId: id, isActive: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return NextResponse.json({ equipmentTypes, consumableTypes, licenseTypes })
  } catch {
    return NextResponse.json(
      { error: 'Error al obtener los tipos de la familia' },
      { status: 500 }
    )
  }
}
