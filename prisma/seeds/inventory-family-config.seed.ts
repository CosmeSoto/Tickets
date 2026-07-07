import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const FAMILY_CONFIGS: Record<
  string,
  { allowedSubtypes: string[]; visibleSections: string[]; requiredSections: string[] }
> = {
  ADMINISTRATIVE: {
    allowedSubtypes: ['EQUIPMENT', 'LICENSE'],
    visibleSections: ['FINANCIAL', 'CONTRACT'],
    requiredSections: [],
  },
  COMMERCIAL: {
    allowedSubtypes: ['EQUIPMENT', 'LICENSE'],
    visibleSections: ['FINANCIAL', 'DEPRECIATION', 'CONTRACT'],
    requiredSections: ['FINANCIAL'],
  },
  MARKETING: {
    allowedSubtypes: ['EQUIPMENT', 'LICENSE'],
    visibleSections: ['FINANCIAL', 'DEPRECIATION', 'CONTRACT'],
    requiredSections: ['FINANCIAL'],
  },
  ARCHITECTURE: {
    allowedSubtypes: ['EQUIPMENT', 'LICENSE', 'MRO'],
    visibleSections: ['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'WAREHOUSE'],
    requiredSections: ['FINANCIAL', 'DEPRECIATION'],
  },
  OPERATIONS: {
    allowedSubtypes: ['EQUIPMENT', 'MRO', 'LICENSE'],
    visibleSections: ['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'STOCK_MRO', 'WAREHOUSE'],
    requiredSections: ['FINANCIAL'],
  },
  TECHNOLOGY: {
    allowedSubtypes: ['EQUIPMENT', 'LICENSE', 'MRO'],
    visibleSections: ['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'WAREHOUSE'],
    requiredSections: ['FINANCIAL'],
  },
}

export async function seedInventoryFamilyConfigs(
  prisma: PrismaClient,
  familyMap: Map<string, string>
) {
  for (const [code, cfg] of Object.entries(FAMILY_CONFIGS)) {
    const familyId = familyMap.get(code)
    if (!familyId) continue

    await prisma.inventory_family_config.upsert({
      where: { familyId },
      update: {
        allowedSubtypes: cfg.allowedSubtypes as any,
        visibleSections: cfg.visibleSections as any,
        requiredSections: cfg.requiredSections as any,
      },
      create: {
        id: randomUUID(),
        familyId,
        allowedSubtypes: cfg.allowedSubtypes as any,
        visibleSections: cfg.visibleSections as any,
        requiredSections: cfg.requiredSections as any,
        requireFinancialForNew: true,
        autoApproveDecommission: false,
        requireDeliveryAct: true,
      },
    })
  }
  console.log('✅ Configuraciones de inventario por familia')
}
