// Tipos y constantes puras — sin dependencias de servidor
// Importable tanto en cliente como en servidor

export type AssetSubtype = 'EQUIPMENT' | 'MRO' | 'LICENSE'
export type FormSection = 'FINANCIAL' | 'DEPRECIATION' | 'CONTRACT' | 'STOCK_MRO' | 'WAREHOUSE'

export interface FamilyConfig {
  familyId: string
  allowedSubtypes: AssetSubtype[]
  visibleSections: FormSection[]
  requiredSections: FormSection[]
  requireFinancialForNew: boolean
}

export const DEFAULT_FAMILY_CONFIG: Omit<FamilyConfig, 'familyId'> = {
  allowedSubtypes: ['EQUIPMENT', 'MRO', 'LICENSE'],
  visibleSections: ['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'STOCK_MRO', 'WAREHOUSE'],
  requiredSections: [],
  requireFinancialForNew: true,
}
