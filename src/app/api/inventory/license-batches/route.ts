import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { createLicenseBatch } from '@/lib/services/license-batches.service'
import {
  assertInventoryManageByFamily,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import { isValidInvoiceNumber, INVOICE_NUMBER_ERROR } from '@/lib/inventory/invoice-number'

const createLicenseBatchSchema = z.object({
  familyId: z.string().min(1),
  licenseTypeId: z.string().min(1),
  name: z.string().min(2).max(200),
  quantity: z.number().int().min(2).max(500),
  supplierId: z.string().min(1).optional().or(z.literal('')),
  purchaseDate: z
    .union([z.string(), z.date()])
    .optional()
    .transform(val => (val ? new Date(val) : undefined)),
  unitCost: z.number().min(0),
  invoiceNumber: z.string().max(100).optional().or(z.literal('')),
  purchaseOrderNumber: z.string().max(100).optional().or(z.literal('')),
  departmentId: z.string().min(1).optional().or(z.literal('')),
  expirationDate: z
    .union([z.string(), z.date()])
    .optional()
    .transform(val => (val ? new Date(val) : undefined)),
  renewalDate: z
    .union([z.string(), z.date()])
    .optional()
    .transform(val => (val ? new Date(val) : undefined)),
  renewalCost: z.number().min(0).optional(),
  renewalFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM']).optional(),
  customFrequencyMonths: z.number().int().min(1).optional(),
  acquisitionType: z
    .enum(['SOFTWARE', 'SERVICE_EXTERNAL', 'MAINTENANCE', 'INSURANCE', 'SLA'])
    .optional(),
  notes: z.string().max(2000).optional(),
  /** Si viene, cada licencia generada se vincula a este contrato (una línea
   * por licencia) — ver createLicenseBatch. */
  contractId: z.string().min(1).optional().or(z.literal('')),
})

/**
 * POST /api/inventory/license-batches
 * Crea un lote de N licencias idénticas — llamado desde el mismo formulario
 * de "Nueva licencia" cuando el usuario pone Cantidad > 1.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()

    try {
      await assertInventoryManageByFamily(toInventoryAccessUser(session.user), body.familyId)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    if (
      !isValidInvoiceNumber(body.invoiceNumber) ||
      !isValidInvoiceNumber(body.purchaseOrderNumber)
    ) {
      return NextResponse.json({ error: INVOICE_NUMBER_ERROR }, { status: 400 })
    }

    const input = createLicenseBatchSchema.parse(body)

    const result = await createLicenseBatch({
      ...input,
      supplierId: input.supplierId || null,
      invoiceNumber: input.invoiceNumber || null,
      purchaseOrderNumber: input.purchaseOrderNumber || null,
      departmentId: input.departmentId || null,
      expirationDate: input.expirationDate ?? null,
      renewalDate: input.renewalDate ?? null,
      renewalCost: input.renewalCost ?? null,
      renewalFrequency: input.renewalFrequency ?? null,
      customFrequencyMonths: input.customFrequencyMonths ?? null,
      acquisitionType: input.acquisitionType ?? null,
      notes: input.notes ?? null,
      contractId: input.contractId || null,
      receivedBy: session.user.id,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/inventory/license-batches:', error)
    if (error instanceof z.ZodError) {
      const first = error.errors[0]
      return NextResponse.json(
        { error: first?.message || 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : 'Error al crear el lote de licencias'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
