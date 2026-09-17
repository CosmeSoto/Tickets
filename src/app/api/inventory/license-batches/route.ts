import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { createLicenseBatch, listLicenseBatches } from '@/lib/services/license-batches.service'
import {
  assertInventoryManageByFamily,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'
import { isValidInvoiceNumber, INVOICE_NUMBER_ERROR } from '@/lib/inventory/invoice-number'
import { emptyToUndef } from '@/lib/validations/inventory/license'

/**
 * GET /api/inventory/license-batches
 * Lista lotes de licencias — misma restricción de acceso y el mismo criterio
 * de scoping por familia que GET /api/inventory/batches (equipos).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const role = session.user.role
    const userId = session.user.id
    const invCtx = await getInventorySessionContext(session.user)
    const isSuperAdmin = invCtx.user.isSuperAdmin

    if (role !== 'ADMIN' && !invCtx.canManageInventory) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    let allowedFamilyIds: string[] | null = null

    if (role === 'ADMIN' && !isSuperAdmin) {
      const { getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
      const invFamilyIds = await getModuleFamilyIds(userId, 'inventory')
      allowedFamilyIds = invFamilyIds.length > 0 ? invFamilyIds : []
    } else if (role !== 'ADMIN' && invCtx.canManageInventory) {
      const { resolveModuleFamilyScopeIds } = await import('@/lib/auth/user-family-access')
      allowedFamilyIds = await resolveModuleFamilyScopeIds(userId, 'inventory', 'canOperate')
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const licenseTypeId = searchParams.get('licenseTypeId') || undefined
    const supplierId = searchParams.get('supplierId') || undefined

    const result = await listLicenseBatches({
      page,
      limit,
      licenseTypeId,
      supplierId,
      allowedFamilyIds: allowedFamilyIds ?? undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en GET /api/inventory/license-batches:', error)
    const message = error instanceof Error ? error.message : 'Error al listar lotes de licencias'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

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
  // LicenseAssetForm (mismo formulario en modo lote) envía estos tres como
  // `null` explícito cuando no aplican (contrato vinculado, hasRecurring,
  // sin frecuencia) — igual que createLicenseSchema, se normaliza con
  // emptyToUndef antes de validar en vez de solo .optional() (que rechaza null).
  renewalFrequency: z.preprocess(
    emptyToUndef,
    z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM']).optional()
  ),
  customFrequencyMonths: z.preprocess(emptyToUndef, z.number().int().min(1).optional()),
  acquisitionType: z.preprocess(
    emptyToUndef,
    z.enum(['SOFTWARE', 'SERVICE_EXTERNAL', 'MAINTENANCE', 'INSURANCE', 'SLA']).optional()
  ),
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
