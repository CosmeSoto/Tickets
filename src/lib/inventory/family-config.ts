// Configuración por defecto para familias de inventario
// SOLO constantes y funciones puras — sin dependencias de servidor
// Importable tanto en cliente como en servidor

import type { FamilyConfig } from './family-config-types'

export const DEFAULT_FAMILY_CONFIG: Omit<FamilyConfig, 'familyId'> = {
  allowedSubtypes: ['EQUIPMENT', 'MRO', 'LICENSE'],
  visibleSections: ['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'STOCK_MRO', 'WAREHOUSE'],
  requiredSections: [],
  requireFinancialForNew: true,
  sectionsByMode: undefined,
}

/**
 * Valida si un subtipo de activo está permitido para una familia
 */
export function validateSubtypeForFamily(
  subtype: string,
  config: FamilyConfig
): { valid: boolean; error?: string } {
  if (!config.allowedSubtypes.includes(subtype)) {
    return {
      valid: false,
      error: `El tipo de activo "${subtype}" no está permitido para esta área`,
    }
  }
  return { valid: true }
}

/**
 * Obtiene la configuración de inventario para una familia desde la DB.
 * SOLO para uso en servidor (API routes, server actions).
 * Importa prisma de forma lazy para no contaminar el bundle del cliente.
 */
export async function getFamilyConfig(familyId: string): Promise<FamilyConfig> {
  const { prisma } = await import('@/lib/prisma')
  const config = await prisma.inventory_family_config.findUnique({
    where: { familyId },
  })

  if (!config) {
    return { familyId, ...DEFAULT_FAMILY_CONFIG }
  }

  return {
    familyId: config.familyId,
    allowedSubtypes: config.allowedSubtypes as string[],
    visibleSections: config.visibleSections as string[],
    requiredSections: config.requiredSections as string[],
    requireFinancialForNew: config.requireFinancialForNew,
    sectionsByMode: config.sectionsByMode as any,
    defaultDepreciationMethod: config.defaultDepreciationMethod,
    defaultUsefulLifeYears: config.defaultUsefulLifeYears,
    defaultResidualValuePct: config.defaultResidualValuePct,
    codePrefix: config.codePrefix,
    autoApproveDecommission: config.autoApproveDecommission,
    requireDeliveryAct: config.requireDeliveryAct,
  }
}

export * from './family-config-types'
