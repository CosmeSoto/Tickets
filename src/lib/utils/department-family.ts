/**
 * Helpers para filtrar/agrupar departamentos por familia.
 * Algunos payloads traen familyId plano; otros solo family.id.
 */

export function getDepartmentFamilyId(dept: {
  familyId?: string | null
  family?: { id?: string | null } | null
}): string | null {
  return dept.familyId ?? dept.family?.id ?? null
}

export function departmentBelongsToFamily(
  dept: {
    familyId?: string | null
    family?: { id?: string | null } | null
  },
  familyId: string | null | undefined
): boolean {
  if (!familyId) return true
  return getDepartmentFamilyId(dept) === familyId
}

/**
 * Une departamentos de la API con los referenciados por categorías del área.
 * Cubre casos donde familyId viene desfasado o el listado de /api/departments está incompleto.
 */
export function mergeDepartmentsForFamily<
  T extends { id: string; name: string; familyId?: string | null; family?: any; color?: string },
>(params: {
  familyId: string | null | undefined
  departments: T[]
  categorySources?: Array<{
    familyId?: string | null
    family?: { id?: string | null } | null
    departmentId?: string | null
    departments?: { id?: string; name?: string; color?: string; familyId?: string | null } | null
    department?: { id?: string; name?: string; color?: string; familyId?: string | null } | null
  }>
  familyMeta?: { id: string; name?: string; color?: string | null } | null
}): Array<T | Record<string, unknown>> {
  const { familyId, departments, categorySources = [], familyMeta } = params
  const map = new Map<string, any>()

  for (const d of departments) {
    if (!familyId || departmentBelongsToFamily(d, familyId)) {
      if (d.id && d.name) map.set(d.id, d)
    }
  }

  if (familyId) {
    for (const cat of categorySources) {
      const catFamilyId =
        cat.familyId ?? cat.family?.id ?? cat.departments?.familyId ?? cat.department?.familyId
      if (catFamilyId && catFamilyId !== familyId) continue

      const id = cat.departmentId ?? cat.departments?.id ?? cat.department?.id
      const name = cat.departments?.name ?? cat.department?.name
      if (!id || !name || map.has(id)) continue

      map.set(id, {
        id,
        name,
        color: cat.departments?.color ?? cat.department?.color ?? '#6B7280',
        isActive: true,
        familyId,
        family: familyMeta
          ? { id: familyMeta.id, name: familyMeta.name, color: familyMeta.color ?? null }
          : { id: familyId, name: 'Familia' },
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))
}
