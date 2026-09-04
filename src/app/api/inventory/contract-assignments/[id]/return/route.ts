import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAsset, inventoryForbidden } from '@/lib/inventory-access'
import { assertContractWriteAccess } from '@/lib/contracts/access'
import { InventoryNotificationService } from '@/lib/services/inventory-notification.service'
import { ContractReturnActService } from '@/lib/services/contract-return-act.service'
import { ContractAssignmentService } from '@/lib/services/contract-assignment.service'
import { returnContractAssignmentSchema } from '@/lib/validations/contract-assignment'
import { ZodError } from 'zod'

/**
 * POST /api/inventory/contract-assignments/[id]/return
 * Genera acta de retiro al devolver la suscripción/contrato del cliente.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { id: assignmentId } = await context.params
    const assignment = await prisma.contract_assignments.findUnique({
      where: { id: assignmentId },
      include: { contract: { select: { id: true, familyId: true } } },
    })
    if (!assignment) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }

    try {
      await assertContractWriteAccess(
        {
          id: session.user.id,
          role: session.user.role,
          isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin,
        },
        assignment.contract.id
      )
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Sin permiso' },
        { status: 403 }
      )
    }

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    if (!isSuperAdmin && assignment.contract.familyId) {
      const allowed = await canManageAsset(
        session.user.id,
        session.user.role,
        isSuperAdmin,
        assignment.contract.familyId
      )
      if (!allowed) return inventoryForbidden()
    }

    const body = returnContractAssignmentSchema.parse(await request.json())

    // Si el área no exige acta de entrega, tampoco tiene sentido exigir una firma
    // de retiro — la asignación nunca llegó a tener un acta que aceptar (ver
    // ContractAssignmentService.createAssignment). Cerrar directo, sin acta.
    const familyConfig = assignment.contract.familyId
      ? await prisma.inventory_family_config.findUnique({
          where: { familyId: assignment.contract.familyId },
          select: { requireDeliveryAct: true },
        })
      : null

    if (familyConfig?.requireDeliveryAct === false) {
      const closed = await ContractAssignmentService.closeAssignment(
        assignmentId,
        body.returnDate ? new Date(body.returnDate) : undefined
      )
      return NextResponse.json({ assignment: closed, returnAct: null, acceptanceUrl: null })
    }

    const returnAct = await ContractReturnActService.generateReturnAct(assignmentId, body)

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const acceptanceUrl = `${baseUrl}/acts/contract-return/${returnAct.id}/accept?token=${returnAct.acceptanceToken}`

    InventoryNotificationService.sendSubscriptionReturnActNotification(returnAct.id).catch(
      console.error
    )

    return NextResponse.json({ returnAct, acceptanceUrl }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    console.error('[POST contract return]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar retiro' },
      { status: 400 }
    )
  }
}
