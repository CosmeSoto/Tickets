import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageAsset, inventoryForbidden } from '@/lib/inventory-access'
import { assertContractWriteAccess } from '@/lib/contracts/access'
import { InventoryNotificationService } from '@/lib/services/inventory-notification.service'
import { ContractAssignmentService } from '@/lib/services/contract-assignment.service'
import { ContractDeliveryActService } from '@/lib/services/contract-delivery-act.service'
import { ContractReturnActService } from '@/lib/services/contract-return-act.service'
import { assignContractSchema } from '@/lib/validations/contract-assignment'
import { ZodError } from 'zod'

/**
 * POST /api/inventory/contracts/[id]/assign
 * Asigna el contrato/suscripción a un cliente y genera acta de entrega.
 * Si había otro cliente, cierra la asignación anterior y genera acta de retiro.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { id: contractId } = await context.params

    try {
      await assertContractWriteAccess(
        {
          id: session.user.id,
          role: session.user.role,
          isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin,
        },
        contractId
      )
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Sin permiso' },
        { status: 403 }
      )
    }

    const contract = await prisma.contracts.findUnique({
      where: { id: contractId },
      select: { familyId: true },
    })
    if (!contract) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    if (!isSuperAdmin && contract.familyId) {
      const allowed = await canManageAsset(
        session.user.id,
        session.user.role,
        isSuperAdmin,
        contract.familyId
      )
      if (!allowed) return inventoryForbidden()
    }

    const body = assignContractSchema.parse(await request.json())
    let assignmentResult
    try {
      assignmentResult = await ContractAssignmentService.createAssignment(
        contractId,
        body,
        session.user.id
      )
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Error al asignar' },
        { status: 400 }
      )
    }

    const { assignment, previousAssignmentId } = assignmentResult
    let returnAct = null
    let deliveryAct = null
    let acceptanceUrl: string | null = null
    let returnAcceptanceUrl: string | null = null

    try {
      if (previousAssignmentId) {
        returnAct = await ContractReturnActService.generateReturnAct(previousAssignmentId, {
          withdrawalReason: body.changeReason || 'Cambio de cliente',
          handoverNotes: body.notes || undefined,
        })
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        returnAcceptanceUrl = `${baseUrl}/acts/contract-return/${returnAct.id}/accept?token=${returnAct.acceptanceToken}`
      }

      const familyConfig = contract.familyId
        ? await prisma.inventory_family_config.findUnique({
            where: { familyId: contract.familyId },
            select: { requireDeliveryAct: true },
          })
        : null

      if (familyConfig?.requireDeliveryAct !== false) {
        deliveryAct = await ContractDeliveryActService.generateDeliveryAct(assignment.id)
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        acceptanceUrl = `${baseUrl}/acts/${deliveryAct.id}/accept?token=${deliveryAct.acceptanceToken}`
        InventoryNotificationService.sendSubscriptionDeliveryActNotification(deliveryAct.id).catch(
          console.error
        )
      }

      if (returnAct) {
        InventoryNotificationService.sendSubscriptionReturnActNotification(returnAct.id).catch(
          console.error
        )
      }

      return NextResponse.json(
        {
          assignment,
          deliveryAct,
          returnAct,
          acceptanceUrl,
          returnAcceptanceUrl,
        },
        { status: 201 }
      )
    } catch (actError) {
      await ContractAssignmentService.rollbackFailedAssign({
        newAssignmentId: assignment.id,
        previousAssignmentId,
        returnActId: returnAct?.id ?? null,
      }).catch(console.error)
      throw actError
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    console.error('[POST assign contract]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al asignar contrato' },
      { status: 500 }
    )
  }
}
