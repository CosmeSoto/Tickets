import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// DELETE /api/technician-family-assignments/[id]
// Si el técnico tiene tickets activos en esa familia, retorna 200 con campo `warning`
// y requiere ?confirm=true para proceder
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

    const assignment = await prisma.technician_family_assignments.findUnique({
      where: { id },
      include: {
        technician: { select: { id: true, name: true } },
        family: { select: { id: true, name: true } },
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { success: false, message: 'Asignación no encontrada' },
        { status: 404 }
      )
    }

    // Verificar tickets activos del técnico en esa familia
    const activeTickets = await prisma.tickets.count({
      where: {
        assigneeId: assignment.technicianId,
        familyId: assignment.familyId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    })

    if (activeTickets > 0 && !confirm) {
      return NextResponse.json({
        success: false,
        warning: true,
        message: `El técnico "${assignment.technician.name}" tiene ${activeTickets} ticket(s) activo(s) en la familia "${assignment.family.name}". Agrega ?confirm=true para confirmar la eliminación.`,
        activeTickets,
      })
    }

    await prisma.technician_family_assignments.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: `Asignación de "${assignment.technician.name}" a "${assignment.family.name}" eliminada exitosamente`,
    })
  } catch (error) {
    console.error('[DELETE /api/technician-family-assignments/[id]]', error)
    return NextResponse.json(
      { success: false, message: 'Error al eliminar asignación' },
      { status: 500 }
    )
  }
}
