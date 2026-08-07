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

/** Descripciones genéricas que duplican la categoría — no crear línea automática. */
const GENERIC_LINE_DESCRIPTIONS = new Set([
  'licencia de software',
  'equipo en arrendamiento',
  'software',
  'equipo',
])

export function lineTypeForCategory(
  category?: ContractFormData['category'] | string | null
): ContractLineType {
  if (category === 'SOFTWARE_LICENSE') return 'SOFTWARE'
  if (category === 'EQUIPMENT_RENTAL') return 'EQUIPMENT'
  if (category === 'MAINTENANCE' || category === 'SUPPORT') return 'SERVICE'
  return 'SERVICE'
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

  const isRecurring =
    (prefill.billingCycle ?? (prefill.hasRecurring ? 'MONTHLY' : 'ONE_TIME')) !== 'ONE_TIME'
  if (isRecurring && prefill.monthlyCost != null && prefill.monthlyCost !== '') {
    setValue('monthlyCost', String(prefill.monthlyCost))
    setValue('totalValue', '')
  } else if (!isRecurring && prefill.totalValue != null && prefill.totalValue !== '') {
    setValue('totalValue', String(prefill.totalValue))
    setValue('monthlyCost', '')
  }
  if (prefill.description) setValue('description', prefill.description)

  // Solo prellenar línea si hay identificación concreta del activo (no texto genérico
  // que repite la categoría: "Licencia de software" / "Equipo en arrendamiento").
  const rawDesc = prefill.suggestedLineDescription?.trim()
  const isGeneric =
    !rawDesc || GENERIC_LINE_DESCRIPTIONS.has(rawDesc.toLowerCase())

  if (rawDesc && !isGeneric && currentLineCount === 0) {
    const unitPrice = isRecurring
      ? prefill.monthlyCost != null
        ? String(prefill.monthlyCost)
        : ''
      : prefill.totalValue != null
        ? String(prefill.totalValue)
        : ''
    appendLine({
      type: prefill.suggestedLineType ?? lineTypeForCategory(prefill.category),
      description: rawDesc,
      quantity: '1',
      unitPrice,
      equipmentId: '',
      licenseId: '',
      notes: '',
      order: 0,
    })
  }
}
