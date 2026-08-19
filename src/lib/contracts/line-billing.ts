/**
 * Vigencia y monto por línea de contrato.
 * Si la línea no tiene fechas propias, hereda las del contrato (compatibilidad).
 */

export type LineBillingInput = {
  quantity?: number | null
  unitPrice?: number | null
  totalPrice?: number | null
  serviceStartDate?: Date | string | null
  serviceEndDate?: Date | string | null
}

export type ContractBillingWindow = {
  startDate?: Date | string | null
  endDate?: Date | string | null
  monthlyCost?: number | null
  totalValue?: number | null
  billingCycle?: string | null
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null
  if (typeof v === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
    if (m) {
      return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    }
  }
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function lineServiceWindow(
  line: LineBillingInput,
  contract: ContractBillingWindow
): { start: Date | null; end: Date | null } {
  return {
    start: toDate(line.serviceStartDate) ?? toDate(contract.startDate),
    end: toDate(line.serviceEndDate) ?? toDate(contract.endDate),
  }
}

/** La línea factura en `onDate` si su ventana (o la del contrato) la cubre. */
export function lineIsBillableOn(
  line: LineBillingInput,
  contract: ContractBillingWindow,
  onDate: Date
): boolean {
  const { start, end } = lineServiceWindow(line, contract)
  const day = toDate(onDate)
  if (!day) return false
  if (start && day < start) return false
  if (end && day > end) return false
  return true
}

export function linePeriodAmount(line: LineBillingInput): number {
  const qty = Number(line.quantity) || 0
  if (line.unitPrice != null && Number.isFinite(Number(line.unitPrice))) {
    return qty * Number(line.unitPrice)
  }
  if (line.totalPrice != null && Number.isFinite(Number(line.totalPrice))) {
    return Number(line.totalPrice)
  }
  return 0
}

export function linesHavePricedItems(lines: LineBillingInput[]): boolean {
  return lines.some(l => linePeriodAmount(l) > 0)
}

/** Suma de líneas con precio (todas, para sugerir el encabezado). */
export function suggestedRecurringFromLines(lines: LineBillingInput[]): number {
  return Math.round(lines.reduce((sum, l) => sum + linePeriodAmount(l), 0) * 100) / 100
}

/**
 * Monto del periodo con fecha de cargo `dueDate`.
 * Si hay líneas con precio, suma solo las vigentes ese día (no duplica el encabezado).
 * Si no hay precios en líneas, usa monthlyCost / totalValue del contrato.
 */
export function amountDueOnDate(
  lines: LineBillingInput[],
  contract: ContractBillingWindow,
  dueDate: Date
): number {
  if (linesHavePricedItems(lines)) {
    const sum = lines.reduce((acc, line) => {
      if (!lineIsBillableOn(line, contract, dueDate)) return acc
      return acc + linePeriodAmount(line)
    }, 0)
    return Math.round(sum * 100) / 100
  }

  if (contract.billingCycle === 'ONE_TIME') {
    return Number(contract.totalValue) || 0
  }
  return Number(contract.monthlyCost) || Number(contract.totalValue) || 0
}
