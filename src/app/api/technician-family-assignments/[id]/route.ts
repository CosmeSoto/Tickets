import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { unassignUserModuleFamily } from '@/lib/auth/user-family-access'
import { invalidateCache } from '@/lib/api-cache'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const confirm = searchParams.get('confirm') === 'true'

    const row = await prisma.user_family_access.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, role: true } },
        family: { select: { id: true, name: true } },
      },
    })

    if (!row || row.module !== 'tickets' || row.user.role !== 'TECHNICIAN') {
      return NextResponse.json(
        { success: false, message: 'Asignación no encontrada' },
        { status: 404 }
      )
    }

    const activeTickets = await prisma.tickets.count({
      where: {
        assigneeId: row.userId,
        familyId: row.familyId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    })

    if (activeTickets > 0 && !confirm) {
      return NextResponse.json({
        success: false,
        warning: true,
        message: `El técnico "${row.user.name}" tiene ${activeTickets} ticket(s) activo(s) en la familia "${row.family.name}". Agrega ?confirm=true para confirmar la eliminación.`,
        activeTickets,
      })
    }

    await unassignUserModuleFamily({
      userId: row.userId,
      familyId: row.familyId,
      moduleInput: 'tickets',
      role: 'TECHNICIAN',
    })

    await invalidateCache(`user:modules:${row.userId}`)

    return NextResponse.json({
      success: true,
      message: `Asignación de "${row.user.name}" a "${row.family.name}" eliminada exitosamente`,
    })
  } catch (error) {
    console.error('[DELETE /api/technician-family-assignments/[id]]', error)
    return NextResponse.json(
      { success: false, message: 'Error al eliminar asignación' },
      { status: 500 }
    )
  }
}
