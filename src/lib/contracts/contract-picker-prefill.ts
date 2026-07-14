import type { ContractCategory, ContractLineType, BillingCycle } from '@/types/contracts'

export type ContractPickerContext = 'license' | 'equipment'

/** Datos del activo/licencia para pre-rellenar creación de contrato */
export type ContractPickerPrefill = {
  name?: string
  supplierId?: string | null
  familyId?: string | null
  startDate?: string
  endDate?: string
  /** Costo recurrente (mensual u otro ciclo) */
  monthlyCost?: string | number
  /** Valor total / pago único */
  totalValue?: string | number
  cost?: string | number
  hasRecurring?: boolean
  billingCycle?: BillingCycle
  category?: ContractCategory
  suggestedLineDescription?: string
  suggestedLineType?: ContractLineType
  description?: string
}

export function defaultCategoryForContext(context?: ContractPickerContext): ContractCategory {
  return context === 'license' ? 'SOFTWARE_LICENSE' : 'EQUIPMENT_RENTAL'
}

export function buildContractPrefill(
  prefill?: ContractPickerPrefill | null,
  context?: ContractPickerContext
): ContractPickerPrefill {
  if (!prefill) {
    return { category: defaultCategoryForContext(context) }
  }

  const hasRecurring = prefill.hasRecurring ?? false
  const costStr =
    prefill.cost != null
      ? String(prefill.cost)
      : prefill.monthlyCost != null
        ? String(prefill.monthlyCost)
        : prefill.totalValue != null
          ? String(prefill.totalValue)
          : undefined

  return {
    ...prefill,
    category: prefill.category ?? defaultCategoryForContext(context),
    billingCycle:
      prefill.billingCycle ?? (hasRecurring ? 'MONTHLY' : 'ONE_TIME'),
    monthlyCost: hasRecurring ? (prefill.monthlyCost ?? costStr) : prefill.monthlyCost,
    totalValue: !hasRecurring ? (prefill.totalValue ?? costStr) : prefill.totalValue,
    suggestedLineType:
      prefill.suggestedLineType ?? (context === 'license' ? 'SOFTWARE' : 'EQUIPMENT'),
    suggestedLineDescription:
      prefill.suggestedLineDescription ?? prefill.name ?? undefined,
  }
}
