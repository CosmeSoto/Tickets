/**
 * Helper centralizado para determinar el scope de familias de cualquier usuario.
 *
 * Para reglas por capas (nativa / consumer / operational / visibility) ver family-scope.ts.
 *
 * getUserFamilyScope = visibilidad legacy (nativa + asignaciones del rol).
 * Módulos específicos: inventario → inventory_manager_families; rondas → patrol_family_assignments.
 */

import prisma from '@/lib/prisma'

export interface UserScope {
  /** IDs de familias accesibles. undefined = sin restricción (super admin) */
  familyIds: string[] | undefined
  /** Familia nativa del departamento del usuario */
  nativeFamilyId: string | null
  /** Si es super admin */
  isSuperAdmin: boolean
  /** Rol del usuario */
  role: string
}

/**
 * Obtiene el scope de familias para cualquier usuario.
 * Retorna undefined en familyIds si es super admin (acceso total).
 */
export async function getUserFamilyScope(
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<UserScope> {
  if (role === 'ADMIN' && isSuperAdmin) {
    return { familyIds: undefined, nativeFamilyId: null, isSuperAdmin: true, role }
  }

  // Obtener familia nativa del departamento
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { departments: { select: { familyId: true } } },
  })
  const nativeFamilyId = user?.departments?.familyId ?? null

  let assignedIds: string[] = []

  if (role === 'ADMIN') {
    // Admin normal: su scope general se define por admin_family_assignments + nativa
    // Esto controla: qué familias ve en la sección Familias, Usuarios, Departamentos, etc.
    // Las familias de inventario/rondas son para filtrar DENTRO de cada módulo específico
    const assignments = await prisma.admin_family_assignments.findMany({
      where: { adminId: userId, isActive: true },
      select: { familyId: true },
    })
    assignedIds = assignments.map(a => a.familyId)
  } else if (role === 'TECHNICIAN') {
    const assignments = await prisma.technician_family_assignments.findMany({
      where: { technicianId: userId, isActive: true },
      select: { familyId: true },
    })
    assignedIds = assignments.map(a => a.familyId)
  } else if (role === 'CLIENT') {
    const assignments = await prisma.client_family_assignments.findMany({
      where: { clientId: userId, isActive: true },
      select: { familyId: true },
    })
    assignedIds = assignments.map(a => a.familyId)
  }

  // Combinar: asignadas + nativa (sin duplicados)
  const familyIds = [...assignedIds]
  if (nativeFamilyId && !familyIds.includes(nativeFamilyId)) {
    familyIds.push(nativeFamilyId)
  }

  return { familyIds, nativeFamilyId, isSuperAdmin: false, role }
}

// ── Alias para compatibilidad con código existente ──

/** @deprecated Usar getUserFamilyScope en su lugar */
export async function getAdminFamilyScope(
  userId: string,
  isSuperAdmin: boolean
): Promise<{ familyIds: string[] | undefined; isSuperAdmin: boolean }> {
  const scope = await getUserFamilyScope(userId, 'ADMIN', isSuperAdmin)
  return { familyIds: scope.familyIds, isSuperAdmin: scope.isSuperAdmin }
}

// ── Helpers de filtrado ──

/**
 * Construye un filtro Prisma `where` para familyId basado en el scope.
 * Si familyIds es undefined (super admin), no agrega filtro.
 */
export function buildFamilyFilter(
  scope: UserScope | { familyIds: string[] | undefined }
): Record<string, any> {
  if (scope.familyIds === undefined) return {}
  if (scope.familyIds.length === 0) return { familyId: '__NONE__' }
  return { familyId: { in: scope.familyIds } }
}

/**
 * Obtiene los IDs de departamentos que pertenecen a las familias del scope.
 * Útil para filtrar usuarios por departamento.
 */
export async function getDepartmentIdsForScope(
  scope: UserScope | { familyIds: string[] | undefined }
): Promise<string[] | undefined> {
  if (scope.familyIds === undefined) return undefined

  const departments = await prisma.departments.findMany({
    where: { familyId: { in: scope.familyIds }, isActive: true },
    select: { id: true },
  })
  return departments.map(d => d.id)
}

/**
 * Obtiene familias de un módulo específico para un usuario.
 * Combina la asignación del módulo + familia nativa.
 */
export async function getModuleFamilyIds(
  userId: string,
  module: 'inventory' | 'patrols'
): Promise<string[]> {
  let assignedIds: string[] = []

  if (module === 'inventory') {
    const assignments = await prisma.inventory_manager_families.findMany({
      where: { managerId: userId },
      select: { familyId: true },
    })
    assignedIds = assignments.map(a => a.familyId)
  } else if (module === 'patrols') {
    const assignments = await prisma.patrol_family_assignments.findMany({
      where: { userId, isActive: true },
      select: { familyId: true },
    })
    assignedIds = assignments.map(a => a.familyId)
  }

  // Agregar familia nativa
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { departments: { select: { familyId: true } } },
  })
  const nativeFamilyId = user?.departments?.familyId
  if (nativeFamilyId && !assignedIds.includes(nativeFamilyId)) {
    assignedIds.push(nativeFamilyId)
  }

  return assignedIds
}

/**
 * Departamentos visibles para un admin no-super (Union_Scope: tickets + inventario + rondas).
 * undefined = sin restricción (super admin). [] = sin acceso a ningún usuario.
 */
export async function getAdminUnionDepartmentIds(
  adminId: string,
  isSuperAdmin: boolean
): Promise<string[] | undefined> {
  if (isSuperAdmin) return undefined

  const scope = await getAdminFamilyScope(adminId, false)
  const unionSet = new Set<string>(scope.familyIds ?? [])
  for (const id of await getModuleFamilyIds(adminId, 'inventory')) unionSet.add(id)
  for (const id of await getModuleFamilyIds(adminId, 'patrols')) unionSet.add(id)

  if (unionSet.size === 0) return []

  return (await getDepartmentIdsForScope({ familyIds: Array.from(unionSet) })) ?? []
}

/** Filtro Prisma de tickets para admin no-super (visibilidad en dashboard). */
export async function getAdminTicketFamilyFilter(
  adminId: string,
  isSuperAdmin: boolean
): Promise<Record<string, unknown>> {
  if (isSuperAdmin) return {}
  const { getTicketVisibilityFamilyIds } = await import('@/lib/auth/family-scope')
  const visibilityIds = await getTicketVisibilityFamilyIds(adminId, 'ADMIN', false)
  return buildFamilyFilter({ familyIds: visibilityIds })
}

export type AdminUserScopeResult =
  | { allowed: true }
  | { allowed: false; status: number; error: string }

/** Valida que un admin no-super pueda ver/editar/eliminar un usuario objetivo. */
export async function assertAdminCanManageUser(
  adminId: string,
  isSuperAdmin: boolean,
  targetUserId: string
): Promise<AdminUserScopeResult> {
  if (isSuperAdmin || adminId === targetUserId) return { allowed: true }

  const deptIds = await getAdminUnionDepartmentIds(adminId, false)
  if (deptIds === undefined) return { allowed: true }
  if (deptIds.length === 0) {
    return { allowed: false, status: 403, error: 'No tienes usuarios en tu ámbito' }
  }

  const target = await prisma.users.findUnique({
    where: { id: targetUserId },
    select: { departmentId: true, isSuperAdmin: true },
  })
  if (!target) {
    return { allowed: false, status: 404, error: 'Usuario no encontrado' }
  }
  if (target.isSuperAdmin) {
    return { allowed: false, status: 403, error: 'No autorizado' }
  }
  if (!target.departmentId || !deptIds.includes(target.departmentId)) {
    return { allowed: false, status: 403, error: 'No autorizado para gestionar este usuario' }
  }
  return { allowed: true }
}

/** Familias visibles para admin no-super (Union_Scope). undefined = sin restricción. */
export async function getAdminUnionFamilyIds(
  adminId: string,
  isSuperAdmin: boolean
): Promise<string[] | undefined> {
  if (isSuperAdmin) return undefined

  const scope = await getAdminFamilyScope(adminId, false)
  const unionSet = new Set<string>(scope.familyIds ?? [])
  for (const id of await getModuleFamilyIds(adminId, 'inventory')) unionSet.add(id)
  for (const id of await getModuleFamilyIds(adminId, 'patrols')) unionSet.add(id)

  return Array.from(unionSet)
}

/** Valida que un admin no-super pueda leer/gestionar recursos de una familia. */
export async function assertAdminCanAccessFamily(
  adminId: string,
  isSuperAdmin: boolean,
  familyId: string
): Promise<AdminUserScopeResult> {
  if (isSuperAdmin) return { allowed: true }

  const familyIds = await getAdminUnionFamilyIds(adminId, false)
  if (!familyIds || familyIds.length === 0) {
    return { allowed: false, status: 403, error: 'No tienes familias asignadas' }
  }
  if (!familyIds.includes(familyId)) {
    return { allowed: false, status: 403, error: 'No autorizado para acceder a esta familia' }
  }
  return { allowed: true }
}
