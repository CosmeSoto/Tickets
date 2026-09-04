/**
 * Alta masiva de licencias — N licencias en una sola operación, cada una con su
 * propio tipo (plan) y colaborador asignado, compartiendo proveedor/factura/
 * orden de compra/fecha de compra. Ver bulk-license.ts para el porqué esto es
 * distinto del lote de equipos (que sí crea unidades idénticas).
 *
 * Por qué esto NO corre en una sola transacción de Prisma (a diferencia del
 * lote de equipos, que sí es atómico vía createMany): acá cada fila puede
 * tener un tipo/costo/colaborador distinto, y el paso posterior a crear la
 * licencia (vincularla a un contrato o registrar su factura) ya abre su
 * propia transacción interna en los servicios que reutiliza
 * (LicenseInvoiceService.create, linkLicenseToBusinessContract) — anidar eso
 * dentro de una transacción exterior de hasta 200 filas arriesgaría
 * conexiones colgadas/timeouts sin una reescritura profunda de esos
 * servicios compartidos con otros flujos (alta individual, facturación).
 *
 * En su lugar, cada fila se procesa de forma independiente y se reporta el
 * resultado real fila por fila:
 *   - `created`  — licencias creadas con éxito (con o sin advertencia).
 *   - `failed`   — filas donde NO se creó nada (ej. dato inválido) — se
 *                  pueden corregir y reenviar sin riesgo de duplicar.
 *   - `warnings` — la licencia SÍ se creó, pero el paso posterior (vínculo a
 *                  contrato o factura) falló — no se debe reintentar la fila
 *                  entera (duplicaría la licencia); se revisa manualmente
 *                  desde la ficha de esa licencia.
 * Así, una fila con datos corruptos (ej. un id de colaborador vencido) ya no
 * aborta silenciosamente el resto del lote a mitad de camino.
 */
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { generateAssetCode } from '@/lib/inventory/asset-code-generator'
import { LicenseService } from '@/lib/services/license.service'
import { LicenseInvoiceService } from '@/lib/services/license-invoice.service'
import { linkLicenseToBusinessContract } from '@/lib/inventory/license-contract'
import type { BulkLicenseInput } from '@/lib/validations/bulk-license'
import type { SoftwareLicense } from '@/types/inventory/license'

export interface BulkLicenseRowIssue {
  /** Índice de la fila dentro del array `rows` enviado por el cliente. */
  index: number
  name: string
  error: string
}

export interface BulkLicenseResult {
  created: SoftwareLicense[]
  /** Filas donde no se creó nada — se pueden corregir y reenviar. */
  failed: BulkLicenseRowIssue[]
  /** Licencias creadas cuyo vínculo a contrato/factura falló — revisar manualmente, NO reenviar. */
  warnings: BulkLicenseRowIssue[]
  count: number
}

export async function createBulkLicenses(
  input: BulkLicenseInput,
  userId: string
): Promise<BulkLicenseResult> {
  const { familyId, supplierId, invoiceNumber, purchaseOrderNumber, purchaseDate, rows } = input
  const contractId = input.contractId || undefined

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

  // Igual que con los tipos: valida de antemano que los colaboradores asignados
  // existan. Sin esto, un id vencido/stale (usuario borrado, dato viejo en el
  // draft del navegador) recién se descubre a mitad del lote, como un error
  // crudo de FK de Prisma — y como el lote no corre en una sola transacción,
  // las licencias creadas antes de esa fila quedarían igual, dejando el lote
  // a medias.
  const assignedUserIds = [
    ...new Set(rows.map(r => r.assignedToUser).filter((v): v is string => !!v)),
  ]
  if (assignedUserIds.length > 0) {
    const validUsers = await prisma.users.findMany({
      where: { id: { in: assignedUserIds } },
      select: { id: true },
    })
    const validUserIds = new Set(validUsers.map(u => u.id))
    const invalidUserRow = rows.find(r => r.assignedToUser && !validUserIds.has(r.assignedToUser))
    if (invalidUserRow) {
      throw new Error('Uno de los colaboradores asignados ya no existe — vuelve a seleccionarlo')
    }
  }

  // Falla antes de crear nada si el contrato elegido no existe — evita crear
  // 60 licencias y recién ahí descubrir que el vínculo es inválido.
  if (contractId) {
    const contractExists = await prisma.contracts.findUnique({
      where: { id: contractId },
      select: { id: true },
    })
    if (!contractExists) {
      throw new Error('El contrato seleccionado para el lote no existe')
    }
  }

  // Marca compartida para poder identificar después qué licencias nacieron
  // juntas en este mismo lote (no hay tabla de "lote" para licencias, a
  // diferencia de equipment_batches — esto es la traza mínima equivalente).
  const batchRef = randomUUID()

  const created: SoftwareLicense[] = []
  const failed: BulkLicenseRowIssue[] = []
  const warnings: BulkLicenseRowIssue[] = []

  // Secuencial, no en paralelo: generateAssetCode cuenta filas existentes para
  // calcular el siguiente número — en paralelo, varias llamadas verían el
  // mismo conteo y generarían el mismo código.
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowLabel = row.name?.trim() || `Fila ${i + 1}`

    let license: SoftwareLicense
    try {
      const code = await generateAssetCode(familyId, 'LICENSE', undefined)
      license = await LicenseService.createLicense(
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
      created.push(license)
    } catch (err) {
      // No se creó nada para esta fila — es seguro corregirla y reenviarla,
      // no va a duplicar ninguna de las que sí se crearon.
      failed.push({
        index: i,
        name: rowLabel,
        error: err instanceof Error ? err.message : 'No se pudo crear la licencia',
      })
      continue
    }

    // A partir de acá la licencia YA EXISTE — cualquier falla en lo que sigue
    // es una advertencia (revisar manualmente esa licencia puntual), nunca un
    // motivo para reintentar la fila completa.
    try {
      if (contractId) {
        // Lote vinculado a un contrato (ej. la orden de compra recurrente): cada
        // licencia se cuelga como línea del contrato y su costo se suma al total
        // recurrente — no genera factura individual, el pago queda representado
        // una sola vez en el calendario de cuotas del contrato.
        await linkLicenseToBusinessContract(license.id, contractId, license.name, row.cost ?? null)
      } else if (row.cost != null && row.cost > 0) {
        // Mismo criterio que el alta individual sin contrato: si hay costo, se
        // refleja como factura PENDIENTE en el libro de pagos — evita que el
        // usuario tenga que volver a escribir el mismo monto 60 veces en
        // "Registrar factura".
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
          details: { subtype: 'LICENSE', familyId, bulkBatchRef: batchRef, contractId },
        },
      })
    } catch (err) {
      warnings.push({
        index: i,
        name: `${rowLabel} (código ${license.code})`,
        error: `Se creó la licencia, pero falló su vínculo a contrato/factura: ${
          err instanceof Error ? err.message : 'error desconocido'
        }. Revísala manualmente desde su ficha.`,
      })
    }
  }

  const { invalidateCache } = await import('@/lib/api-cache')
  await invalidateCache('inventory:licenses:*').catch(() => {})

  return { created, failed, warnings, count: created.length }
}
