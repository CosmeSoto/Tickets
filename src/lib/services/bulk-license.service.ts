/**
 * Alta masiva de licencias — N licencias en una sola operación, cada una con su
 * propio tipo (plan) y colaborador asignado, compartiendo proveedor/factura/
 * orden de compra/fecha de compra. Ver bulk-license.ts para el porqué esto es
 * distinto del lote de equipos (que sí crea unidades idénticas).
 */
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { generateAssetCode } from '@/lib/inventory/asset-code-generator'
import { LicenseService } from '@/lib/services/license.service'
import { LicenseInvoiceService } from '@/lib/services/license-invoice.service'
import type { BulkLicenseInput } from '@/lib/validations/bulk-license'
import type { SoftwareLicense } from '@/types/inventory/license'

export interface BulkLicenseResult {
  created: SoftwareLicense[]
  count: number
}

export async function createBulkLicenses(
  input: BulkLicenseInput,
  userId: string
): Promise<BulkLicenseResult> {
  const { familyId, supplierId, invoiceNumber, purchaseOrderNumber, purchaseDate, rows } = input

  // Todos los tipos deben pertenecer a la familia elegida — evita mezclar el
  // catálogo de otra área por un id suelto.
  const typeIds = [...new Set(rows.map(r => r.licenseTypeId))]
  const validTypes = await prisma.license_types.findMany({
    where: { id: { in: typeIds }, familyId },
    select: { id: true },
  })
  const validTypeIds = new Set(validTypes.map(t => t.id))
  const invalidRow = rows.find(r => !validTypeIds.has(r.licenseTypeId))
  if (invalidRow) {
    throw new Error('Uno de los tipos de licencia no pertenece al área seleccionada')
  }

  // Marca compartida para poder identificar después qué licencias nacieron
  // juntas en este mismo lote (no hay tabla de "lote" para licencias, a
  // diferencia de equipment_batches — esto es la traza mínima equivalente).
  const batchRef = randomUUID()

  const created: SoftwareLicense[] = []

  // Secuencial, no en paralelo: generateAssetCode cuenta filas existentes para
  // calcular el siguiente número — en paralelo, varias llamadas verían el
  // mismo conteo y generarían el mismo código.
  for (const row of rows) {
    const code = await generateAssetCode(familyId, 'LICENSE', undefined)

    const license = await LicenseService.createLicense(
      {
        code,
        name: row.name,
        typeId: row.licenseTypeId,
        key: row.key || undefined,
        purchaseDate,
        cost: row.cost,
        supplierId: supplierId || undefined,
        invoiceNumber: invoiceNumber || undefined,
        purchaseOrderNumber: purchaseOrderNumber || undefined,
        assignedToUser: row.assignedToUser || undefined,
        notes: `Alta por lote — ref. ${batchRef.slice(0, 8)}`,
      },
      userId
    )

    // Mismo criterio que el alta individual: si hay costo y no hay contrato
    // vinculado (el lote no vincula contrato), se refleja como factura
    // PENDIENTE en el libro de pagos — evita que el usuario tenga que volver
    // a escribir el mismo monto 60 veces en "Registrar factura".
    if (row.cost != null && row.cost > 0) {
      await LicenseInvoiceService.create({
        licenseId: license.id,
        invoiceNumber: invoiceNumber || null,
        purchaseOrderNumber: purchaseOrderNumber || null,
        amount: row.cost,
        supplierId: supplierId || null,
        createdBy: userId,
      })
    }

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'CREATE',
        entityType: 'asset',
        entityId: license.id,
        userId,
        details: { subtype: 'LICENSE', familyId, bulkBatchRef: batchRef },
      },
    })

    created.push(license)
  }

  const { invalidateCache } = await import('@/lib/api-cache')
  await invalidateCache('inventory:licenses:*').catch(() => {})

  return { created, count: created.length }
}
