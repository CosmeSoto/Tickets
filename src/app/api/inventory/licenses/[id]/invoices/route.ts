/**
 * GET  /api/inventory/licenses/[id]/invoices — lista facturas de la licencia
 * POST /api/inventory/licenses/[id]/invoices — crea una factura
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'LICENSE', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const invoices = await LicenseInvoiceService.listByLicense(id)
    return NextResponse.json({ invoices })
  } catch (error) {
    console.error('[GET /licenses/invoices]', error)
    return NextResponse.json({ error: 'Error al obtener facturas' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await assertInventoryResourceManage(toInventoryAccessUser(session.user), 'LICENSE', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const body = await req.json()
    const {
      invoiceNumber,
      purchaseOrderNumber,
      amount,
      currency,
      dueDate,
      paidDate,
      paymentMethod,
      supplierId,
      supplierName,
      referenceNumber,
      bankEntity,
      cardLast4,
      cardBrand,
      transactionId,
      notes,
      installments,
    } = body

    // Plan de cuotas: si el body trae `installments` (≥ 2 filas), se crean N
    // facturas "hermanas" en vez de una sola — ver createSchedule.
    if (Array.isArray(installments) && installments.length >= 2) {
      for (const cuota of installments) {
        if (!cuota?.amount || Number(cuota.amount) <= 0 || !cuota?.dueDate) {
          return NextResponse.json(
            { error: 'Cada cuota necesita un monto mayor a 0 y una fecha de vencimiento' },
            { status: 400 }
          )
        }
      }

      const invoices = await LicenseInvoiceService.createSchedule({
        licenseId: id,
        invoiceNumber: invoiceNumber || null,
        purchaseOrderNumber: purchaseOrderNumber || null,
        currency: currency || 'USD',
        supplierId: supplierId || null,
        supplierName: supplierName || null,
        notes: notes || null,
        installments: installments.map((cuota: { amount: number; dueDate: string }) => ({
          amount: Number(cuota.amount),
          dueDate: new Date(cuota.dueDate),
        })),
        createdBy: session.user.id,
      })

      return NextResponse.json({ invoices }, { status: 201 })
    }

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
    }

    const invoice = await LicenseInvoiceService.create({
      licenseId: id,
      invoiceNumber: invoiceNumber || null,
      purchaseOrderNumber: purchaseOrderNumber || null,
      amount: Number(amount),
      currency: currency || 'USD',
      dueDate: dueDate ? new Date(dueDate) : null,
      paidDate: paidDate ? new Date(paidDate) : null,
      paymentMethod: paymentMethod || null,
      supplierId: supplierId || null,
      supplierName: supplierName || null,
      referenceNumber: referenceNumber || null,
      bankEntity: bankEntity || null,
      cardLast4: cardLast4 || null,
      cardBrand: cardBrand || null,
      transactionId: transactionId || null,
      notes: notes || null,
      createdBy: session.user.id,
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('[POST /licenses/invoices]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear factura' },
      { status: 500 }
    )
  }
}
