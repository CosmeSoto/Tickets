import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * DELETE /api/client-family-assignments/[id]?confirm=true
 * Elimina una asignación cliente-familia.
 * Si el cliente tiene tickets activos en esa familia, requiere ?confirm=true.
 */
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

    const assignment = await prisma.client_family_assignments.findUnique({
      where: { id },
      include: {
        family: { select: { name: true } },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }

    // Verificar tickets activos del cliente en esta familia
    if (!confirmed) {
      const activeTickets = await prisma.tickets.count({
        where: {
          clientId: assignment.clientId,
          familyId: assignment.familyId,
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
      })

      if (activeTickets > 0) {
        return NextResponse.json(
          {
            success: false,
            requiresConfirmation: true,
            activeTickets,
            message: `El cliente tiene ${activeTickets} ticket(s) activo(s) en "${assignment.family.name}". ¿Desasignar de todas formas?`,
          },
          { status: 200 }
        )
      }
    }

    await prisma.client_family_assignments.delete({ where: { id } })

    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await invalidateCache(`user:modules:${assignment.clientId}`)
    } catch {
      /* Redis no disponible */
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/client-family-assignments/[id]]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
