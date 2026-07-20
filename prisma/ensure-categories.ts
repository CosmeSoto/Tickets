/**
 * Seed idempotente de categorías de tickets.
 * Útil cuando la BD ya tiene usuarios (seed completo omitido) pero
 * categories quedó vacía tras un seed parcial o un rebuild sin --clean.
 *
 *   npm run db:seed-categories
 *   docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-categories.ts'
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

/** Sincroniza categories.family_id desde departments.family_id */
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
  return typeof result === 'number' ? result : 0
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

  if (before > 0) {
    const synced = await syncCategoryFamiliesFromDepartments(prisma)
    console.log(`✅ Categorías ya existen (${before}). familyId sincronizado: ${synced}`)
    return { before, after: before, synced }
  }

  console.log('📂 Categorías vacías — ejecutando seed de categorías por área...')
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
  const after = await prisma.categories.count()
  console.log(`✅ Categorías restauradas: ${before} → ${after} (familyId sync: ${synced})`)
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

main().catch(err => {
  console.error('❌ Error en ensure-categories:', err)
  process.exit(1)
})
