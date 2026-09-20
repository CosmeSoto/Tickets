import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { resolveModuleFamilyScopeIds } from '@/lib/auth/user-family-access'

export type PlannerAccess = {
  canView: boolean
  canManage: boolean
  /** undefined = sin límite (solo Super Admin). Array vacío = sin áreas. */
  familyIds?: string[]
}

/**
 * Mismo criterio que getProcessAccess (src/lib/processes/access.ts): el
 * alcance se resuelve desde user_family_access, no se fija en código.
 */
export async function getPlannerAccess(userId: string, role: string): Promise<PlannerAccess> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      isSuperAdmin: true,
      plannerEnabled: true,
      canManagePlanner: true,
    },
  })

  if (!user?.isActive) return { canView: false, canManage: false, familyIds: [] }

  if (user.isSuperAdmin) return { canView: true, canManage: true }

  const canManage = user.canManagePlanner === true
  const canView = user.plannerEnabled === true || canManage
  if (!canView) return { canView: false, canManage: false, familyIds: [] }

  const capability = canManage ? 'canOperate' : 'canView'
  const familyIds = await resolveModuleFamilyScopeIds(userId, 'planner', capability)
  return { canView, canManage, familyIds }
}

export async function assertCanViewPlanner(userId: string, role: string) {
  const access = await getPlannerAccess(userId, role)
  if (!access.canView) {
    return NextResponse.json({ error: 'No tienes acceso al módulo de tareas.' }, { status: 403 })
  }
  return null
}

export async function assertCanManagePlanner(userId: string, role: string) {
  const access = await getPlannerAccess(userId, role)
  if (!access.canManage) {
    return NextResponse.json(
      { error: 'No tienes permisos para gestionar la sincronización con Planner.' },
      { status: 403 }
    )
  }
  return null
}

export function isFamilyWithinPlannerScope(
  access: PlannerAccess,
  familyId: string | null
): boolean {
  if (!familyId) return true
  return !access.familyIds || access.familyIds.includes(familyId)
}
