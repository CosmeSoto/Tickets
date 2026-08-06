/**
 * Integridad de FKs hacia `families` — independiente del seed/organigrama.
 *
 * Tras restore parcial pueden quedar UUIDs que ya no existen. Limpia de forma
 * genérica (familias iniciales o creadas después en la UI).
 * No inventa familyId por nombre de departamento.
 */

import type { PrismaClient } from '@prisma/client'

export type OrphanFamilyRepairStats = {
  departmentsCleared: number
  assignmentsDeleted: number
  technologyRemapped: number
}

const ASSIGNMENT_TABLES = ['user_family_access'] as const

/**
 * 1) Remapea TECHNOLOGY → ADMINISTRATIVE (regla legacy de producto).
 * 2) Pone NULL en departments.familyId huérfanos.
 * 3) Elimina filas de asignación cuyo familyId no exista.
 */
export async function repairOrphanFamilyForeignKeys(
  client: PrismaClient
): Promise<OrphanFamilyRepairStats> {
  let technologyRemapped = 0

  const [legacyTech, adminFamily] = await Promise.all([
    client.families.findUnique({ where: { code: 'TECHNOLOGY' }, select: { id: true } }),
    client.families.findUnique({
      where: { code: 'ADMINISTRATIVE' },
      select: { id: true, isActive: true },
    }),
  ])

  if (legacyTech && adminFamily?.isActive) {
    const remapped = await client.departments.updateMany({
      where: { familyId: legacyTech.id },
      data: { familyId: adminFamily.id },
    })
    technologyRemapped = remapped.count
  }

  const cleared = await client.$executeRawUnsafe(`
    UPDATE departments d
    SET "familyId" = NULL, "updatedAt" = NOW()
    WHERE d."familyId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM families f WHERE f.id = d."familyId")
  `)

  let assignmentsDeleted = 0
  for (const table of ASSIGNMENT_TABLES) {
    const deleted = await client.$executeRawUnsafe(`
      DELETE FROM "${table}" t
      WHERE NOT EXISTS (SELECT 1 FROM families f WHERE f.id = t."familyId")
    `)
    assignmentsDeleted += Number(deleted)
  }

  return {
    departmentsCleared: Number(cleared),
    assignmentsDeleted,
    technologyRemapped,
  }
}
