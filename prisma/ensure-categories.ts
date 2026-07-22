/**
 * Seed idempotente de categorías de tickets.
 *
 *   npm run db:seed-categories
 *   docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-categories.ts'
 *
 * Nota: este script corre fuera del bundle Next; el sync SQL se duplica aquí
 * (misma query que syncAllCategoryFamilyIdsFromDepartments) para no depender
 * del path alias @/lib en tsx prisma/*.
 */

import { PrismaClient } from '@prisma/client'
import { seedCategoriesTechnology } from './seeds/categories-technology.seed'
import { seedCategoriesArchitecture } from './seeds/categories-architecture.seed'
import { seedCategoriesMaintenance } from './seeds/categories-maintenance.seed'
import { seedCategoriesServices } from './seeds/categories-services.seed'
import { seedCategoriesSecurity } from './seeds/categories-security.seed'
import { seedCategoriesGreenAreas } from './seeds/categories-green-areas.seed'
import { seedCategoriesAdministrative } from './seeds/categories-administrative.seed'
import { seedCategoriesCommercial } from './seeds/categories-commercial.seed'

async function buildDeptMap(prisma: PrismaClient): Promise<Map<string, string>> {
  const depts = await prisma.departments.findMany({ select: { id: true, name: true } })
  return new Map(depts.map(d => [d.name, d.id]))
}

/** Misma semántica que src/lib/categories/sync-category-families.ts */
export async function syncCategoryFamiliesFromDepartments(prisma: PrismaClient): Promise<number> {
  const result = await prisma.$executeRaw`
    UPDATE categories c
    SET family_id = d.family_id,
        "updatedAt" = NOW()
    FROM departments d
    WHERE c."departmentId" = d.id
      AND d.family_id IS NOT NULL
      AND (c.family_id IS NULL OR c.family_id <> d.family_id)
  `
  return typeof result === 'number' ? result : Number(result) || 0
}

export async function ensureTicketCategories(prisma: PrismaClient): Promise<{
  before: number
  after: number
  synced: number
}> {
  const before = await prisma.categories.count()
  const deptCount = await prisma.departments.count()

  if (deptCount === 0) {
    throw new Error(
      'No hay departamentos en la BD. Ejecuta primero el seed completo: npm run db:seed'
    )
  }

  console.log(
    before === 0
      ? '📂 Categorías vacías — ejecutando seed de categorías por área...'
      : `📂 Sincronizando categorías (${before} existentes, upsert idempotente)...`
  )
  const deptMap = await buildDeptMap(prisma)

  await seedCategoriesTechnology(prisma, deptMap)
  await seedCategoriesAdministrative(prisma, deptMap)
  await seedCategoriesCommercial(prisma, deptMap)
  await seedCategoriesArchitecture(prisma, deptMap)
  await seedCategoriesMaintenance(prisma, deptMap)
  await seedCategoriesSecurity(prisma, deptMap)
  await seedCategoriesGreenAreas(prisma, deptMap)
  await seedCategoriesServices(prisma, deptMap)

  const synced = await syncCategoryFamiliesFromDepartments(prisma)

  // Categorías de departamentos fusionados/inactivos: ocultar (no borrar historial)
  const hidden = await prisma.categories.updateMany({
    where: {
      isActive: true,
      departments: { isActive: false },
    },
    data: { isActive: false, updatedAt: new Date() },
  })
  if (hidden.count > 0) {
    console.log(`  → ${hidden.count} categoría(s) de depts inactivos ocultadas`)
  }

  const after = await prisma.categories.count()
  console.log(`✅ Categorías: ${before} → ${after} (familyId sync: ${synced})`)
  return { before, after, synced }
}

async function main() {
  const prisma = new PrismaClient()
  try {
    await ensureTicketCategories(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

const isDirectRun =
  typeof process !== 'undefined' && (process.argv[1]?.includes('ensure-categories') ?? false)

if (isDirectRun) {
  main().catch(err => {
    console.error('❌ Error en ensure-categories:', err)
    process.exit(1)
  })
}
