/**
 * Resumen comercial ligero: crédito del maestro vs compromiso de contratos abiertos.
 * No es ledger AP; es una referencia operativa.
 */

export type SupplierCreditReferenceStatus = 'ok' | 'high' | 'unknown'

export type SupplierCommercialSummary = {
  openContracts: number
  monthlyCommitment: number
  currency: string
  creditLimit: number | null
  creditCurrency: string
  /** Estimación anual del compromiso mensual (monthly * 12) */
  annualizedCommitment: number
  referenceStatus: SupplierCreditReferenceStatus
}

type ContractRow = {
  monthlyCost: number | null
  totalValue: number | null
  billingCycle: string | null
  currency: string | null
  status: string
}

function toMonthly(row: ContractRow): number {
  const monthly = row.monthlyCost != null ? Number(row.monthlyCost) : 0
  if (monthly > 0) return monthly
  // ONE_TIME sin costo mensual: no entra al compromiso recurrente
  if (row.billingCycle === 'ONE_TIME') return 0
  return 0
}

export function buildSupplierCommercialSummary(params: {
  contracts: ContractRow[]
  creditLimit: unknown
  creditCurrency?: string | null
}): SupplierCommercialSummary {
  const open = params.contracts
  const monthlyCommitment = open.reduce((sum, c) => sum + toMonthly(c), 0)
  const currencies = [...new Set(open.map(c => c.currency || 'USD').filter(Boolean))]
  const currency = currencies.length === 1 ? currencies[0]! : params.creditCurrency || 'USD'

  let creditLimit: number | null = null
  if (params.creditLimit != null && params.creditLimit !== '') {
    const n =
      typeof params.creditLimit === 'object' &&
      params.creditLimit !== null &&
      'toNumber' in params.creditLimit
        ? (params.creditLimit as { toNumber: () => number }).toNumber()
        : Number(params.creditLimit)
    creditLimit = Number.isFinite(n) ? n : null
  }

  const creditCurrency = params.creditCurrency || 'USD'
  const annualizedCommitment = monthlyCommitment * 12

  let referenceStatus: SupplierCreditReferenceStatus = 'unknown'
  if (creditLimit != null && creditLimit > 0) {
    // Misma moneda → comparar anualizado vs límite; si monedas cruzadas, solo unknown
    if (currency === creditCurrency || open.length === 0) {
      referenceStatus = annualizedCommitment > creditLimit ? 'high' : 'ok'
    } else {
      referenceStatus = 'unknown'
    }
  }

  return {
    openContracts: open.length,
    monthlyCommitment: Math.round(monthlyCommitment * 100) / 100,
    currency,
    creditLimit,
    creditCurrency,
    annualizedCommitment: Math.round(annualizedCommitment * 100) / 100,
    referenceStatus,
  }
}
