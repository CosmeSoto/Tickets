/**
 * GET    /api/inventory/equipment/invoices/[invoiceId] — obtiene una factura
 * PATCH  /api/inventory/equipment/invoices/[invoiceId] — actualiza
 * DELETE /api/inventory/equipment/invoices/[invoiceId] — elimina
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentInvoiceService } from '@/lib/services/equipment-invoice.service'
import {
  assertInventoryResourceRead,
  assertInventoryResourceManage,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

async function resolveAccess(
  session: { user: { id: string; role: string; isSuperAdmin?: boolean } },
  invoiceId: string,
  mode: 'read' | 'write'
) {
  const invoice = await EquipmentInvoiceService.getById(invoiceId)
  if (!invoice) throw new InventoryAccessError('Factura no encontrada', 404)
  if (mode === 'read') {
    await assertInventoryResourceRead(
      toInventoryAccessUser(session.user),
      'EQUIPMENT',
      invoice.equipment.id
    )
  } else {
    await assertInventoryResourceManage(
      toInventoryAccessUser(session.user),
      'EQUIPMENT',
      invoice.equipment.id
    )
  }
  return invoice
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      const invoice = await resolveAccess(session as any, invoiceId, 'read')
      return NextResponse.json(invoice)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }
  } catch (error) {
    console.error('[GET /equipment/invoices/[id]]', error)
    return NextResponse.json({ error: 'Error al obtener factura' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await resolveAccess(session as any, invoiceId, 'write')
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const body = await req.json()

    // Si viene markAsPaid, delegar al método específico
    if (body.action === 'markAsPaid') {
      if (!body.paidDate)
        return NextResponse.json({ error: 'Fecha de pago requerida' }, { status: 400 })

      const invoice = await EquipmentInvoiceService.markAsPaid(
        invoiceId,
        {
          paidDate: new Date(body.paidDate),
          paymentMethod: body.paymentMethod || null,
          referenceNumber: body.referenceNumber || null,
          bankEntity: body.bankEntity || null,
          cardLast4: body.cardLast4 || null,
          cardBrand: body.cardBrand || null,
          transactionId: body.transactionId || null,
          notes: body.notes || null,
        },
        session.user.id
      )
      return NextResponse.json(invoice)
    }

    // Actualización general
    const {
      invoiceNumber,
      purchaseOrderNumber,
      amount,
      currency,
      dueDate,
      paidDate,
      status,
      paymentMethod,
      supplierId,
      supplierName,
      referenceNumber,
      bankEntity,
      cardLast4,
      cardBrand,
      transactionId,
      notes,
    } = body

    const invoice = await EquipmentInvoiceService.update(
      invoiceId,
      {
        invoiceNumber,
        purchaseOrderNumber,
        amount: amount !== undefined ? Number(amount) : undefined,
        currency,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        paidDate: paidDate !== undefined ? (paidDate ? new Date(paidDate) : null) : undefined,
        status,
        paymentMethod,
        supplierId,
        supplierName,
        referenceNumber,
        bankEntity,
        cardLast4,
        cardBrand,
        transactionId,
        notes,
      },
      session.user.id
    )

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('[PATCH /equipment/invoices/[id]]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar factura' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await resolveAccess(session as any, invoiceId, 'write')
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    await EquipmentInvoiceService.delete(invoiceId, session.user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /equipment/invoices/[id]]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar factura' },
      { status: 500 }
    )
  }
}
