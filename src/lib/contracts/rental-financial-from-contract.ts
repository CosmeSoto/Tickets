import { BILLING_CYCLE_LABELS, type BillingCycle } from '@/types/contracts'
import type { ContractCostSource } from '@/lib/contracts/license-financial-from-contract'
export { formatContractAmount } from '@/lib/contracts/license-financial-from-contract'

export type RentalFinancialFromContract = {
  monthlyCost: number | null
  startDate: string | null
  endDate: string | null
  contractNumber: string | null
  amountLabel: string
  currency: string
  displayAmount: number | null
}

/** Deriva costos de arrendamiento desde un contrato vinculado. */
export function resolveRentalFinancialFromContract(
  contract: ContractCostSource & { contractNumber?: string | null; startDate?: string | null }
): RentalFinancialFromContract {
  const currency = contract.currency ?? 'USD'
  const monthlyCost = contract.monthlyCost ?? contract.totalValue ?? null
  const cycleLabel = contract.billingCycle
    ? (BILLING_CYCLE_LABELS[contract.billingCycle as BillingCycle] ?? contract.billingCycle)
    : null

  return {
    monthlyCost,
    startDate: contract.startDate?.slice(0, 10) ?? null,
    endDate: contract.endDate?.slice(0, 10) ?? null,
    contractNumber: contract.contractNumber ?? null,
    amountLabel: cycleLabel
      ? `Costo recurrente (${cycleLabel.toLowerCase()})`
      : 'Costo mensual de arrendamiento',
    currency,
    displayAmount: monthlyCost,
  }
}
