/**
 * Resolución de etiquetas para atributos personalizados por tipo de activo.
 *
 * Única fuente de verdad: equipo, licencia, suministro y actas comparten el mismo
 * catálogo por tipo (`equipment_type_attributes` / `license_type_attributes` /
 * `consumable_type_attributes`, editable desde "Gestionar atributos" — ver
 * AttributeManagerDialog / TypeAttributesInput). Un valor guardado solo trae la clave
 * técnica (`fieldName`); este módulo la cruza contra el catálogo del tipo para obtener
 * la etiqueta legible y el orden de presentación. Antes cada pantalla reimplementaba
 * este cruce por su cuenta — una de ellas (equipo) incluso lo hacía contra una tabla
 * distinta y ya retirada (`family_custom_fields`), así que la etiqueta nunca aparecía.
 */

export interface AttributeCatalogEntry {
  attributeName: string
  attributeLabel: string
  order: number
}

export interface CustomFieldValue {
  fieldName: string
  fieldValue: string
}

/** Convierte snake_case → "Pantalla Pulgadas" cuando un valor no tiene atributo en catálogo. */
export function humanizeAttributeFieldName(fieldName: string): string {
  return fieldName
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function buildLabelMap(attributes: AttributeCatalogEntry[]) {
  return new Map(attributes.map(attr => [attr.attributeName, attr]))
}

/**
 * Adjunta `fieldLabel` a cada valor y los devuelve ordenados según el catálogo del tipo.
 * Úsalo para renderizar una lista "Etiqueta: Valor" en un detalle (equipo, licencia,
 * suministro, acta de entrega).
 */
export function withAttributeLabels<V extends CustomFieldValue>(
  values: V[] | null | undefined,
  attributes: AttributeCatalogEntry[] | null | undefined
): Array<V & { fieldLabel: string }> {
  if (!values?.length) return []
  const meta = buildLabelMap(attributes ?? [])

  return [...values]
    .map(v => ({
      ...v,
      fieldLabel: meta.get(v.fieldName)?.attributeLabel ?? humanizeAttributeFieldName(v.fieldName),
    }))
    .sort((a, b) => {
      const oA = meta.get(a.fieldName)?.order ?? 999
      const oB = meta.get(b.fieldName)?.order ?? 999
      if (oA !== oB) return oA - oB
      return a.fieldName.localeCompare(b.fieldName, 'es')
    })
}

/** Formatea atributos como "Etiqueta: Valor, Etiqueta: Valor" (para vistas de lista/resumen). */
export function formatAttributesString(
  values: CustomFieldValue[] | null | undefined,
  attributes: AttributeCatalogEntry[] | null | undefined
): string | undefined {
  if (!values?.length) return undefined
  return withAttributeLabels(values, attributes)
    .map(v => `${v.fieldLabel}: ${v.fieldValue}`)
    .join(', ')
}
