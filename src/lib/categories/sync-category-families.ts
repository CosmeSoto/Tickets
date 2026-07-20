/**
 * Sincroniza categories.familyId desde departments.familyId.
 * Corrige datos legacy donde la categoría tiene departamento pero family_id null/desfasado.
 */

import prisma from '@/lib/prisma'

export async function syncCategoryFamilyIdsForFamily(familyId: string): Promise<{
  departmentCount: number
  updated: number
  departmentIds: string[]
}> {
  const departments = await prisma.departments.findMany({
    where: { familyId },
    select: { id: true },
  })
  const departmentIds = departments.map(d => d.id)

  if (departmentIds.length === 0) {
    return { departmentCount: 0, updated: 0, departmentIds: [] }
  }

  const result = await prisma.categories.updateMany({
    where: {
      departmentId: { in: departmentIds },
      OR: [{ familyId: null }, { familyId: { not: familyId } }],
    },
    data: { familyId, updatedAt: new Date() },
  })

  return {
    departmentCount: departmentIds.length,
    updated: result.count,
    departmentIds,
  }
}

/**
 * Construye el where de categorías para una familia:
 * - familyId directo
 * - O departmentId en departamentos de esa familia
 */
export async function buildCategoryFamilyWhere(familyId: string): Promise<{
  whereOR: Array<Record<string, unknown>>
  departmentIds: string[]
  synced: number
}> {
  const sync = await syncCategoryFamilyIdsForFamily(familyId)

  const whereOR: Array<Record<string, unknown>> = [{ familyId }]
  if (sync.departmentIds.length > 0) {
    whereOR.push({ departmentId: { in: sync.departmentIds } })
  } else {
    // Fallback relación Prisma por si aún no hay IDs (no debería)
    whereOR.push({ departments: { familyId } })
  }

  return { whereOR, departmentIds: sync.departmentIds, synced: sync.updated }
}
