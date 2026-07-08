import type { TypeAttributeDef } from './types'
import { FIXED_COLUMNS } from './constants'
import { EQUIPMENT_ATTRIBUTES_COMBINED_ALIASES } from '@/lib/inventory/equipment-field-definitions'

export interface ColumnIndexMap {
  serialNumber: number
  condition: number
  warehouse: number
  physicalLocation: number
  purchaseDate: number
  purchasePrice: number
  invoiceNumber: number
  accessories: number
  notes: number
  attributesCombined: number
  attributes: Record<string, number>
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function findCol(headerRow: string[], aliases: readonly string[]): number {
  for (const alias of aliases) {
    const normalized = normalizeHeader(alias)
    const i = headerRow.findIndex(c => normalizeHeader(c) === normalized)
    if (i !== -1) return i
  }
  return -1
}

function detectHeaderRow(rows: string[][]): { hasHeader: boolean; dataRows: string[][] } {
  if (rows.length === 0) return { hasHeader: false, dataRows: [] }
  const firstRow = rows[0].map(c => normalizeHeader(c))
  const hasHeader = firstRow.some(c =>
    ['serialnumber', 'n de serie', 'serie', 'serial', 'marca', 'brand'].some(k => c.includes(k))
  )
  return { hasHeader, dataRows: hasHeader ? rows.slice(1) : rows }
}

export function buildColumnIndexMap(
  headerRow: string[],
  attributes: TypeAttributeDef[]
): ColumnIndexMap {
  const map: ColumnIndexMap = {
    serialNumber: -1,
    condition: -1,
    warehouse: -1,
    physicalLocation: -1,
    purchaseDate: -1,
    purchasePrice: -1,
    invoiceNumber: -1,
    accessories: -1,
    notes: -1,
    attributesCombined: -1,
    attributes: {},
  }

  for (const col of FIXED_COLUMNS) {
    map[col.key as keyof Omit<ColumnIndexMap, 'attributes' | 'attributesCombined'>] = findCol(
      headerRow,
      col.aliases
    )
  }

  map.attributesCombined = findCol(headerRow, EQUIPMENT_ATTRIBUTES_COMBINED_ALIASES)

  for (const attr of attributes) {
    const byName = findCol(headerRow, [attr.attributeName])
    const byLabel = findCol(headerRow, [attr.attributeLabel])
    const idx = byName >= 0 ? byName : byLabel
    if (idx >= 0) map.attributes[attr.attributeName] = idx
  }

  return map
}

export function getCell(row: string[], colIdx: number): string | undefined {
  if (colIdx < 0 || colIdx >= row.length) return undefined
  const v = row[colIdx]?.trim()
  return v || undefined
}

export function parseAccessories(raw?: string): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

export function splitDataRows(rows: string[][]): {
  hasHeader: boolean
  headerRow: string[]
  dataRows: string[][]
} {
  const { hasHeader, dataRows } = detectHeaderRow(rows)
  const headerRow = hasHeader
    ? rows[0].map(c => normalizeHeader(c))
    : [
        'serialnumber',
        'condition',
        'warehouse',
        'physicallocation',
        'purchasedate',
        'purchaseprice',
        'invoicenumber',
        'accessories',
        'notes',
      ]
  return { hasHeader, headerRow, dataRows }
}
