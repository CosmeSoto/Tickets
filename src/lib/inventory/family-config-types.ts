// Tipos y constantes puras — sin dependencias de servidor
// Importable tanto en cliente como en servidor

export type AssetSubtype = 'EQUIPMENT' | 'MRO' | 'LICENSE'
export type FormSection = 'FINANCIAL' | 'DEPRECIATION' | 'CONTRACT' | 'STOCK_MRO' | 'WAREHOUSE'
export type AcquisitionMode = 'FIXED_ASSET' | 'RENTAL' | 'LOAN'

/** Config de secciones para una modalidad específica */
export interface ModeSectionConfig {
  visible: FormSection[]
  required: FormSection[]
}

/** Config de secciones por modalidad de adquisición (solo aplica a EQUIPMENT) */
export type SectionsByMode = Partial<Record<AcquisitionMode, ModeSectionConfig>>

export interface FamilyConfig {
  familyId: string
  allowedSubtypes: AssetSubtype[]
  /** Fallback global — aplica a MRO, LICENSE y a EQUIPMENT cuando no hay sectionsByMode */
  visibleSections: FormSection[]
  requiredSections: FormSection[]
  requireFinancialForNew: boolean
  /** Config por modalidad para EQUIPMENT. Si está presente, tiene prioridad sobre visibleSections/requiredSections */
  sectionsByMode?: SectionsByMode
}

export const DEFAULT_MODE_CONFIG: ModeSectionConfig = {
  visible: ['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'STOCK_MRO', 'WAREHOUSE'],
  required: [],
}

export const DEFAULT_FAMILY_CONFIG: Omit<FamilyConfig, 'familyId'> = {
  allowedSubtypes: ['EQUIPMENT', 'MRO', 'LICENSE'],
  visibleSections: ['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'STOCK_MRO', 'WAREHOUSE'],
  requiredSections: [],
  requireFinancialForNew: true,
  sectionsByMode: undefined,
}

/**
 * Resuelve qué secciones son visibles/obligatorias para un equipo
 * según la modalidad de adquisición activa.
 * Prioridad: sectionsByMode[mode] > fallback global
 */
export function resolveSectionsForMode(
  config: FamilyConfig,
  mode: AcquisitionMode
): ModeSectionConfig {
  const byMode = config.sectionsByMode?.[mode]
  if (byMode) return byMode
  return {
    visible: config.visibleSections,
    required: config.requiredSections,
  }
}
