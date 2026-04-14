import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'

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

    const { role, id: userId } = session.user as { role: string; id: string }
    const isAdmin = role === 'ADMIN'

    if (!isAdmin) {
      const allowed = await canManageInventory(userId, role)
      if (!allowed) {
        return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
      }
    }

    const { searchParams } = req.nextUrl
    const familyId = searchParams.get('familyId') ?? undefined
    const includeInactive = isAdmin && searchParams.get('includeInactive') === 'true'

    const types = await prisma.equipment_types.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        // Sin familia = global (visible para todas las familias)
        // Con familia = solo esa familia + los globales
        ...(familyId ? { OR: [{ familyId }, { familyId: null }] } : {}),
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: { id: true, code: true, name: true, icon: true, familyId: true, isActive: true, order: true },
    })

    return NextResponse.json({ types })
  } catch (err) {
    console.error('[GET /api/inventory/equipment-types]', err)
    return NextResponse.json({ error: 'Error al obtener tipos de equipo' }, { status: 500 })
  }
}
