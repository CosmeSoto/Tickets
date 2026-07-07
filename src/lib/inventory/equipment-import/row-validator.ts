import type {
  ImportCatalogContext,
  ImportMode,
  ImportRowError,
  ImportSkippedRow,
  ParsedImportRow,
  TypeAttributeDef,
} from './types'
import {
  CONDITION_ALIASES,
  MAX_IMPORT_ROWS,
  VALID_ACQUISITION_MODES,
  VALID_CONDITIONS,
} from './constants'
import {
  buildColumnIndexMap,
  getCell,
  parseAccessories,
  parsePurchaseDate,
  splitDataRows,
  type ColumnIndexMap,
} from './parse-rows'

interface WarehouseOption {
  id: string
  name: string
  code?: string | null
}

export interface ExistingEquipmentRef {
  id: string
  code: string
  modelId: string | null
  typeId: string | null
  status: string
}

const NON_UPDATABLE_STATUSES = new Set(['ASSIGNED', 'MAINTENANCE', 'RETIRED', 'FOR_SALE', 'SOLD'])

interface ValidateImportInput {
  rows: string[][]
  context: ImportCatalogContext
  mode: ImportMode
  attributes: TypeAttributeDef[]
  warehouses: WarehouseOption[]
  existingBySerial: Map<string, ExistingEquipmentRef>
}

export interface ValidateImportOutput {
  errors: ImportRowError[]
  parsed: ParsedImportRow[]
  skipped: ImportSkippedRow[]
  total: number
}

function normalizeCondition(raw?: string): string {
  if (!raw?.trim()) return 'NEW'
  const key = raw.trim().toUpperCase().replace(/\s+/g, '_')
  return CONDITION_ALIASES[key] ?? key
}

function resolveWarehouseId(
  raw: string | undefined,
  warehouses: WarehouseOption[]
): string | undefined {
  if (!raw?.trim()) return undefined
  const needle = raw.trim().toLowerCase()
  const match = warehouses.find(
    w => w.name.toLowerCase() === needle || (w.code && w.code.toLowerCase() === needle)
  )
  return match?.id
}

function validateAttributeValue(attr: TypeAttributeDef, value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return attr.isRequired ? `El campo "${attr.attributeLabel}" es obligatorio` : null
  }

  if (attr.attributeType === 'number' && Number.isNaN(Number(trimmed))) {
    return `"${attr.attributeLabel}" debe ser numérico`
  }

  if (attr.attributeType === 'select' && Array.isArray(attr.options)) {
    const allowed = (attr.options as string[]).map(o => String(o).toLowerCase())
    if (!allowed.includes(trimmed.toLowerCase())) {
      return `"${attr.attributeLabel}" debe ser uno de: ${allowed.join(', ')}`
    }
  }

  return null
}

export function validateImportContext(context: ImportCatalogContext): string | null {
  if (!context.familyId) return 'familyId es obligatorio'
  if (!context.typeId) return 'typeId es obligatorio'
  if (!context.brandId) return 'brandId es obligatorio'
  if (!context.modelId) return 'modelId es obligatorio'
  if (!VALID_ACQUISITION_MODES.includes(context.acquisitionMode)) {
    return 'acquisitionMode inválido'
  }
  return null
}

function parseRowFields(
  row: string[],
  rowNumber: number,
  colMap: ColumnIndexMap,
  attributes: TypeAttributeDef[],
  warehouses: WarehouseOption[]
): { parsed?: Omit<ParsedImportRow, 'action' | 'existingEquipmentId'>; error?: ImportRowError } {
  const condition = normalizeCondition(getCell(row, colMap.condition))
  if (!VALID_CONDITIONS.includes(condition as (typeof VALID_CONDITIONS)[number])) {
    return {
      error: {
        row: rowNumber,
        field: 'condition',
        message: `Condición inválida. Use: ${VALID_CONDITIONS.join(', ')}`,
      },
    }
  }

  const warehouseRaw = getCell(row, colMap.warehouse)
  const warehouseId = resolveWarehouseId(warehouseRaw, warehouses)
  if (warehouseRaw && !warehouseId) {
    return {
      error: {
        row: rowNumber,
        field: 'warehouse',
        message: `Bodega no encontrada: ${warehouseRaw}`,
      },
    }
  }

  const purchaseDateRaw = getCell(row, colMap.purchaseDate)
  const purchaseDate = parsePurchaseDate(purchaseDateRaw)
  if (purchaseDateRaw && !purchaseDate) {
    return {
      error: {
        row: rowNumber,
        field: 'purchaseDate',
        message: 'Fecha inválida. Use YYYY-MM-DD o DD/MM/YYYY',
      },
    }
  }

  const purchasePriceRaw = getCell(row, colMap.purchasePrice)
  let purchasePrice: number | undefined
  if (purchasePriceRaw) {
    const n = Number(purchasePriceRaw.replace(',', '.'))
    if (Number.isNaN(n) || n < 0) {
      return {
        error: {
          row: rowNumber,
          field: 'purchasePrice',
          message: 'Precio de compra inválido',
        },
      }
    }
    purchasePrice = n
  }

  const customValues: Array<{ fieldName: string; fieldValue: string }> = []

  for (const attr of attributes) {
    const colIdx = colMap.attributes[attr.attributeName]
    const rawValue = colIdx !== undefined ? getCell(row, colIdx) : undefined
    const msg = validateAttributeValue(attr, rawValue)
    if (msg) {
      return { error: { row: rowNumber, field: attr.attributeName, message: msg } }
    }
    if (rawValue?.trim()) {
      customValues.push({ fieldName: attr.attributeName, fieldValue: rawValue.trim() })
    }
  }

  return {
    parsed: {
      rowNumber,
      serialNumber: getCell(row, colMap.serialNumber)!,
      condition,
      warehouseId,
      physicalLocation: getCell(row, colMap.physicalLocation),
      purchaseDate,
      purchasePrice,
      invoiceNumber: getCell(row, colMap.invoiceNumber),
      accessories: parseAccessories(getCell(row, colMap.accessories)),
      notes: getCell(row, colMap.notes),
      customValues,
    },
  }
}

export function validateAndParseImportRows(input: ValidateImportInput): ValidateImportOutput {
  const { rows, context, mode, attributes, warehouses, existingBySerial } = input
  const errors: ImportRowError[] = []
  const parsed: ParsedImportRow[] = []
  const skipped: ImportSkippedRow[] = []
  const seenSerials = new Set<string>()

  const contextError = validateImportContext(context)
  if (contextError) {
    return {
      errors: [{ row: 0, field: 'context', message: contextError }],
      parsed: [],
      skipped: [],
      total: 0,
    }
  }

  const { headerRow, dataRows } = splitDataRows(rows)
  const colMap = buildColumnIndexMap(headerRow, attributes)

  if (colMap.serialNumber < 0) {
    return {
      errors: [
        {
          row: 1,
          field: 'serialNumber',
          message: 'Falta la columna "N° de Serie" en el encabezado',
        },
      ],
      parsed: [],
      skipped: [],
      total: 0,
    }
  }

  const nonEmptyRows = dataRows.filter(r => r.some(c => c?.trim()))
  if (nonEmptyRows.length === 0) {
    return {
      errors: [{ row: 0, field: 'file', message: 'El archivo no tiene filas de datos' }],
      parsed: [],
      skipped: [],
      total: 0,
    }
  }

  if (nonEmptyRows.length > MAX_IMPORT_ROWS) {
    return {
      errors: [
        {
          row: 0,
          field: 'file',
          message: `Máximo ${MAX_IMPORT_ROWS} equipos por importación`,
        },
      ],
      parsed: [],
      skipped: [],
      total: nonEmptyRows.length,
    }
  }

  for (let i = 0; i < nonEmptyRows.length; i++) {
    const row = nonEmptyRows[i]
    const rowNumber = i + (headerRow ? 2 : 1)
    const serialNumber = getCell(row, colMap.serialNumber)

    if (!serialNumber) {
      errors.push({
        row: rowNumber,
        field: 'serialNumber',
        serialNumber: '(vacío)',
        message: 'N° de serie obligatorio',
      })
      continue
    }

    const serialKey = serialNumber.toLowerCase()
    if (seenSerials.has(serialKey)) {
      errors.push({
        row: rowNumber,
        field: 'serialNumber',
        serialNumber,
        message: `Serie duplicada en el archivo: ${serialNumber}`,
      })
      continue
    }
    seenSerials.add(serialKey)

    const existing = existingBySerial.get(serialKey)

    if (existing && mode === 'add') {
      skipped.push({
        rowNumber,
        serialNumber,
        reason: `Ya existe (código ${existing.code}) — omitido`,
        existingCode: existing.code,
      })
      continue
    }

    if (existing && mode === 'update') {
      if (existing.typeId && existing.typeId !== context.typeId) {
        errors.push({
          row: rowNumber,
          field: 'serialNumber',
          serialNumber,
          message: `La serie pertenece a otro tipo de equipo (código ${existing.code})`,
        })
        continue
      }
      if (existing.modelId && existing.modelId !== context.modelId) {
        errors.push({
          row: rowNumber,
          field: 'serialNumber',
          serialNumber,
          message: `La serie pertenece a otro modelo (código ${existing.code})`,
        })
        continue
      }
      if (NON_UPDATABLE_STATUSES.has(existing.status)) {
        errors.push({
          row: rowNumber,
          field: 'serialNumber',
          serialNumber,
          message: `No se puede actualizar: equipo ${existing.code} en estado ${existing.status}`,
        })
        continue
      }
    }

    const fields = parseRowFields(row, rowNumber, colMap, attributes, warehouses)
    if (fields.error) {
      errors.push({ ...fields.error, serialNumber })
      continue
    }

    parsed.push({
      ...fields.parsed!,
      serialNumber,
      action: existing ? 'update' : 'create',
      existingEquipmentId: existing?.id,
    })
  }

  return { errors, parsed, skipped, total: nonEmptyRows.length }
}

export function toPreviewRows(
  parsed: ParsedImportRow[],
  skipped: ImportSkippedRow[],
  warehouses: WarehouseOption[],
  colMap: ColumnIndexMap
): import('./types').ImportPreviewRow[] {
  void colMap
  const warehouseById = new Map(warehouses.map(w => [w.id, w.name]))

  const createOrUpdate = parsed.map(row => ({
    rowNumber: row.rowNumber,
    serialNumber: row.serialNumber,
    action: row.action,
    condition: row.condition,
    warehouseName: row.warehouseId ? warehouseById.get(row.warehouseId) : undefined,
    customValues: Object.fromEntries(row.customValues.map(cv => [cv.fieldName, cv.fieldValue])),
  }))

  const skippedPreview = skipped.map(row => ({
    rowNumber: row.rowNumber,
    serialNumber: row.serialNumber,
    action: 'skip' as const,
    condition: '',
    customValues: {},
    reason: row.reason,
    existingCode: row.existingCode,
  }))

  return [...createOrUpdate, ...skippedPreview].sort((a, b) => a.rowNumber - b.rowNumber)
}
