/**
 * Lotes de licencias — N licencias idénticas generadas a partir de UNA compra
 * (ej. "34 Microsoft 365 Business Premium"), calcado de equipment-batches.service.ts
 * pero sin los campos de hardware (condición, depreciación, seriales) que no
 * aplican a una licencia. Ver el plan: el lote no es una pantalla aparte —
 * se crea desde el mismo formulario de licencia (campo "Cantidad").
 */
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { generateAssetCode } from '@/lib/inventory/asset-code-generator'
import { applyLicenseRenewalUpdate } from '@/lib/inventory/license-renewal'
import { linkLicenseToBusinessContract } from '@/lib/inventory/license-contract'
import { notifyFamilyScopedAdminsExcept } from '@/lib/api/notify'

export interface CreateLicenseBatchInput {
  familyId: string
  licenseTypeId: string
  /** Nombre visible de cada licencia generada (ej. "Microsoft 365 Business Premium") */
  name: string
  quantity: number
  supplierId?: string | null
  purchaseDate?: Date
  unitCost: number
  invoiceNumber?: string | null
  purchaseOrderNumber?: string | null
  departmentId?: string | null
  /** Vencimiento de cada licencia generada — sin esto, CheckLicenseExpirationJob
   * nunca las alcanza (usa expirationDate, no renewalDate). Para una licencia
   * sin contrato, vencimiento y próxima renovación son la misma fecha. */
  expirationDate?: Date | null
  renewalDate?: Date | null
  renewalCost?: number | null
  renewalFrequency?: string | null
  customFrequencyMonths?: number | null
  acquisitionType?: string | null
  notes?: string | null
  /** Si viene, cada licencia generada se vincula a este contrato (una línea
   * por licencia, vía linkLicenseToBusinessContract — mismo camino que una
   * licencia individual, sin duplicar la lógica de vínculo). */
  contractId?: string | null
  receivedBy: string
}

export interface LicenseBatchCreateResult {
  batch: { id: string; batchCode: string; quantity: number; totalCost: number }
  licenses: Array<{ id: string; code: string; name: string }>
  summary: { firstCode: string; lastCode: string; message: string }
}

async function generateBatchCode(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `LOTE-LIC-${year}`

  const lastBatch = await prisma.license_batches.findFirst({
    where: { batchCode: { startsWith: prefix } },
    orderBy: { batchCode: 'desc' },
  })

  let nextNumber = 1
  if (lastBatch) {
    const match = lastBatch.batchCode.match(/-(\d+)$/)
    if (match) nextNumber = parseInt(match[1], 10) + 1
  }

  return `${prefix}-${nextNumber.toString().padStart(4, '0')}`
}

export async function createLicenseBatch(
  input: CreateLicenseBatchInput
): Promise<LicenseBatchCreateResult> {
  if (input.quantity < 2) {
    throw new Error(
      'Un lote requiere cantidad mayor a 1 — para una sola licencia usa el alta normal'
    )
  }

  const licenseType = await prisma.license_types.findFirst({
    where: { id: input.licenseTypeId, familyId: input.familyId },
    select: { id: true },
  })
  if (!licenseType) {
    throw new Error('El tipo de licencia no pertenece al área seleccionada')
  }

  if (input.supplierId) {
    const supplierExists = await prisma.suppliers.findUnique({
      where: { id: input.supplierId },
      select: { id: true },
    })
    if (!supplierExists) throw new Error('Proveedor no encontrado')
  }

  // Falla antes de crear nada si el contrato elegido no existe — mismo
  // criterio que bulk-license.service.ts (evita crear N licencias y recién
  // ahí descubrir que el vínculo es inválido).
  if (input.contractId) {
    const contractExists = await prisma.contracts.findUnique({
      where: { id: input.contractId },
      select: { id: true },
    })
    if (!contractExists) throw new Error('El contrato seleccionado para el lote no existe')
  }

  const purchaseDate = input.purchaseDate ?? new Date()
  const totalCost = input.unitCost * input.quantity
  const batchCode = await generateBatchCode()
  const resolvedExpirationDate = input.expirationDate ?? input.renewalDate ?? null

  // Secuencial (no en paralelo): generateAssetCode ya es seguro ante carreras
  // (contador atómico), pero igual se genera de a uno porque cada llamada
  // depende de leer/incrementar el mismo contador de familia+subtipo+año.
  const codes: string[] = []
  for (let i = 0; i < input.quantity; i++) {
    codes.push(await generateAssetCode(input.familyId, 'LICENSE', undefined))
  }

  const result = await prisma.$transaction(async tx => {
    const batch = await tx.license_batches.create({
      data: {
        batchCode,
        licenseTypeId: input.licenseTypeId,
        quantity: input.quantity,
        supplierId: input.supplierId || null,
        purchaseDate,
        unitCost: input.unitCost,
        totalCost,
        invoiceNumber: input.invoiceNumber || null,
        purchaseOrderNumber: input.purchaseOrderNumber || null,
        departmentId: input.departmentId || null,
        renewalDate: input.renewalDate || null,
        renewalCost: input.renewalCost ?? null,
        renewalFrequency: (input.renewalFrequency || null) as never,
        customFrequencyMonths:
          input.renewalFrequency === 'CUSTOM' ? (input.customFrequencyMonths ?? null) : null,
        receivedBy: input.receivedBy,
        notes: input.notes || null,
      },
    })

    await tx.software_licenses.createMany({
      data: codes.map(code => ({
        code,
        name: input.name,
        typeId: input.licenseTypeId,
        licenseScope: 'COMPANY' as const,
        cost: input.unitCost,
        purchaseDate,
        expirationDate: resolvedExpirationDate,
        supplierId: input.supplierId || null,
        invoiceNumber: input.invoiceNumber || null,
        purchaseOrderNumber: input.purchaseOrderNumber || null,
        renewalDate: resolvedExpirationDate,
        renewalCost: input.renewalCost ?? null,
        renewalFrequency: (input.renewalFrequency || null) as never,
        customFrequencyMonths:
          input.renewalFrequency === 'CUSTOM' ? (input.customFrequencyMonths ?? null) : null,
        acquisitionType: (input.acquisitionType || null) as never,
        notes: input.notes || null,
        batchId: batch.id,
        batchRenewalLinked: true,
      })),
    })

    const createdLicenses = await tx.software_licenses.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    })

    return { batch, licenses: createdLicenses }
  })

  // Vincular cada licencia al contrato — fuera de la transacción, igual que
  // el vínculo equipo↔contrato en equipment-batches.service.ts. Reusa
  // linkLicenseToBusinessContract (Fase 1): cada licencia queda como su
  // propia línea del contrato, con acquisitionType sincronizado y sus campos
  // de renovación standalone limpios — sin reescribir esa lógica acá.
  if (input.contractId) {
    for (const license of result.licenses) {
      await linkLicenseToBusinessContract(
        license.id,
        input.contractId,
        license.name,
        undefined,
        input.receivedBy
      )
    }
  }

  // Compra en volumen — mismo criterio que la notificación de creación de
  // lote de equipos (equipment-batches.service.ts): evento financiero, no
  // solo un registro en audit_logs.
  await notifyFamilyScopedAdminsExcept(
    input.familyId,
    input.receivedBy,
    'INVENTORY',
    `Nuevo lote de licencias: ${batchCode}`,
    `Se registró el lote ${batchCode} con ${result.licenses.length} licencia(s) de "${input.name}" por $${totalCost.toFixed(2)}.`,
    { metadata: { link: `/inventory/batches/license/${result.batch.id}` } }
  ).catch(() => {})

  return {
    batch: {
      id: result.batch.id,
      batchCode: result.batch.batchCode,
      quantity: result.batch.quantity,
      totalCost: result.batch.totalCost,
    },
    licenses: result.licenses,
    summary: {
      firstCode: codes[0],
      lastCode: codes[codes.length - 1],
      message: input.contractId
        ? `Se creó el lote ${batchCode} con ${result.licenses.length} licencias, vinculadas al contrato: ${codes[0]} a ${codes[codes.length - 1]}`
        : `Se creó el lote ${batchCode} con ${result.licenses.length} licencias sin asignar: ${codes[0]} a ${codes[codes.length - 1]}`,
    },
  }
}

export async function getLicenseBatchById(id: string) {
  const batch = await prisma.license_batches.findUnique({
    where: { id },
    include: {
      licenseType: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  })
  if (!batch) return null

  const licenses = await prisma.software_licenses.findMany({
    where: { batchId: id },
    select: {
      id: true,
      code: true,
      name: true,
      assignedToUser: true,
      assignedToDepartment: true,
      assignedToEquipment: true,
      batchRenewalLinked: true,
      contractLines: { select: { id: true }, take: 1 },
    },
    orderBy: { code: 'asc' },
  })

  const assigned = licenses.filter(
    l => l.assignedToUser || l.assignedToDepartment || l.assignedToEquipment
  ).length
  // Si al menos una licencia del lote tiene contrato, la renovación real la
  // gestiona el contrato — "Renovar lote completo" deja de tener sentido
  // (mismo criterio que una licencia individual con contrato, Fase 1).
  const hasContractLink = licenses.some(l => l.contractLines.length > 0)

  return {
    batch,
    licenses: licenses.map(({ contractLines: _contractLines, ...l }) => l),
    metrics: { total: licenses.length, assigned, available: licenses.length - assigned },
    hasContractLink,
  }
}

export interface RenewLicenseBatchInput {
  renewalDate?: Date | null
  renewalCost?: number | null
  renewalFrequency?: string | null
  customFrequencyMonths?: number | null
}

/**
 * Renueva el lote completo: actualiza license_batches y propaga a cada
 * licencia hija cuyo batchRenewalLinked siga en true (una licencia que se
 * editó directamente se "desengancha" — ver applyLicenseRenewalUpdate).
 */
export async function renewLicenseBatch(
  batchId: string,
  input: RenewLicenseBatchInput,
  changedById: string
): Promise<{ updatedCount: number }> {
  const batch = await prisma.license_batches.findUnique({
    where: { id: batchId },
    include: { licenseType: { select: { familyId: true } } },
  })
  if (!batch) throw new Error('Lote no encontrado')

  await prisma.license_batches.update({
    where: { id: batchId },
    data: {
      ...(input.renewalDate !== undefined ? { renewalDate: input.renewalDate } : {}),
      ...(input.renewalCost !== undefined ? { renewalCost: input.renewalCost } : {}),
      ...(input.renewalFrequency !== undefined
        ? { renewalFrequency: (input.renewalFrequency || null) as never }
        : {}),
      ...(input.customFrequencyMonths !== undefined
        ? {
            customFrequencyMonths:
              input.renewalFrequency === 'CUSTOM' ? (input.customFrequencyMonths ?? null) : null,
          }
        : {}),
    },
  })

  const linkedLicenses = await prisma.software_licenses.findMany({
    // Licencias con contrato propio quedan afuera — su renovación real la
    // gestiona el contrato (mismo criterio que Fase 1), no la cascada del lote.
    where: { batchId, batchRenewalLinked: true, contractLines: { none: {} } },
    select: { id: true },
  })

  for (const license of linkedLicenses) {
    await applyLicenseRenewalUpdate(
      license.id,
      {
        // Vencimiento y próxima renovación son la misma fecha (ver
        // LicenseAssetForm) — se actualizan juntas para no volver a desalinearlas.
        expirationDate: input.renewalDate,
        renewalDate: input.renewalDate,
        renewalCost: input.renewalCost,
        renewalFrequency: input.renewalFrequency,
        customFrequencyMonths: input.customFrequencyMonths,
      },
      changedById,
      'batch-cascade'
    )
  }

  // Renovación en volumen (costo × N licencias) — evento financiero que antes
  // solo quedaba en audit_logs de cada licencia hija, sin aviso a la familia.
  await notifyFamilyScopedAdminsExcept(
    batch.licenseType?.familyId ?? null,
    changedById,
    'INVENTORY',
    `Lote de licencias renovado: ${batch.batchCode}`,
    `Se renovó el lote ${batch.batchCode} (${linkedLicenses.length} licencia(s))${input.renewalCost != null ? ` por $${input.renewalCost} cada una` : ''}.`,
    { metadata: { link: `/inventory/batches/license/${batchId}` } }
  ).catch(() => {})

  return { updatedCount: linkedLicenses.length }
}

/**
 * Lista lotes de licencias con paginación — contraparte de listBatches()
 * (equipment-batches.service.ts) para la pestaña "Lotes". Sin estados de
 * equipo (MAINTENANCE/RETIRED): una licencia solo está asignada o disponible.
 */
export async function listLicenseBatches(params: {
  page?: number
  limit?: number
  licenseTypeId?: string
  supplierId?: string
  /** Si se pasa, filtra solo lotes cuyo tipo de licencia pertenece a esas familias */
  allowedFamilyIds?: string[]
}) {
  const { page = 1, limit = 50, licenseTypeId, supplierId, allowedFamilyIds } = params

  const where: Prisma.license_batchesWhereInput = {
    ...(licenseTypeId && { licenseTypeId }),
    ...(supplierId && { supplierId }),
    ...(allowedFamilyIds &&
      allowedFamilyIds.length > 0 && {
        licenseType: { familyId: { in: allowedFamilyIds } },
      }),
  }

  const [batches, total] = await Promise.all([
    prisma.license_batches.findMany({
      where,
      include: {
        licenseType: { select: { id: true, name: true, familyId: true } },
        supplier: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { purchaseDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.license_batches.count({ where }),
  ])

  if (batches.length === 0) {
    return { batches: [], pagination: { page, limit, total: 0, totalPages: 0 } }
  }

  // Métricas + estado de contrato en una sola query (sin N+1 por lote).
  const batchIds = batches.map(b => b.id)
  const licenses = await prisma.software_licenses.findMany({
    where: { batchId: { in: batchIds } },
    select: {
      batchId: true,
      assignedToUser: true,
      assignedToDepartment: true,
      assignedToEquipment: true,
      contractLines: { select: { id: true }, take: 1 },
    },
  })

  const metricsMap = new Map<
    string,
    { total: number; assigned: number; available: number; hasContractLink: boolean }
  >()
  for (const license of licenses) {
    if (!license.batchId) continue
    if (!metricsMap.has(license.batchId)) {
      metricsMap.set(license.batchId, {
        total: 0,
        assigned: 0,
        available: 0,
        hasContractLink: false,
      })
    }
    const m = metricsMap.get(license.batchId)!
    m.total += 1
    if (license.assignedToUser || license.assignedToDepartment || license.assignedToEquipment) {
      m.assigned += 1
    } else {
      m.available += 1
    }
    if (license.contractLines.length > 0) m.hasContractLink = true
  }

  const batchesWithMetrics = batches.map(batch => {
    const m = metricsMap.get(batch.id) ?? {
      total: 0,
      assigned: 0,
      available: 0,
      hasContractLink: false,
    }
    return {
      ...batch,
      metrics: {
        total: m.total,
        assigned: m.assigned,
        available: m.available,
        utilizationRate: m.total > 0 ? (m.assigned / m.total) * 100 : 0,
      },
      hasContractLink: m.hasContractLink,
    }
  })

  return {
    batches: batchesWithMetrics,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}
