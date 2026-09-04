import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ContractAssignmentService } from '@/lib/services/contract-assignment.service'

/**
 * POST /api/inventory/contract-assignments/[id]/undo
 *
 * Deshace una asignación de responsable creada por error, mientras su acta
 * de entrega siga PENDING (sin firmar) — ver ContractAssignmentService.
 * undoAssignment. A diferencia de "Retiro" (que exige un acta ACEPTADA),
 * esto borra la asignación y su acta pendiente, y restaura al responsable
 * anterior si lo había.
 *
 * Solo Super Admin: es una eliminación de datos, igual de irreversible que
 * "Eliminar acta" en /inventory/acts — no se ofrece a roles de área.
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el Super Administrador puede deshacer una asignación' },
        { status: 403 }
      )
    }

    const { id: assignmentId } = await context.params
    const assignment = await prisma.contract_assignments.findUnique({
      where: { id: assignmentId },
      select: { id: true },
    })
    if (!assignment) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }

    const result = await ContractAssignmentService.undoAssignment(assignmentId, session.user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[POST contract-assignments/undo]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo deshacer la asignación' },
      { status: 400 }
    )
  }
}
