/**
 * Asegura familias + departamentos según organigrama PSF (5 familias).
 * - Absorbe familia legacy TECHNOLOGY → ADMINISTRATIVE
 * - Fusiona alias de departamentos (p.ej. Mantenimiento Civil → Mantenimiento)
 * - Ningún departamento activo debe quedar sin familyId
 *
 *   npm run db:seed-departments
 */

import { PrismaClient } from '@prisma/client'
import { ORGANIGRAM_FAMILIES, LEGACY_TECHNOLOGY_FAMILY_CODE } from './seeds/family-map'
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
  const now = new Date()

  for (const f of ORGANIGRAM_FAMILIES) {
    const family = await prisma.families.upsert({
      where: { code: f.code },
      update: {
        name: f.name,
        icon: f.icon,
        color: f.color,
        order: f.order,
        isActive: true,
        updatedAt: now,
      },
      create: {
        id: deterministicUUID('family', f.code),
        code: f.code,
        name: f.name,
        icon: f.icon,
        color: f.color,
        order: f.order,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    })
    map.set(f.code, family.id)
  }

  return map
}

/** Remapea familyId TECHNOLOGY → ADMINISTRATIVE en tablas clave y desactiva TECHNOLOGY. */
async function absorbTechnologyFamily(
  prisma: PrismaClient,
  adminFamilyId: string
): Promise<number> {
  const tech = await prisma.families.findUnique({
    where: { code: LEGACY_TECHNOLOGY_FAMILY_CODE },
  })
  if (!tech || tech.id === adminFamilyId) return 0

  const fromId = tech.id
  const toId = adminFamilyId
  let touched = 0

  const remaps: Array<{ label: string; run: () => Promise<number> }> = [
    {
      label: 'departments',
      run: async () =>
        (
          await prisma.departments.updateMany({
            where: { familyId: fromId },
            data: { familyId: toId },
          })
        ).count,
    },
    {
      label: 'categories',
      run: async () =>
        (
          await prisma.categories.updateMany({
            where: { familyId: fromId },
            data: { familyId: toId },
          })
        ).count,
    },
    {
      label: 'tickets',
      run: async () =>
        (await prisma.tickets.updateMany({ where: { familyId: fromId }, data: { familyId: toId } }))
          .count,
    },
    {
      label: 'knowledge_articles',
      run: async () =>
        (
          await prisma.knowledge_articles.updateMany({
            where: { familyId: fromId },
            data: { familyId: toId },
          })
        ).count,
    },
  ]

  for (const step of remaps) {
    try {
      const n = await step.run()
      touched += n
      if (n > 0) console.log(`  → ${step.label}: ${n} filas TECHNOLOGY → ADMINISTRATIVE`)
    } catch (e: any) {
      console.warn(`  ⚠ No se pudo remapear ${step.label}:`, e?.message ?? e)
    }
  }

  // Inventario / configs — best-effort
  try {
    touched += (
      await prisma.equipment_types.updateMany({
        where: { familyId: fromId },
        data: { familyId: toId },
      })
    ).count
  } catch (e: any) {
    console.warn('  ⚠ equipment_types:', e?.message ?? e)
  }
  try {
    touched += (
      await prisma.license_types.updateMany({
        where: { familyId: fromId },
        data: { familyId: toId },
      })
    ).count
  } catch (e: any) {
    console.warn('  ⚠ license_types:', e?.message ?? e)
  }
  try {
    touched += (
      await prisma.consumable_types.updateMany({
        where: { familyId: fromId },
        data: { familyId: toId },
      })
    ).count
  } catch (e: any) {
    console.warn('  ⚠ consumable_types:', e?.message ?? e)
  }
  try {
    touched += (
      await prisma.equipment_brands.updateMany({
        where: { familyId: fromId },
        data: { familyId: toId },
      })
    ).count
  } catch (e: any) {
    console.warn('  ⚠ equipment_brands:', e?.message ?? e)
  }
  try {
    touched += (
      await prisma.warehouses.updateMany({ where: { familyId: fromId }, data: { familyId: toId } })
    ).count
  } catch (e: any) {
    console.warn('  ⚠ warehouses:', e?.message ?? e)
  }
  try {
    touched += (
      await prisma.sla_policies.updateMany({
        where: { familyId: fromId },
        data: { familyId: toId },
      })
    ).count
  } catch (e: any) {
    console.warn('  ⚠ sla_policies:', e?.message ?? e)
  }

  // Configs 1:1 — mover o eliminar TECHNOLOGY y dejar ADMIN
  try {
    const techTicketCfg = await prisma.ticket_family_config.findUnique({
      where: { familyId: fromId },
    })
    const adminTicketCfg = await prisma.ticket_family_config.findUnique({
      where: { familyId: toId },
    })
    if (techTicketCfg && !adminTicketCfg) {
      await prisma.ticket_family_config.update({
        where: { familyId: fromId },
        data: { familyId: toId, codePrefix: 'ADM', isDefault: true },
      })
    } else if (techTicketCfg && adminTicketCfg) {
      await prisma.ticket_family_config.delete({ where: { familyId: fromId } })
      await prisma.ticket_family_config.update({
        where: { familyId: toId },
        data: { isDefault: true, ticketsEnabled: true },
      })
    }
  } catch (e: any) {
    console.warn('  ⚠ ticket_family_config:', e?.message ?? e)
  }

  try {
    const techInv = await prisma.inventory_family_config.findUnique({ where: { familyId: fromId } })
    const adminInv = await prisma.inventory_family_config.findUnique({ where: { familyId: toId } })
    if (techInv && !adminInv) {
      await prisma.inventory_family_config.update({
        where: { familyId: fromId },
        data: { familyId: toId },
      })
    } else if (techInv && adminInv) {
      await prisma.inventory_family_config.delete({ where: { familyId: fromId } })
    }
  } catch (e: any) {
    console.warn('  ⚠ inventory_family_config:', e?.message ?? e)
  }

  // Asignaciones unificadas user_family_access
  try {
    const rows = await prisma.user_family_access.findMany({
      where: { familyId: fromId },
      select: { id: true, userId: true, module: true },
    })
    for (const row of rows) {
      const exists = await prisma.user_family_access.findFirst({
        where: { userId: row.userId, familyId: toId, module: row.module },
      })
      if (exists) {
        await prisma.user_family_access.delete({ where: { id: row.id } })
      } else {
        await prisma.user_family_access.update({
          where: { id: row.id },
          data: { familyId: toId },
        })
      }
    }
  } catch (e: any) {
    console.warn('  ⚠ user_family_access:', e?.message ?? e)
  }

  await prisma.families.update({
    where: { id: fromId },
    data: {
      isActive: false,
      name: 'Tecnología y Comunicaciones (legacy → Administración)',
      updatedAt: new Date(),
    },
  })
  console.log('  → Familia TECHNOLOGY desactivada (absorbida por Administración)')

  return touched
}

async function mergeDepartmentAlias(
  prisma: PrismaClient,
  aliasName: string,
  canonicalName: string,
  familyId: string
): Promise<'merged' | 'renamed' | 'skip'> {
  const aliasDept = await prisma.departments.findUnique({ where: { name: aliasName } })
  if (!aliasDept) return 'skip'

  const canonicalDept = await prisma.departments.findUnique({ where: { name: canonicalName } })
  const now = new Date()

  if (canonicalDept && canonicalDept.id !== aliasDept.id) {
    await prisma.users.updateMany({
      where: { departmentId: aliasDept.id },
      data: { departmentId: canonicalDept.id },
    })
    await prisma.categories.updateMany({
      where: { departmentId: aliasDept.id },
      data: { departmentId: canonicalDept.id, familyId: canonicalDept.familyId ?? familyId },
    })
    try {
      await (prisma as any).equipment?.updateMany?.({
        where: { departmentId: aliasDept.id },
        data: { departmentId: canonicalDept.id },
      })
    } catch {
      /* optional */
    }
    await prisma.departments.update({
      where: { id: aliasDept.id },
      data: {
        isActive: false,
        familyId: canonicalDept.familyId ?? familyId,
        description: `Fusionado en "${canonicalName}" (legacy: ${aliasName})`,
        updatedAt: now,
      },
    })
    return 'merged'
  }

  if (!canonicalDept) {
    await prisma.departments.update({
      where: { id: aliasDept.id },
      data: { name: canonicalName, familyId, updatedAt: now },
    })
    return 'renamed'
  }

  return 'skip'
}

export async function ensureDepartments(prisma: PrismaClient): Promise<{
  upserted: number
  linked: number
  renamed: number
  merged: number
  techAbsorbed: number
}> {
  const familyMap = await buildFamilyMap(prisma)
  const adminFamilyId = familyMap.get('ADMINISTRATIVE')
  if (!adminFamilyId) {
    throw new Error('No se pudo crear/obtener familia ADMINISTRATIVE')
  }

  console.log('🔄 Absorbiendo familia legacy TECHNOLOGY (si existe)...')
  const techAbsorbed = await absorbTechnologyFamily(prisma, adminFamilyId)

  const now = new Date()
  let upserted = 0
  let linked = 0
  let renamed = 0
  let merged = 0

  // Upsert canónicos
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

  // Alias → canónico
  for (const [alias, canonical] of Object.entries(DEPARTMENT_NAME_ALIASES)) {
    if (alias === canonical) continue
    const code = resolveDepartmentFamilyCode(canonical)
    const familyId = code ? familyMap.get(code) : undefined
    if (!familyId) continue
    const result = await mergeDepartmentAlias(prisma, alias, canonical, familyId)
    if (result === 'merged') {
      merged++
      console.log(`  → Fusionado "${alias}" → "${canonical}"`)
    } else if (result === 'renamed') {
      renamed++
      console.log(`  → Renombrado "${alias}" → "${canonical}"`)
    }
  }

  // Enlazar / corregir familyId (incluye FKs rotos: familyId apunta a familia inexistente)
  const orphanCount = await prisma.departments.count({ where: { familyId: null } })
  const existingFamilyIds = new Set(
    (await prisma.families.findMany({ select: { id: true } })).map(f => f.id)
  )
  const allDepts = await prisma.departments.findMany({
    select: { id: true, name: true, familyId: true },
  })

  let brokenFk = 0
  for (const dept of allDepts) {
    const code = resolveDepartmentFamilyCode(dept.name)
    if (!code) continue
    const familyId = familyMap.get(code)
    if (!familyId) continue
    const fkBroken = !!dept.familyId && !existingFamilyIds.has(dept.familyId)
    if (fkBroken) brokenFk++
    if (dept.familyId === familyId) continue
    await prisma.departments.update({
      where: { id: dept.id },
      data: { familyId, updatedAt: now },
    })
    linked++
  }

  if (brokenFk > 0) {
    console.log(`   → Reparados ${brokenFk} departamentos con familyId huérfano (FK inválido)`)
  }

  const cats = await prisma.$executeRaw`
    UPDATE categories c
    SET family_id = d.family_id,
        "updatedAt" = NOW()
    FROM departments d
    WHERE c."departmentId" = d.id
      AND d.family_id IS NOT NULL
      AND (c.family_id IS NULL OR c.family_id <> d.family_id)
  `

  const remainingOrphans = await prisma.departments.count({
    where: { familyId: null, isActive: true },
  })

  console.log(
    `✅ Departamentos: upsert=${upserted}, linked=${linked}, renamed=${renamed}, merged=${merged}, techAbsorbed=${techAbsorbed}, catSync=${cats}`
  )
  console.log(
    `   Huérfanos activos (familyId null): ${remainingOrphans} (antes enlace: ${orphanCount})`
  )

  if (remainingOrphans > 0) {
    const list = await prisma.departments.findMany({
      where: { familyId: null, isActive: true },
      select: { name: true },
    })
    console.warn('   ⚠ Revisar manualmente:', list.map(d => d.name).join(', '))
  }

  return { upserted, linked, renamed, merged, techAbsorbed }
}

async function main() {
  const prisma = new PrismaClient()
  try {
    await ensureDepartments(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

const isDirectRun =
  typeof process !== 'undefined' && (process.argv[1]?.includes('ensure-departments') ?? false)

if (isDirectRun) {
  main().catch(err => {
    console.error('❌ Error en ensure-departments:', err)
    process.exit(1)
  })
}
