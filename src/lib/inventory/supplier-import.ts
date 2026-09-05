/**
 * Importación masiva de proveedores (alta, no calificación — ver
 * supplier-evaluation-import.ts para el histórico de calificaciones).
 * Solo Nombre es obligatorio; el resto son los mismos campos opcionales que
 * ya existen en el alta manual (SupplierForm) — así una importación completa
 * evita tener que rellenar cada proveedor a mano después.
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
  legalName: ['razon social legal', 'nombre legal', 'legal name'],
  typeName: ['tipo de proveedor', 'tipo', 'supplier type', 'type'],
  website: ['sitio web', 'web', 'website', 'pagina web'],
  address: ['direccion', 'dirección', 'address'],
  city: ['ciudad', 'city'],
  country: ['pais', 'país', 'country'],
  paymentTermsDays: ['plazo de pago', 'plazo de pago (dias)', 'payment terms'],
  creditLimit: ['limite de credito', 'límite de crédito', 'credit limit'],
  creditCurrency: ['moneda', 'currency'],
  preferredPaymentMethod: ['metodo de pago', 'método de pago', 'payment method'],
  bankName: ['banco', 'bank'],
  bankAccountNumber: ['cuenta bancaria', 'numero de cuenta', 'número de cuenta', 'bank account'],
  bankAccountType: ['tipo de cuenta', 'account type'],
  bankSwift: ['swift', 'bic', 'swift/bic'],
  notes: ['notas', 'observaciones', 'notes'],
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
  legalName: string
  /** Texto crudo de la columna Tipo; se resuelve contra el catálogo de tipos de proveedor en el servidor. */
  typeName: string
  website: string
  address: string
  city: string
  country: string
  /** Texto crudo (número de días o etiqueta como "30 días"); se resuelve en el servidor. */
  paymentTermsDays: string
  /** Texto crudo (admite coma decimal); se valida y convierte en el servidor. */
  creditLimit: string
  creditCurrency: string
  /** Texto crudo (código o etiqueta en español); se resuelve en el servidor. */
  preferredPaymentMethod: string
  bankName: string
  bankAccountNumber: string
  /** Texto crudo (código o etiqueta en español); se resuelve en el servidor. */
  bankAccountType: string
  bankSwift: string
  notes: string
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
    legalName: get(row, 'legalName'),
    typeName: get(row, 'typeName'),
    website: get(row, 'website'),
    address: get(row, 'address'),
    city: get(row, 'city'),
    country: get(row, 'country'),
    paymentTermsDays: get(row, 'paymentTermsDays'),
    creditLimit: get(row, 'creditLimit'),
    creditCurrency: get(row, 'creditCurrency'),
    preferredPaymentMethod: get(row, 'preferredPaymentMethod'),
    bankName: get(row, 'bankName'),
    bankAccountNumber: get(row, 'bankAccountNumber'),
    bankAccountType: get(row, 'bankAccountType'),
    bankSwift: get(row, 'bankSwift'),
    notes: get(row, 'notes'),
  }))
}

/** Valida una fila ya parseada; null = sin errores. No valida duplicados, área, tipo ni catálogos (eso es en el servidor). */
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
