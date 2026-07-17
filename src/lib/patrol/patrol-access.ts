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
 * - soft delete (desactivar): ADMIN/TECH con acceso operational a la familia
 * - hard delete permanente: solo Super Admin
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

/** Soft-delete / desactivar recursos de config: solo ADMIN o TECHNICIAN. */
export function canSoftDeletePatrolResource(role: string): boolean {
  return role === 'ADMIN' || role === 'TECHNICIAN'
}

export type PatrolVisibilityFilterResult =
  | { ok: true; familyWhere: Record<string, unknown> }
  | { ok: false; status: number; error: string }

/**
 * Resuelve filtro familyId para listados de rondas (visibility).
 * - familyId explícito: valida acceso; 403 si no.
 * - sin familyId: { in: ids } o vacío → denegar con __NONE__
 * - Super Admin (undefined): sin filtro
 */
export async function resolvePatrolVisibilityFilter(
  userId: string,
  role: string,
  isSuperAdmin: boolean,
  familyId: string | null | undefined
): Promise<PatrolVisibilityFilterResult> {
  const accessible = await getPatrolVisibilityFamilyIds(userId, role, isSuperAdmin)

  if (familyId) {
    if (!isFamilyInScope(familyId, accessible)) {
      return { ok: false, status: 403, error: 'No tienes acceso a esta área' }
    }
    return { ok: true, familyWhere: { familyId } }
  }

  if (accessible === undefined) {
    return { ok: true, familyWhere: {} }
  }

  if (accessible.length === 0) {
    return { ok: true, familyWhere: { familyId: '__NONE__' } }
  }

  return { ok: true, familyWhere: { familyId: { in: accessible } } }
}
