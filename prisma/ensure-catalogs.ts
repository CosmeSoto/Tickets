/**
 * Seed idempotente de catálogos de inventario (tipos, marcas, bodegas, atributos).
 * Ejecutar cuando la BD ya tiene usuarios pero faltan datos de inventario.
 *
 *   npm run db:seed-catalogs
 *   docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-catalogs.ts'
 */

import { PrismaClient } from '@prisma/client'
import { ORGANIGRAM_FAMILIES } from './seeds/family-map'
import { seedInventoryTypes } from './seeds/inventory-types.seed'
import { seedEquipmentBrands, syncBrandFamilies } from './seeds/equipment-brands.seed'
import { seedWarehouses } from './seeds/warehouses.seed'
import { seedAttributes } from './seeds/attributes.seed'
import { seedSupplierTypes } from './seeds/supplier-types.seed'
import { seedContractServiceTypes } from './seeds/contract-service-types.seed'
import { seedAssetRequestsFamilySettings } from './seeds/asset-requests-settings.seed'
import { seedInventoryFamilyConfigs } from './seeds/inventory-family-config.seed'
import { seedUnitsOfMeasure } from './seeds/units-of-measure.seed'
import { seedInventorySettings, seedFolioCounters } from './seeds/inventory-settings.seed'

async function buildFamilyMap(prisma: PrismaClient): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const f of ORGANIGRAM_FAMILIES) {
    const family = await prisma.families.findUnique({ where: { code: f.code } })
    if (family) map.set(f.code, family.id)
  }
  return map
}

export async function ensureInventoryCatalogs(prisma: PrismaClient) {
  const familyMap = await buildFamilyMap(prisma)
  if (familyMap.size === 0) {
    throw new Error('No hay familias en la BD. Ejecuta primero: npm run db:seed')
  }

  console.log('📦 Asegurando catálogos de inventario...')
  await seedInventoryFamilyConfigs(prisma, familyMap)
  await seedInventoryTypes(prisma, familyMap)
  await seedEquipmentBrands(prisma, familyMap)
  await syncBrandFamilies(prisma, familyMap)
  await seedWarehouses(prisma, familyMap)
  await seedAttributes(prisma, familyMap)
  await seedSupplierTypes(prisma, familyMap)
  await seedContractServiceTypes(prisma)
  await seedAssetRequestsFamilySettings(prisma, familyMap)
  await seedUnitsOfMeasure(prisma)
  await seedInventorySettings(prisma)
  await seedFolioCounters(prisma)
  console.log('✅ Catálogos de inventario listos')
}

async function main() {
  const prisma = new PrismaClient()
  try {
    await ensureInventoryCatalogs(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error('❌ Error en ensure-catalogs:', err)
  process.exit(1)
})
