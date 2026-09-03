/**
 * GET  /api/inventory/licenses/invoices/[invoiceId]/installments — lista abonos
 * POST /api/inventory/licenses/invoices/[invoiceId]/installments — registra un
 *      pago (completo o parcial) — ver LicenseInvoiceService.registerPayment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LicenseInvoiceService } from '@/lib/services/license-invoice.service'
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
  const invoice = await LicenseInvoiceService.getById(invoiceId)
  if (!invoice) throw new InventoryAccessError('Factura no encontrada', 404)
  const assert = mode === 'read' ? assertInventoryResourceRead : assertInventoryResourceManage
  await assert(toInventoryAccessUser(session.user), 'LICENSE', invoice.license.id)
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
      await resolveAccess(session as any, invoiceId, 'read')
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const installments = await LicenseInvoiceService.listInstallments(invoiceId)
    return NextResponse.json({ installments })
  } catch (error) {
    console.error('[GET /licenses/invoices/[id]/installments]', error)
    return NextResponse.json({ error: 'Error al obtener los abonos' }, { status: 500 })
  }
}

export async function POST(
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
    if (!body.paidDate) {
      return NextResponse.json({ error: 'Fecha de pago requerida' }, { status: 400 })
    }

    const invoice = await LicenseInvoiceService.registerPayment(
      invoiceId,
      {
        amount: body.amount !== undefined && body.amount !== null ? Number(body.amount) : undefined,
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
  } catch (error) {
    console.error('[POST /licenses/invoices/[id]/installments]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al registrar el pago' },
      { status: 500 }
    )
  }
}
