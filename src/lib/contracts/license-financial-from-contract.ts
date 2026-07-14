import { BILLING_CYCLE_LABELS, type BillingCycle } from '@/types/contracts'

export type ContractCostSource = {
  monthlyCost?: number | null
  totalValue?: number | null
  billingCycle?: BillingCycle | string | null
  endDate?: string | null
  currency?: string | null
}

export type LicenseFinancialFromContract = {
  cost: number | null
  renewalCost: number | null
  renewalDate: string | null
  expirationDate: string | null
  amountLabel: string
  currency: string
  displayAmount: number | null
}

/** Deriva costos de licencia desde un contrato según si es recurrente o pago único. */
export function resolveLicenseFinancialFromContract(
  contract: ContractCostSource,
  hasRecurring: boolean
): LicenseFinancialFromContract {
  const currency = contract.currency ?? 'USD'
  const cycleLabel = contract.billingCycle
    ? (BILLING_CYCLE_LABELS[contract.billingCycle as BillingCycle] ?? contract.billingCycle)
    : null

  if (hasRecurring) {
    const renewalCost = contract.monthlyCost ?? contract.totalValue ?? null
    return {
      cost: null,
      renewalCost,
      renewalDate: contract.endDate?.slice(0, 10) ?? null,
      expirationDate: contract.endDate?.slice(0, 10) ?? null,
      amountLabel: cycleLabel
        ? `Costo recurrente (${cycleLabel.toLowerCase()})`
        : 'Costo recurrente',
      currency,
      displayAmount: renewalCost,
    }
  }

  const cost = contract.totalValue ?? contract.monthlyCost ?? null
  return {
    cost,
    renewalCost: null,
    renewalDate: null,
    expirationDate: contract.endDate?.slice(0, 10) ?? null,
    amountLabel: 'Valor del contrato (pago único)',
    currency,
    displayAmount: cost,
  }
}

export function formatContractAmount(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}
