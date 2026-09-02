/**
 * DELETE /api/inventory/contracts/payments/installments/[installmentId] —
 * deshace un abono (los abonos son inmutables: corregir = eliminar + volver
 * a registrar, no editar).
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ installmentId: string }> }
) {
  try {
    const { installmentId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const installment = await ContractPaymentService.getInstallmentById(installmentId)
    if (!installment) return NextResponse.json({ error: 'Abono no encontrado' }, { status: 404 })

    try {
      await assertContractPaymentAccess(
        toInventoryAccessUser(session.user),
        installment.paymentId,
        'write'
      )
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const result = await ContractPaymentService.deleteInstallment(installmentId, session.user.id)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[DELETE /contracts/payments/installments/[id]]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar el abono' },
      { status: 500 }
    )
  }
}
