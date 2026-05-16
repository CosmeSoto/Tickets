import prisma from '@/lib/prisma'

/**
 * Control de acceso para el módulo de Rondas y Patrullajes.
 *
 * Reglas:
 * - SuperAdmin (ADMIN + isSuperAdmin): acceso total — puede crear, editar y desactivar cualquier recurso
 * - Admin normal (ADMIN sin isSuperAdmin): puede crear y editar recursos de sus familias asignadas,
 *   pero NO puede desactivar (DELETE) — esa acción es exclusiva del SuperAdmin
 * - TECHNICIAN con patrolsEnabled: puede crear y editar recursos de sus familias asignadas,
 *   pero NO puede desactivar
 * - Otros roles: sin acceso a operaciones de escritura
 */

/**
 * Retorna los IDs de familias accesibles para un usuario en el módulo de patrullas.
 *
 * - SuperAdmin: undefined (sin restricción)
 * - Admin normal: sus familias en admin_family_assignments (o todas si no tiene ninguna asignada)
 * - TECHNICIAN/CLIENT: sus familias en patrol_family_assignments (asignación específica de rondas)
 *   Si no tiene asignaciones de rondas, fallback a technician_family_assignments (familia nativa)
 */
export async function getPatrolAccessibleFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<string[] | undefined> {
  // SuperAdmin: acceso total
  if (role === 'ADMIN' && isSuperAdmin) return undefined

  // Admin normal: familias asignadas para módulo de patrullas + nativa
  if (role === 'ADMIN') {
    const { getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
    const patrolFamilyIds = await getModuleFamilyIds(userId, 'patrols')
    if (patrolFamilyIds.length === 0) {
      // Fallback: si no tiene asignaciones de patrullas, usar solo familia nativa
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { departments: { select: { familyId: true } } },
      })
      const nativeFamilyId = user?.departments?.familyId
      return nativeFamilyId ? [nativeFamilyId] : []
    }
    return patrolFamilyIds
  }

  // TECHNICIAN/CLIENT: primero buscar en patrol_family_assignments (asignación específica de rondas)
  const patrolAssignments = await prisma.patrol_family_assignments.findMany({
    where: { userId, isActive: true },
    select: { familyId: true },
  })

  if (patrolAssignments.length > 0) {
    return patrolAssignments.map(a => a.familyId)
  }

  // Fallback para TECHNICIAN: usar technician_family_assignments (familia nativa)
  if (role === 'TECHNICIAN') {
    const techAssignments = await prisma.technician_family_assignments.findMany({
      where: { technicianId: userId, isActive: true },
      select: { familyId: true },
    })
    return techAssignments.map(a => a.familyId)
  }

  // CLIENT sin asignaciones de rondas: sin acceso a supervisión
  return []
}

/**
 * Verifica si el usuario puede leer/escribir en una familia específica del módulo patrol.
 */
export async function checkPatrolFamilyAccess(
  userId: string,
  familyId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<boolean> {
  const accessible = await getPatrolAccessibleFamilyIds(userId, role, isSuperAdmin)
  if (accessible === undefined) return true
  return accessible.includes(familyId)
}

/**
 * Verifica si el usuario puede ejecutar operaciones destructivas (DELETE/desactivar).
 * Solo SuperAdmin puede desactivar recursos de patrol.
 */
export function canDeletePatrolResource(role: string, isSuperAdmin: boolean): boolean {
  return role === 'ADMIN' && isSuperAdmin
}
