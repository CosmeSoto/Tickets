import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assignUserModuleFamily } from '@/lib/auth/user-family-access'

/**
 * @deprecated Preferir `/api/admin/users/:id/family-access` (module=tickets).
 * Thin wrapper sobre user_family_access.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    if (!clientId) return NextResponse.json({ error: 'clientId requerido' }, { status: 400 })

    const rows = await prisma.user_family_access.findMany({
      where: { userId: clientId, module: 'tickets', isActive: true },
      include: {
        family: {
          select: { id: true, name: true, code: true, color: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const familyIds = rows.map(a => a.familyId)
    const activeTicketCounts =
      familyIds.length > 0
        ? await prisma.tickets.groupBy({
            by: ['familyId'],
            where: {
              clientId,
              familyId: { in: familyIds },
              status: { notIn: ['RESOLVED', 'CLOSED'] },
            },
            _count: { id: true },
          })
        : []

    const ticketMap = Object.fromEntries(activeTicketCounts.map(t => [t.familyId, t._count.id]))

    const assignments = rows.map(row => ({
      id: row.id,
      clientId: row.userId,
      familyId: row.familyId,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      family: row.family,
      activeTickets: ticketMap[row.familyId] ?? 0,
    }))

    return NextResponse.json({ success: true, data: assignments })
  } catch (error) {
    console.error('[GET /api/client-family-assignments]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { clientId, familyId } = await request.json()
    if (!clientId || !familyId)
      return NextResponse.json({ error: 'clientId y familyId son requeridos' }, { status: 400 })

    const user = await prisma.users.findUnique({
      where: { id: clientId },
      select: { id: true, role: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    if (user.role !== 'CLIENT')
      return NextResponse.json(
        { error: 'Solo se pueden asignar familias a usuarios con rol CLIENT' },
        { status: 400 }
      )

    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { id: true, isActive: true, name: true, code: true, color: true },
    })
    if (!family) return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    if (!family.isActive)
      return NextResponse.json({ error: 'La familia no está activa' }, { status: 400 })

    const existing = await prisma.user_family_access.findUnique({
      where: {
        userId_familyId_module: { userId: clientId, familyId, module: 'tickets' },
      },
    })
    if (existing?.isActive) {
      return NextResponse.json(
        { error: 'El cliente ya está asignado a esta familia' },
        { status: 409 }
      )
    }

    await assignUserModuleFamily({
      userId: clientId,
      familyId,
      moduleInput: 'tickets',
      role: 'CLIENT',
    })

    const row = await prisma.user_family_access.findUnique({
      where: {
        userId_familyId_module: { userId: clientId, familyId, module: 'tickets' },
      },
    })

    await invalidateClientCache(clientId)

    const assignment = {
      id: row?.id ?? clientId,
      clientId,
      familyId,
      isActive: true,
      family: {
        id: family.id,
        name: family.name,
        code: family.code,
        color: family.color,
        isActive: family.isActive,
      },
    }

    return NextResponse.json({ success: true, data: assignment }, { status: existing ? 200 : 201 })
  } catch (error: any) {
    console.error('[POST /api/client-family-assignments]', error)
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 400 }
    )
  }
}

async function invalidateClientCache(clientId: string) {
  try {
    const { invalidateCache } = await import('@/lib/api-cache')
    await invalidateCache(`user:modules:${clientId}`)
  } catch {
    /* Redis no disponible */
  }
}
