/**
 * Asegura que todos los departamentos tengan familyId según el organigrama.
 * Idempotente: seguro tras --clean incompleto o datos legacy ("Sin familia").
 *
 *   npm run db:seed-departments
 *   docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-departments.ts'
 */

import { PrismaClient } from '@prisma/client'
import { ORGANIGRAM_FAMILIES } from './seeds/family-map'
import {
  DEPARTMENT_SEEDS,
  DEPARTMENT_NAME_ALIASES,
  resolveDepartmentFamilyCode,
} from './seeds/department-family-map'
import { createHash } from 'crypto'

function deterministicUUID(namespace: string, name: string): string {
  const hash = createHash('sha256').update(`${namespace}:${name}`).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-')
}

async function buildFamilyMap(prisma: PrismaClient): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const f of ORGANIGRAM_FAMILIES) {
    const family = await prisma.families.findUnique({ where: { code: f.code } })
    if (family) map.set(f.code, family.id)
  }
  return map
}

export async function ensureDepartments(prisma: PrismaClient): Promise<{
  upserted: number
  linked: number
  renamed: number
  merged: number
}> {
  const familyMap = await buildFamilyMap(prisma)
  if (familyMap.size === 0) {
    throw new Error('No hay familias en la BD. Ejecuta primero: npm run db:seed')
  }

  const now = new Date()
  let upserted = 0
  let linked = 0
  let renamed = 0
  let merged = 0

  // 1) Upsert canónicos con familyId
  for (const dept of DEPARTMENT_SEEDS) {
    const familyId = familyMap.get(dept.familyCode)
    if (!familyId) continue

    await prisma.departments.upsert({
      where: { name: dept.name },
      update: {
        description: dept.description,
        color: dept.color,
        order: dept.order,
        familyId,
        isActive: true,
        updatedAt: now,
      },
      create: {
        id: deterministicUUID('department', dept.name),
        name: dept.name,
        description: dept.description,
        color: dept.color,
        order: dept.order,
        familyId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    })
    upserted++
  }

  // 2) Renombrar / fusionar alias legacy → canónico
  for (const [alias, canonical] of Object.entries(DEPARTMENT_NAME_ALIASES)) {
    if (alias === canonical) continue
    const aliasDept = await prisma.departments.findUnique({ where: { name: alias } })
    if (!aliasDept) continue

    const canonicalDept = await prisma.departments.findUnique({ where: { name: canonical } })
    if (canonicalDept) {
      // Fusionar: mover usuarios y categorías al canónico, desactivar alias
      await prisma.users.updateMany({
        where: { departmentId: aliasDept.id },
        data: { departmentId: canonicalDept.id },
      })
      await prisma.categories.updateMany({
        where: { departmentId: aliasDept.id },
        data: { departmentId: canonicalDept.id, familyId: canonicalDept.familyId },
      })
      await prisma.departments.update({
        where: { id: aliasDept.id },
        data: {
          isActive: false,
          familyId: canonicalDept.familyId,
          description: `Fusionado en "${canonical}" (legacy: ${alias})`,
          updatedAt: now,
        },
      })
      merged++
      console.log(`  → Fusionado "${alias}" → "${canonical}"`)
    } else {
      await prisma.departments.update({
        where: { id: aliasDept.id },
        data: { name: canonical, updatedAt: now },
      })
      renamed++
      console.log(`  → Renombrado "${alias}" → "${canonical}"`)
    }
  }

  // 3) Enlazar huérfanos / corregir familyId según mapa canónico + heurística
  const orphanCount = await prisma.departments.count({ where: { familyId: null } })
  const allDepts = await prisma.departments.findMany({
    select: { id: true, name: true, familyId: true },
  })

  for (const dept of allDepts) {
    const code = resolveDepartmentFamilyCode(dept.name)
    if (!code) continue
    const familyId = familyMap.get(code)
    if (!familyId) continue
    if (dept.familyId === familyId) continue

    await prisma.departments.update({
      where: { id: dept.id },
      data: { familyId, updatedAt: now },
    })
    linked++
  }

  // Sync categorías desde departamentos
  const cats = await prisma.$executeRaw`
    UPDATE categories c
    SET family_id = d.family_id,
        "updatedAt" = NOW()
    FROM departments d
    WHERE c."departmentId" = d.id
      AND d.family_id IS NOT NULL
      AND (c.family_id IS NULL OR c.family_id <> d.family_id)
  `

  console.log(
    `✅ Departamentos: upsert=${upserted}, linked=${linked}, renamed=${renamed}, merged=${merged}, catSync=${cats}`
  )
  console.log(`   Huérfanos (familyId null) antes de enlazar: ${orphanCount}`)

  return { upserted, linked, renamed, merged }
}

async function main() {
  const prisma = new PrismaClient()
  try {
    await ensureDepartments(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error('❌ Error en ensure-departments:', err)
  process.exit(1)
})
