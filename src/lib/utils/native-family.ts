/**
 * Resuelve la familia nativa de un usuario a partir del departamento.
 * Unifica familiaId plano / family.id anidado y remapea TECHNOLOGY → ADMINISTRATIVE.
 */

export type NativeFamilyRef = {
  id: string
  name: string
  code: string
  color?: string | null
  isActive: boolean
}

type DeptLike = {
  id?: string
  familyId?: string | null
  family?: {
    id?: string | null
    name?: string | null
    code?: string | null
    color?: string | null
  } | null
} | null

function asNativeFamily(
  family:
    | {
        id: string
        name: string
        code: string
        color?: string | null
        isActive?: boolean
      }
    | null
    | undefined
): NativeFamilyRef | null {
  if (!family?.id || !family.name || !family.code) return null
  return {
    id: family.id,
    name: family.name,
    code: family.code,
    color: family.color ?? null,
    isActive: family.isActive ?? true,
  }
}

/** Si la familia es TECHNOLOGY (legacy), usa ADMINISTRATIVE si está en la lista. */
export function remapLegacyNativeFamily(
  family: NativeFamilyRef | null,
  families: NativeFamilyRef[]
): NativeFamilyRef | null {
  if (!family) return null
  if (family.code !== 'TECHNOLOGY') return family
  const admin = families.find(f => f.code === 'ADMINISTRATIVE')
  return admin ?? family
}

/**
 * Prioridad: departamento del formulario → departamento del usuario → lookup en listas.
 */
export function resolveNativeFamily(params: {
  departmentId?: string | null
  userDepartment?: DeptLike | string | null
  departments?: DeptLike[]
  families?: Array<{
    id: string
    name: string
    code: string
    color?: string | null
    isActive?: boolean
  }>
}): NativeFamilyRef | null {
  const normalizedFamilies = (params.families ?? [])
    .map(f => asNativeFamily(f))
    .filter((f): f is NativeFamilyRef => !!f)

  const deptFromForm =
    params.departmentId && params.departments?.length
      ? (params.departments.find(d => d?.id === params.departmentId) ?? null)
      : null

  const userDept =
    params.userDepartment && typeof params.userDepartment === 'object'
      ? params.userDepartment
      : null

  const dept = deptFromForm ?? userDept
  if (!dept) return null

  const familyId = dept.familyId ?? dept.family?.id ?? null

  const fromEmbedded = asNativeFamily(
    dept.family?.id && dept.family.name && dept.family.code
      ? {
          id: dept.family.id,
          name: dept.family.name,
          code: dept.family.code,
          color: dept.family.color,
          isActive: true,
        }
      : null
  )

  const fromList = familyId ? (normalizedFamilies.find(f => f.id === familyId) ?? null) : null

  return remapLegacyNativeFamily(fromEmbedded ?? fromList, normalizedFamilies)
}
