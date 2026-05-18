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
 * GET /api/inventory/contracts/payments/[paymentId]
 * Obtiene un pago específico
 */
export async function GET(
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
      await assertContractPaymentAccess(toInventoryAccessUser(session.user), paymentId, 'read')
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const payment = await ContractPaymentService.getById(paymentId)

    if (!payment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    }

    return NextResponse.json(payment)
  } catch (error) {
    console.error('Error obteniendo pago:', error)
    return NextResponse.json({ error: 'Error al obtener pago' }, { status: 500 })
  }
}

/**
 * PATCH /api/inventory/contracts/payments/[paymentId]
 * Actualiza un pago
 */
export async function PATCH(
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
    const { amount, currency, dueDate, paidDate, paymentMethod, referenceNumber, notes } = body

    const updateData: any = {}
    if (amount !== undefined) updateData.amount = amount
    if (currency !== undefined) updateData.currency = currency
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate)
    if (paidDate !== undefined) updateData.paidDate = paidDate ? new Date(paidDate) : null
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod
    if (referenceNumber !== undefined) updateData.referenceNumber = referenceNumber
    if (notes !== undefined) updateData.notes = notes

    const payment = await ContractPaymentService.update(paymentId, updateData, session.user.id)

    return NextResponse.json(payment)
  } catch (error) {
    console.error('Error actualizando pago:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar pago' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/inventory/contracts/payments/[paymentId]
 * Elimina un pago
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await ContractPaymentService.delete(paymentId, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando pago:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar pago' },
      { status: 500 }
    )
  }
}
