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
 * - TECHNICIAN: sus familias en technician_family_assignments
 */
export async function getPatrolAccessibleFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<string[] | undefined> {
  // SuperAdmin: acceso total
  if (role === 'ADMIN' && isSuperAdmin) return undefined

  // Admin normal: solo sus familias asignadas
  if (role === 'ADMIN') {
    const assignments = await prisma.admin_family_assignments.findMany({
      where: { adminId: userId, isActive: true },
      select: { familyId: true },
    })
    // Sin asignaciones explícitas → acceso total (admin recién configurado)
    if (assignments.length === 0) return undefined
    return assignments.map(a => a.familyId)
  }

  // TECHNICIAN: sus familias asignadas
  if (role === 'TECHNICIAN') {
    const assignments = await prisma.technician_family_assignments.findMany({
      where: { technicianId: userId, isActive: true },
      select: { familyId: true },
    })
    return assignments.map(a => a.familyId)
  }

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
