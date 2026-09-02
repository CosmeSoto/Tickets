/**
 * DELETE /api/inventory/equipment/invoices/installments/[installmentId] —
 * deshace un abono (los abonos son inmutables: corregir = eliminar + volver
 * a registrar, no editar).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentInvoiceService } from '@/lib/services/equipment-invoice.service'
import {
  assertInventoryResourceManage,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

async function resolveManageAccess(
  session: { user: { id: string; role: string; isSuperAdmin?: boolean } },
  installmentId: string
) {
  const installment = await EquipmentInvoiceService.getInstallmentById(installmentId)
  if (!installment) throw new InventoryAccessError('Abono no encontrado', 404)
  const invoice = await EquipmentInvoiceService.getById(installment.invoiceId)
  if (!invoice) throw new InventoryAccessError('Factura no encontrada', 404)
  await assertInventoryResourceManage(
    toInventoryAccessUser(session.user),
    'EQUIPMENT',
    invoice.equipment.id
  )
  return installment
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ installmentId: string }> }
) {
  try {
    const { installmentId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await resolveManageAccess(session as any, installmentId)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const result = await EquipmentInvoiceService.deleteInstallment(installmentId, session.user.id)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[DELETE /equipment/invoices/installments/[id]]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar el abono' },
      { status: 500 }
    )
  }
}
