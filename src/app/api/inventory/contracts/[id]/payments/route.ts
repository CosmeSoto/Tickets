import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractPaymentService } from '@/lib/services/contract-payment.service'
import {
  assertContractAccess,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

/**
 * GET /api/inventory/contracts/[id]/payments
 * Obtiene todos los pagos de un contrato
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    try {
      await assertContractAccess(toInventoryAccessUser(session.user), id, 'read')
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    const result = await ContractPaymentService.list({
      contractId: id,
      status: status as any,
      page,
      pageSize,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error obteniendo pagos:', error)
    return NextResponse.json({ error: 'Error al obtener pagos' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/contracts/[id]/payments
 * Crea un nuevo pago para el contrato
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    try {
      await assertContractAccess(toInventoryAccessUser(session.user), id, 'write')
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const body = await request.json()
    const { amount, currency, dueDate, paymentMethod, referenceNumber, notes } = body

    // Validaciones
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
    }

    if (!dueDate) {
      return NextResponse.json({ error: 'Fecha de vencimiento requerida' }, { status: 400 })
    }

    const payment = await ContractPaymentService.create({
      contractId: id,
      amount,
      currency,
      dueDate: new Date(dueDate),
      paymentMethod,
      referenceNumber,
      notes,
      createdBy: session.user.id,
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('Error creando pago:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear pago' },
      { status: 500 }
    )
  }
}
