import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  buildCatalogFamilyWhere,
  requireInventoryCatalogRead,
} from '@/lib/inventory/inventory-catalog-access'
import {
  InventoryAccessError,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

/**
 * GET /api/inventory/equipment-types
 * Retorna tipos de equipo activos.
 * Query params:
 *   - familyId: filtrar por familia (opcional)
 *   - includeInactive: incluir inactivos (solo ADMIN)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const ctx = await requireInventoryCatalogRead(session.user)
    const isAdmin = ctx.user.role === 'ADMIN'
    const { searchParams } = req.nextUrl
    const familyId = searchParams.get('familyId') ?? undefined
    const includeInactive = isAdmin && searchParams.get('includeInactive') === 'true'
    const familyFilter = buildCatalogFamilyWhere(ctx, familyId, true)

    const types = await prisma.equipment_types.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...familyFilter,
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        icon: true,
        familyId: true,
        isActive: true,
        order: true,
      },
    })

    return NextResponse.json({ types })
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    console.error('[GET /api/inventory/equipment-types]', err)
    return NextResponse.json({ error: 'Error al obtener tipos de equipo' }, { status: 500 })
  }
}
