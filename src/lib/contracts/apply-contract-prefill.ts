import type { UseFormSetValue } from 'react-hook-form'
import type { ContractFormData, ContractLineType } from '@/types/contracts'
import type { ContractPickerPrefill } from '@/lib/contracts/contract-picker-prefill'

type LineDraft = {
  type: ContractLineType
  description: string
  quantity: string
  unitPrice: string
  equipmentId: string
  licenseId: string
  notes: string
  order: number
}

/** Aplica prefill al formulario completo de contrato (creación embebida). */
export function applyContractFormPrefill(
  prefill: ContractPickerPrefill,
  setValue: UseFormSetValue<ContractFormData>,
  appendLine: (line: LineDraft) => void,
  currentLineCount: number
): void {
  if (prefill.name) setValue('name', prefill.name)
  if (prefill.category) {
    setValue('category', prefill.category)
    if (prefill.category === 'EQUIPMENT_RENTAL') {
      setValue('renewalNoticeDays', 120)
    }
  }
  if (prefill.supplierId) setValue('supplierId', prefill.supplierId)
  if (prefill.familyId) setValue('familyId', prefill.familyId)
  if (prefill.startDate) setValue('startDate', prefill.startDate)
  if (prefill.endDate) setValue('endDate', prefill.endDate)
  if (prefill.billingCycle) setValue('billingCycle', prefill.billingCycle)

  const isRecurring = (prefill.billingCycle ?? (prefill.hasRecurring ? 'MONTHLY' : 'ONE_TIME')) !== 'ONE_TIME'
  if (isRecurring && prefill.monthlyCost != null && prefill.monthlyCost !== '') {
    setValue('monthlyCost', String(prefill.monthlyCost))
    setValue('totalValue', '')
  } else if (!isRecurring && prefill.totalValue != null && prefill.totalValue !== '') {
    setValue('totalValue', String(prefill.totalValue))
    setValue('monthlyCost', '')
  }
  if (prefill.description) setValue('description', prefill.description)

  if (prefill.suggestedLineDescription && currentLineCount === 0) {
    const unitPrice = isRecurring
      ? prefill.monthlyCost != null
        ? String(prefill.monthlyCost)
        : ''
      : prefill.totalValue != null
        ? String(prefill.totalValue)
        : ''
    appendLine({
      type: prefill.suggestedLineType ?? 'SOFTWARE',
      description: prefill.suggestedLineDescription,
      quantity: '1',
      unitPrice,
      equipmentId: '',
      licenseId: '',
      notes: '',
      order: 0,
    })
  }
}
