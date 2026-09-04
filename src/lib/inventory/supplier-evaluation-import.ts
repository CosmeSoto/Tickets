/**
 * Importación masiva de calificaciones de proveedores desde el Excel
 * "CALIFICACIÓN PROVEEDORES" (año, proveedor, mail, contacto, detalle + 6
 * criterios 0-5). Cliente y servidor comparten este mapeo de encabezados.
 */

function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes (marcas diacríticas combinantes)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

// Cada campo acepta varias variantes de encabezado (es/en, con/sin tilde).
const HEADER_ALIASES: Record<string, string[]> = {
  year: ['ano', 'año', 'year'],
  supplierName: ['proveedor', 'supplier', 'proveedores'],
  email: ['mail', 'email', 'correo'],
  contact: ['contacto', 'contact'],
  detail: ['detalle', 'detail', 'servicio'],
  quality: ['calidad', 'quality'],
  creditTime: ['tiempo de credito', 'credit time', 'tiempo credito'],
  deliveryTime: ['tiempo de entrega', 'delivery time'],
  price: ['precio', 'price'],
  references: ['referencias', 'references'],
  equipmentScore: ['equipo', 'equipment'],
}

export type ImportFieldKey = keyof typeof HEADER_ALIASES

/** Mapea la fila de encabezados del Excel a índice de columna por campo. */
export function buildHeaderMap(headerRow: string[]): Partial<Record<ImportFieldKey, number>> {
  const normalized = headerRow.map(normalizeHeader)
  const map: Partial<Record<ImportFieldKey, number>> = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [ImportFieldKey, string[]][]) {
    const idx = normalized.findIndex(h => aliases.includes(h))
    if (idx !== -1) map[field] = idx
  }
  return map
}

export const REQUIRED_IMPORT_FIELDS: ImportFieldKey[] = [
  'year',
  'supplierName',
  'quality',
  'creditTime',
  'deliveryTime',
  'price',
  'references',
  'equipmentScore',
]

export interface ParsedImportRow {
  rowNumber: number // 1-based, incluye encabezado (para mostrar al usuario el número de fila real del Excel)
  year: number | null
  supplierName: string
  email: string
  contact: string
  detail: string
  quality: number | null
  creditTime: number | null
  deliveryTime: number | null
  price: number | null
  references: number | null
  equipmentScore: number | null
}

function toIntOrNull(v: string): number | null {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/** Convierte las filas crudas (arrays de strings) del Excel a objetos tipados, usando el mapa de encabezados. */
export function parseImportRows(
  rows: string[][],
  headerMap: Partial<Record<ImportFieldKey, number>>
): ParsedImportRow[] {
  const get = (row: string[], field: ImportFieldKey) => {
    const idx = headerMap[field]
    return idx == null ? '' : (row[idx] ?? '').trim()
  }

  // La fila 0 es el encabezado; los datos empiezan en la fila 1 (Excel fila 2).
  return rows.slice(1).map((row, i) => ({
    rowNumber: i + 2,
    year: toIntOrNull(get(row, 'year')),
    supplierName: get(row, 'supplierName'),
    email: get(row, 'email'),
    contact: get(row, 'contact'),
    detail: get(row, 'detail'),
    quality: toIntOrNull(get(row, 'quality')),
    creditTime: toIntOrNull(get(row, 'creditTime')),
    deliveryTime: toIntOrNull(get(row, 'deliveryTime')),
    price: toIntOrNull(get(row, 'price')),
    references: toIntOrNull(get(row, 'references')),
    equipmentScore: toIntOrNull(get(row, 'equipmentScore')),
  }))
}

export interface ImportRowValidationError {
  rowNumber: number
  message: string
}

/** Valida una fila ya parseada; null = sin errores. No valida existencia del proveedor (eso es en el servidor). */
export function validateImportRow(row: ParsedImportRow): string | null {
  if (!row.supplierName) return 'Falta el nombre del proveedor'
  if (!row.year || row.year < 2000 || row.year > 2100) return 'Año inválido'
  const scores = [
    row.quality,
    row.creditTime,
    row.deliveryTime,
    row.price,
    row.references,
    row.equipmentScore,
  ]
  if (scores.some(s => s == null)) return 'Faltan puntajes de algún criterio'
  if (scores.some(s => s! < 0 || s! > 5)) return 'Los puntajes deben estar entre 0 y 5'
  return null
}
