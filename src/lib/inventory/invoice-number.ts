/**
 * Formato válido para N° Factura y N° Orden de Compra en todo el módulo de
 * inventario: solo dígitos y guion. Cubre el formato oficial de facturación
 * del SRI (ej. 001-001-000000123) sin admitir letras.
 */
export const INVOICE_NUMBER_PATTERN = /^[0-9-]*$/
export const INVOICE_NUMBER_ERROR = 'Solo se permiten números y guiones (ej. 001-001-000000123)'

/** Filtra en tiempo real lo que el usuario escribe en un input controlado. */
export function sanitizeInvoiceNumberInput(value: string): string {
  return value.replace(/[^0-9-]/g, '')
}

/** Validación de defensa en profundidad para el body recibido en la API. */
export function isValidInvoiceNumber(value: unknown): value is string | null | undefined {
  if (value == null || value === '') return true
  return typeof value === 'string' && INVOICE_NUMBER_PATTERN.test(value)
}
