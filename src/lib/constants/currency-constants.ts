/**
 * Monedas soportadas en el sistema.
 *
 * Unifica las listas que antes estaban duplicadas (y desincronizadas) en
 * contract-form.tsx, EquipmentInvoicesCard.tsx, activate-sale-dialog.tsx y
 * SupplierForm.tsx — cada una con un subconjunto y formato de etiqueta
 * distinto. Úsese junto con <CurrencySelect /> (src/components/ui/currency-select.tsx).
 */

export interface CurrencyOption {
  code: string
  label: string
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', label: 'USD — Dólar estadounidense' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'CLP', label: 'CLP — Peso chileno' },
  { code: 'MXN', label: 'MXN — Peso mexicano' },
  { code: 'COP', label: 'COP — Peso colombiano' },
  { code: 'PEN', label: 'PEN — Sol peruano' },
  { code: 'ARS', label: 'ARS — Peso argentino' },
] as const

export const DEFAULT_CURRENCY = 'USD'

export function getCurrencyLabel(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.label ?? code
}
