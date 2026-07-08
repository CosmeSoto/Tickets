import type {
  AttributeCatalogEntry,
  EquipmentCustomValue,
  LegacyFamilyFieldEntry,
} from '@/lib/inventory/format-equipment-attributes'
import {
  buildAttributeFieldMeta,
  humanizeAttributeFieldName,
} from '@/lib/inventory/format-equipment-attributes'

type AttributeLabelRef = Pick<AttributeCatalogEntry, 'attributeName' | 'attributeLabel'>

/** Acepta valores de plantilla o de exportación (con $, espacios, comas decimales o de miles) */
export function parsePurchasePrice(raw?: string): number | undefined {
  if (!raw?.trim()) return undefined
  let cleaned = raw.trim().replace(/[$€£\s]/g, '')

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '')
  } else if (/^\d+,\d+$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.')
  }

  const n = Number(cleaned)
  if (Number.isNaN(n) || n < 0) return undefined
  return n
}

export function parsePurchaseDate(raw?: string): Date | undefined {
  if (!raw?.trim()) return undefined
  const trimmed = raw.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00`)
    return Number.isNaN(d.getTime()) ? undefined : d
  }

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const [, dd, mm, yyyy] = slash
    const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T12:00:00`)
    return Number.isNaN(d.getTime()) ? undefined : d
  }

  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? undefined : d
}

/**
 * Convierte la columna "Atributos" del export ("Etiqueta: Valor, ...")
 * en valores importables cuando no hay columnas dinámicas por atributo.
 */
export function parseEquipmentAttributesFromExportString(
  raw: string | undefined,
  typeAttributes: AttributeLabelRef[] = [],
  familyFields: LegacyFamilyFieldEntry[] = []
): EquipmentCustomValue[] {
  if (!raw?.trim()) return []

  const labelToFieldName = new Map<string, string>()
  for (const attr of typeAttributes) {
    labelToFieldName.set(attr.attributeLabel.toLowerCase(), attr.attributeName)
  }

  const fieldMeta = buildAttributeFieldMeta([], familyFields)
  for (const [fieldName, meta] of fieldMeta) {
    labelToFieldName.set(meta.label.toLowerCase(), fieldName)
  }

  const result: EquipmentCustomValue[] = []
  const segments = raw.split(/,\s*/)

  for (const segment of segments) {
    const colonIdx = segment.indexOf(':')
    if (colonIdx <= 0) continue

    const label = segment.slice(0, colonIdx).trim()
    const value = segment.slice(colonIdx + 1).trim()
    if (!label || !value) continue

    const fieldName =
      labelToFieldName.get(label.toLowerCase()) ??
      typeAttributes.find(
        a =>
          a.attributeLabel.toLowerCase() === label.toLowerCase() ||
          humanizeAttributeFieldName(a.attributeName).toLowerCase() === label.toLowerCase()
      )?.attributeName

    if (fieldName) {
      result.push({ fieldName, fieldValue: value })
    }
  }

  return result
}
