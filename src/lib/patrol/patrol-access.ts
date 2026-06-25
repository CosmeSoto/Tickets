import {
  getPatrolOperationalFamilyIds,
  getPatrolVisibilityFamilyIds,
  isFamilyInScope,
} from '@/lib/auth/family-scope'

/**
 * Control de acceso para el módulo de Rondas y Patrullajes.
 *
 * - visibility: listados, reportes, dashboard, lectura de incidentes
 * - operational: configurar rutas/horarios/checkpoints (admin solo nativa;
 *   agente/supervisor en nativa + patrol_family_assignments)
 * - DELETE/desactivar: solo Super Admin
 */

/** @deprecated Usar getPatrolVisibilityFamilyIds — alias de compatibilidad */
export async function getPatrolAccessibleFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<string[] | undefined> {
  return getPatrolVisibilityFamilyIds(userId, role, isSuperAdmin)
}

/** Lectura, listados y reportes */
export async function checkPatrolFamilyAccess(
  userId: string,
  familyId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<boolean> {
  const accessible = await getPatrolVisibilityFamilyIds(userId, role, isSuperAdmin)
  return isFamilyInScope(familyId, accessible)
}

/** Crear/editar rutas, horarios, checkpoints, config de familia */
export async function checkPatrolFamilyOperate(
  userId: string,
  familyId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<boolean> {
  const operational = await getPatrolOperationalFamilyIds(userId, role, isSuperAdmin)
  return isFamilyInScope(familyId, operational)
}

export function canDeletePatrolResource(role: string, isSuperAdmin: boolean): boolean {
  return role === 'ADMIN' && isSuperAdmin
}
