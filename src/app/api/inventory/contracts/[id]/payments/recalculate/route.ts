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
 * POST /api/inventory/contracts/[id]/payments/recalculate
 * Recalcula cuotas pendientes según activos aún en renta en cada fecha.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const result = await ContractPaymentService.recalculatePendingAmounts(id, session.user.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST payments/recalculate]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al recalcular' },
      { status: 500 }
    )
  }
}
