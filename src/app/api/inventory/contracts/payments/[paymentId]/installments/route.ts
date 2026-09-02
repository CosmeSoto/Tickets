/**
 * GET  /api/inventory/contracts/payments/[paymentId]/installments — lista abonos
 * POST /api/inventory/contracts/payments/[paymentId]/installments — registra un
 *      pago (completo o parcial) — ver ContractPaymentService.registerPayment.
 */

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await assertContractPaymentAccess(toInventoryAccessUser(session.user), paymentId, 'read')
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const installments = await ContractPaymentService.listInstallments(paymentId)
    return NextResponse.json({ installments })
  } catch (error) {
    console.error('[GET /contracts/payments/[id]/installments]', error)
    return NextResponse.json({ error: 'Error al obtener los abonos' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await assertContractPaymentAccess(toInventoryAccessUser(session.user), paymentId, 'write')
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const body = await req.json()
    if (!body.paidDate) {
      return NextResponse.json({ error: 'Fecha de pago requerida' }, { status: 400 })
    }

    const payment = await ContractPaymentService.registerPayment(
      paymentId,
      {
        amount: body.amount !== undefined && body.amount !== null ? Number(body.amount) : undefined,
        paidDate: new Date(body.paidDate),
        paymentMethod: body.paymentMethod || undefined,
        referenceNumber: body.referenceNumber || undefined,
        notes: body.notes || undefined,
      },
      session.user.id
    )
    return NextResponse.json(payment)
  } catch (error) {
    console.error('[POST /contracts/payments/[id]/installments]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al registrar el pago' },
      { status: 500 }
    )
  }
}
