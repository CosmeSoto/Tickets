/**
 * POST /api/inventory/licenses/invoices/[invoiceId]/convert-to-schedule —
 * convierte una factura de pago único (sin abonos) en un plan de cuotas —
 * ver LicenseInvoiceService.convertToSchedule.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LicenseInvoiceService } from '@/lib/services/license-invoice.service'
import {
  assertInventoryResourceManage,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      const invoice = await LicenseInvoiceService.getById(invoiceId)
      if (!invoice) throw new InventoryAccessError('Factura no encontrada', 404)
      await assertInventoryResourceManage(
        toInventoryAccessUser(session.user as any),
        'LICENSE',
        invoice.license.id
      )
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const body = await req.json()
    const installments = Array.isArray(body.installments) ? body.installments : []

    const invoices = await LicenseInvoiceService.convertToSchedule(
      invoiceId,
      {
        installments: installments.map((c: { amount: number; dueDate: string }) => ({
          amount: Number(c.amount),
          dueDate: new Date(c.dueDate),
        })),
      },
      session.user.id
    )
    return NextResponse.json({ invoices })
  } catch (error) {
    console.error('[POST /licenses/invoices/[id]/convert-to-schedule]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al convertir la factura' },
      { status: 500 }
    )
  }
}
