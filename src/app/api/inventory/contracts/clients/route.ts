import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

/**
 * GET /api/inventory/contracts/clients?familyId=
 * Clientes activos con acceso al área (user_family_access tickets).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!(await canManageInventory(session.user.id, session.user.role))) {
    return inventoryForbidden()
  }

  const familyId = request.nextUrl.searchParams.get('familyId')
  if (!familyId) {
    return NextResponse.json({ error: 'familyId es requerido' }, { status: 400 })
  }

  const rows = await prisma.user_family_access.findMany({
    where: { familyId, module: 'tickets', isActive: true, canConsume: true },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, isActive: true },
      },
    },
    orderBy: { user: { name: 'asc' } },
  })

  const clients = rows.map(a => a.user).filter(c => c.isActive && c.role === 'CLIENT')

  return NextResponse.json({ clients })
}
