export interface AttributeCatalogEntry {
  attributeName: string
  attributeLabel: string
  order: number
}

export interface LegacyFamilyFieldEntry {
  fieldName: string
  fieldLabel: string
  order: number
}

export interface EquipmentCustomValue {
  fieldName: string
  fieldValue: string
}

/** Convierte snake_case → "Pantalla Pulgadas" cuando no hay etiqueta en catálogo */
export function humanizeAttributeFieldName(fieldName: string): string {
  return fieldName
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function buildAttributeFieldMeta(
  typeAttributes: AttributeCatalogEntry[] = [],
  familyFields: LegacyFamilyFieldEntry[] = []
): Map<string, { label: string; order: number }> {
  const fieldMeta = new Map<string, { label: string; order: number }>()

  for (const field of familyFields) {
    fieldMeta.set(field.fieldName, { label: field.fieldLabel, order: field.order })
  }

  for (const attr of typeAttributes) {
    fieldMeta.set(attr.attributeName, { label: attr.attributeLabel, order: attr.order })
  }

  return fieldMeta
}

/**
 * Formatea atributos como "Etiqueta: Valor" en el orden del catálogo del tipo.
 */
export function formatEquipmentAttributesString(
  customValues: EquipmentCustomValue[] | undefined | null,
  typeAttributes: AttributeCatalogEntry[] = [],
  familyFields: LegacyFamilyFieldEntry[] = []
): string | undefined {
  if (!customValues?.length) return undefined

  const fieldMeta = buildAttributeFieldMeta(typeAttributes, familyFields)

  const sortedValues = [...customValues].sort((a, b) => {
    const oA = fieldMeta.get(a.fieldName)?.order ?? 999
    const oB = fieldMeta.get(b.fieldName)?.order ?? 999
    if (oA !== oB) return oA - oB
    return a.fieldName.localeCompare(b.fieldName, 'es')
  })

  return sortedValues
    .map(cv => {
      const label = fieldMeta.get(cv.fieldName)?.label ?? humanizeAttributeFieldName(cv.fieldName)
      return `${label}: ${cv.fieldValue}`
    })
    .join(', ')
}
