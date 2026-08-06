import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { unassignUserModuleFamily } from '@/lib/auth/user-family-access'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const confirmed = searchParams.get('confirm') === 'true'

    const row = await prisma.user_family_access.findUnique({
      where: { id },
      include: {
        family: { select: { name: true } },
        user: { select: { role: true } },
      },
    })

    if (!row || row.module !== 'tickets' || row.user.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }

    if (!confirmed) {
      const activeTickets = await prisma.tickets.count({
        where: {
          clientId: row.userId,
          familyId: row.familyId,
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
      })

      if (activeTickets > 0) {
        return NextResponse.json(
          {
            success: false,
            requiresConfirmation: true,
            activeTickets,
            message: `El cliente tiene ${activeTickets} ticket(s) activo(s) en "${row.family.name}". ¿Desasignar de todas formas?`,
          },
          { status: 200 }
        )
      }
    }

    await unassignUserModuleFamily({
      userId: row.userId,
      familyId: row.familyId,
      moduleInput: 'tickets',
      role: 'CLIENT',
    })

    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await invalidateCache(`user:modules:${row.userId}`)
    } catch {
      /* Redis no disponible */
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/client-family-assignments/[id]]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
