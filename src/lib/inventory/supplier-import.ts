/**
 * Importación masiva de proveedores (alta, no calificación — ver
 * supplier-evaluation-import.ts para el histórico de calificaciones).
 * Columnas básicas: Nombre, RUC/NIT, Email, Teléfono, Contacto, Área.
 * Cliente y servidor comparten este mapeo de encabezados.
 */

import { SUPPLIER_TAX_ID_MAX_LENGTH } from '@/lib/validations/inventory/supplier'

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
  name: ['nombre', 'proveedor', 'razon social', 'supplier', 'name'],
  taxId: ['ruc', 'nit', 'ruc/nit', 'ruc / nit', 'tax id', 'taxid'],
  email: ['mail', 'email', 'correo'],
  phone: ['telefono', 'celular', 'phone'],
  contactName: ['contacto', 'contact'],
  familyName: ['area', 'área', 'familia', 'family'],
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

/** Solo el nombre es una columna obligatoria; el resto son metadatos opcionales. */
export const REQUIRED_IMPORT_FIELDS: ImportFieldKey[] = ['name']

export interface ParsedImportRow {
  rowNumber: number // 1-based, incluye encabezado (para mostrar al usuario el número de fila real del Excel)
  name: string
  taxId: string
  email: string
  phone: string
  contactName: string
  /** Texto crudo de la columna Área; se resuelve contra el catálogo de familias en el servidor. */
  familyName: string
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
    name: get(row, 'name'),
    taxId: get(row, 'taxId'),
    email: get(row, 'email'),
    phone: get(row, 'phone'),
    contactName: get(row, 'contactName'),
    familyName: get(row, 'familyName'),
  }))
}

/** Valida una fila ya parseada; null = sin errores. No valida duplicados ni área (eso es en el servidor). */
export function validateImportRow(row: ParsedImportRow): string | null {
  if (!row.name) return 'Falta el nombre del proveedor'
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return 'Email inválido'
  // Texto libre (no solo dígitos): admite RUC de Ecuador y también NIT, VAT,
  // EIN u otros identificadores tributarios extranjeros con letras/guiones.
  if (row.taxId.length > SUPPLIER_TAX_ID_MAX_LENGTH) {
    return `RUC/NIT no puede superar los ${SUPPLIER_TAX_ID_MAX_LENGTH} caracteres`
  }
  return null
}
