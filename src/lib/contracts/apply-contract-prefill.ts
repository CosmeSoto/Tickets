import type { UseFormSetValue } from 'react-hook-form'
import type { ContractFormData, ContractLineType } from '@/types/contracts'
import type { ContractPickerPrefill } from '@/lib/contracts/contract-picker-prefill'

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
  setValue: UseFormSetValue<ContractFormData>
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

  // Deliberadamente NO se agrega una línea para el activo que se está creando.
  // Ese activo todavía no existe (no tiene id) al momento de este prefill, así
  // que cualquier línea creada acá quedaría con equipmentId/licenseId vacíos.
  // Cuando el activo se guarda, linkEquipmentToContract()/linkLicenseToBusinessContract()
  // crea automáticamente la línea real, ya vinculada a su id — esta de acá nunca
  // se reemplaza ni se limpia, así que quedaba como un renglón fantasma duplicado
  // en el contrato (línea sin activo + línea real, mismo ítem). "Agregar ítem"
  // sigue disponible para cargos u otros activos que el usuario quiera anotar a mano.
}
