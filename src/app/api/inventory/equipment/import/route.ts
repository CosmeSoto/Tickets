import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parseImportFile } from '@/lib/utils/parse-import-file'
import { invalidateCache } from '@/lib/api-cache'
import {
  assertInventoryManageByFamily,
  InventoryAccessError,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import {
  executeEquipmentImport,
  loadImportDependencies,
  validateAndParseImportRows,
  toPreviewRows,
  enrichImportError,
  VALID_ACQUISITION_MODES,
  IMPORT_MODES,
  type ImportCatalogContext,
  type ImportMode,
} from '@/lib/inventory/equipment-import'

function parseContext(formData: FormData): ImportCatalogContext | { error: string } {
  const familyId = String(formData.get('familyId') ?? '').trim()
  const typeId = String(formData.get('typeId') ?? '').trim()
  const brandId = String(formData.get('brandId') ?? '').trim()
  const modelId = String(formData.get('modelId') ?? '').trim()
  const acquisitionMode = String(formData.get('acquisitionMode') ?? 'FIXED_ASSET').trim()

  if (!familyId || !typeId || !brandId || !modelId) {
    return { error: 'familyId, typeId, brandId y modelId son obligatorios' }
  }

  if (
    !VALID_ACQUISITION_MODES.includes(acquisitionMode as ImportCatalogContext['acquisitionMode'])
  ) {
    return { error: 'acquisitionMode inválido' }
  }

  return {
    familyId,
    typeId,
    brandId,
    modelId,
    acquisitionMode: acquisitionMode as ImportCatalogContext['acquisitionMode'],
  }
}

function parseMode(formData: FormData): ImportMode | { error: string } {
  const mode = (String(formData.get('mode') ?? 'add').trim() || 'add') as ImportMode
  if (!IMPORT_MODES.includes(mode)) {
    return { error: 'mode inválido. Use: add o update' }
  }
  return mode
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const contextResult = parseContext(formData)
    if ('error' in contextResult) {
      return NextResponse.json({ error: contextResult.error }, { status: 400 })
    }

    const modeResult = parseMode(formData)
    if ('error' in modeResult) {
      return NextResponse.json({ error: modeResult.error }, { status: 400 })
    }

    const user = toInventoryAccessUser(
      session.user as { id: string; role: string; isSuperAdmin?: boolean }
    )
    await assertInventoryManageByFamily(user, contextResult.familyId)

    const file = formData.get('file') as File | null
    const dryRun = formData.get('dryRun') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    let maxFileSizeMB = 10
    try {
      const { getSetting } = await import('@/lib/api-cache')
      const val = await getSetting('maxFileSize', 600, '10')
      maxFileSizeMB = parseInt(val ?? '10') || 10
    } catch {
      /* default */
    }

    if (file.size > maxFileSizeMB * 1024 * 1024) {
      return NextResponse.json(
        { error: `El archivo supera el límite de ${maxFileSizeMB} MB` },
        { status: 400 }
      )
    }

    let rows: string[][]
    try {
      rows = await parseImportFile(file)
    } catch {
      return NextResponse.json(
        { error: 'No se pudo leer el archivo. Verifica que sea CSV o Excel válido.' },
        { status: 400 }
      )
    }

    const deps = await loadImportDependencies(contextResult)
    const { errors, parsed, skipped, total } = validateAndParseImportRows({
      rows,
      context: contextResult,
      mode: modeResult,
      attributes: deps.attributes,
      warehouses: deps.warehouses,
      existingBySerial: deps.existingBySerial,
    })

    const warehouseNames = deps.warehouses.map(w => (w.code ? `${w.name} (${w.code})` : w.name))
    const enrichedErrors = errors.map(err =>
      enrichImportError(err, {
        warehouseNames,
        attributeLabel: deps.attributes.find(a => a.attributeName === err.field)?.attributeLabel,
        allowedOptions: (() => {
          const attr = deps.attributes.find(a => a.attributeName === err.field)
          return Array.isArray(attr?.options) ? (attr.options as string[]) : undefined
        })(),
      })
    )

    const preview = toPreviewRows(parsed, skipped, deps.warehouses, {
      serialNumber: 0,
      condition: 1,
      warehouse: 2,
      physicalLocation: -1,
      purchaseDate: -1,
      purchasePrice: -1,
      invoiceNumber: -1,
      accessories: -1,
      notes: -1,
      attributes: {},
    })

    if (enrichedErrors.length > 0) {
      return NextResponse.json({
        valid: false,
        mode: modeResult,
        total,
        created: 0,
        updated: 0,
        skipped: skipped.length,
        errors: enrichedErrors,
        preview,
        skippedRows: skipped,
      })
    }

    if (parsed.length === 0 && skipped.length === 0) {
      return NextResponse.json(
        {
          valid: false,
          mode: modeResult,
          total,
          created: 0,
          updated: 0,
          skipped: 0,
          errors: [{ row: 0, field: 'file', message: 'No hay filas válidas para importar' }],
          preview: [],
        },
        { status: 400 }
      )
    }

    if (dryRun) {
      return NextResponse.json({
        valid: true,
        mode: modeResult,
        total,
        created: parsed.filter(r => r.action === 'create').length,
        updated: parsed.filter(r => r.action === 'update').length,
        skipped: skipped.length,
        errors: [],
        preview,
        skippedRows: skipped,
      })
    }

    const result = await executeEquipmentImport({
      context: contextResult,
      rows: parsed,
      userId: session.user.id,
      mode: modeResult,
      skippedCount: skipped.length,
    })

    await invalidateCache(['inventory:equipment:*']).catch(() => {})

    return NextResponse.json({ ...result, mode: modeResult, preview, skippedRows: skipped })
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[IMPORT EQUIPMENT]', error)
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: `Error al procesar el archivo: ${msg}` }, { status: 500 })
  }
}
