import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractPaymentService } from '@/lib/services/contract-payment.service'
import {
  assertContractPaymentAccess,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

/**
 * POST /api/inventory/contracts/payments/[paymentId]/mark-paid
 * Marca un pago como pagado
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    try {
      await assertContractPaymentAccess(toInventoryAccessUser(session.user), paymentId, 'write')
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const body = await request.json()
    const { paidDate, paymentMethod, referenceNumber, notes } = body

    if (!paidDate) {
      return NextResponse.json({ error: 'Fecha de pago requerida' }, { status: 400 })
    }

    const payment = await ContractPaymentService.markAsPaid(
      paymentId,
      {
        paidDate: new Date(paidDate),
        paymentMethod,
        referenceNumber,
        notes,
      },
      session.user.id
    )

    return NextResponse.json(payment)
  } catch (error) {
    console.error('Error marcando pago como pagado:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al marcar pago' },
      { status: 500 }
    )
  }
}
