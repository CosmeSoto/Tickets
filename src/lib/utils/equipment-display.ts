/**
 * Obtiene un nombre legible para mostrar del equipo, usando tipo, marca y modelo.
 * Si no hay información disponible, usa el código del equipo.
 */
export function getEquipmentDisplayName({
  equipmentCode,
  equipmentTypeName,
  equipmentBrandName,
  equipmentModelName,
}: {
  equipmentCode: string
  equipmentTypeName?: string
  equipmentBrandName?: string
  equipmentModelName?: string
}): string {
  const parts: string[] = []
  if (equipmentTypeName) parts.push(equipmentTypeName)
  if (equipmentBrandName) parts.push(equipmentBrandName)
  if (equipmentModelName) parts.push(equipmentModelName)
  if (parts.length === 0) return equipmentCode
  return parts.join(' · ')
}

/** Normaliza marca desde string o relación Prisma `{ name }`. */
export function resolveBrandName(
  brand: string | { name?: string | null } | null | undefined
): string {
  if (!brand) return ''
  if (typeof brand === 'string') return brand
  return brand.name ?? ''
}

export const EQUIPMENT_CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  USED: 'Usado',
  DAMAGED: 'Dañado',
}

export const ACQUISITION_MODE_LABELS: Record<string, string> = {
  FIXED_ASSET: 'Compra directa (Activo Fijo)',
  RENTAL: 'Arrendamiento',
  LOAN: 'Activo de Tercero',
}
