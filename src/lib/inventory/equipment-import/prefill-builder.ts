import { getAssetConditionLabel } from '@/lib/utils/inventory-utils'
import { EQUIPMENT_SHARED_FIELDS } from '@/lib/inventory/equipment-field-definitions'
import type { TypeAttributeDef } from './types'

export interface EquipmentPrefillSource {
  serialNumber: string
  condition?: string | null
  warehouse?: { name: string } | null
  physicalLocation?: string | null
  purchaseDate?: Date | null
  purchasePrice?: number | null
  invoiceNumber?: string | null
  accessories?: string[] | null
  notes?: string | null
  customValues?: Array<{ fieldName: string; fieldValue: string }>
}

function formatImportDate(value: Date): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Filas de datos alineadas con buildTemplateHeaders (columnas fijas + atributos dinámicos) */
export function buildPrefilledDataRows(
  equipment: EquipmentPrefillSource[],
  attributes: TypeAttributeDef[]
): string[][] {
  return equipment.map(item => {
    const customMap = new Map(item.customValues?.map(cv => [cv.fieldName, cv.fieldValue]) ?? [])

    const fixedValues: Record<string, string> = {
      serialNumber: item.serialNumber,
      condition: item.condition ? getAssetConditionLabel(item.condition) : '',
      warehouse: item.warehouse?.name ?? '',
      physicalLocation: item.physicalLocation ?? '',
      purchaseDate: item.purchaseDate ? formatImportDate(item.purchaseDate) : '',
      purchasePrice: item.purchasePrice != null ? Number(item.purchasePrice).toFixed(2) : '',
      invoiceNumber: item.invoiceNumber ?? '',
      accessories: item.accessories?.length ? item.accessories.join(', ') : '',
      notes: item.notes ?? '',
    }

    const fixed = EQUIPMENT_SHARED_FIELDS.map(f => fixedValues[f.key] ?? '')
    const dynamic = attributes.map(a => customMap.get(a.attributeName) ?? '')
    return [...fixed, ...dynamic]
  })
}
