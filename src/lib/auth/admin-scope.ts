/**
 * Helper centralizado para determinar el scope de familias de cualquier usuario.
 * Usado por todos los endpoints que necesitan filtrar datos por familias del usuario.
 *
 * Reglas:
 * - Super Admin: undefined (sin restricción, ve todo)
 * - Admin normal: admin_family_assignments + familia nativa
 * - Técnico: technician_family_assignments + familia nativa
 * - Cliente: client_family_assignments + familia nativa
 *
 * Para módulos específicos:
 * - Inventario: inventory_manager_families
 * - Rondas: patrol_family_assignments (con fallback a nativa)
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
