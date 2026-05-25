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
