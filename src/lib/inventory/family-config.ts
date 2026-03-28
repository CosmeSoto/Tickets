import { prisma } from '@/lib/prisma'

export type { AssetSubtype, FormSection, FamilyConfig } from './family-config-types'
export { DEFAULT_FAMILY_CONFIG } from './family-config-types'
import type { AssetSubtype, FormSection, FamilyConfig } from './family-config-types'
import { DEFAULT_FAMILY_CONFIG } from './family-config-types'

/**
 * Si hay exactamente un subtipo permitido, lo retorna con showSelector=false.
 * Función pura — no accede a BD.
 */
export function resolveAutoSubtype(
  allowedSubtypes: AssetSubtype[]
): { autoSelected: AssetSubtype | null; showSelector: boolean } {
  if (allowedSubtypes.length === 1) {
    return { autoSelected: allowedSubtypes[0], showSelector: false }
  }
  return { autoSelected: null, showSelector: true }
}

/**
 * Valida que el subtipo esté en los subtipos permitidos de la familia.
 * Función pura — no accede a BD.
 */
export function validateSubtypeForFamily(
  subtype: AssetSubtype,
  config: FamilyConfig
): { valid: boolean; error?: string } {
  if (!config.allowedSubtypes.includes(subtype)) {
    return {
      valid: false,
      error: `El subtipo '${subtype}' no está permitido para esta familia`,
    }
  }
  return { valid: true }
}

/**
 * Valida la invariante: requiredSections ⊆ visibleSections.
 * Función pura — no accede a BD.
 */
export function validateSectionsInvariant(
  visibleSections: FormSection[],
  requiredSections: FormSection[]
): { valid: boolean; error?: string } {
  const invalid = requiredSections.filter(s => !visibleSections.includes(s))
  if (invalid.length > 0) {
    return {
      valid: false,
      error: 'Las secciones obligatorias deben ser un subconjunto de las secciones visibles',
    }
  }
  return { valid: true }
}

/**
 * Obtiene la configuración de una familia. Si no existe, retorna los valores por defecto.
 * No lanza excepciones por "no encontrado".
 */
export async function getFamilyConfig(familyId: string): Promise<FamilyConfig> {
  try {
    const config = await prisma.inventory_family_config.findUnique({
      where: { familyId },
    })
    if (!config) {
      return { familyId, ...DEFAULT_FAMILY_CONFIG }
    }
    return {
      familyId: config.familyId,
      allowedSubtypes: config.allowedSubtypes as AssetSubtype[],
      visibleSections: config.visibleSections as FormSection[],
      requiredSections: config.requiredSections as FormSection[],
    }
  } catch {
    // Si la tabla no existe aún, devolver config por defecto
    return { familyId, ...DEFAULT_FAMILY_CONFIG }
  }
}
