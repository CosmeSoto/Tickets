/**
 * Resolución de permisos de inventario desde sesión (siempre contra BD, no JWT).
 */

import { canManageInventory } from '@/lib/inventory-access'
import { getInventoryScope, type InventoryScopeResult } from '@/lib/inventory/scope-filter'
import {
  toInventoryAccessUser,
  type InventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

export async function resolveCanManageInventory(userId: string, role: string): Promise<boolean> {
  return canManageInventory(userId, role)
}

export interface InventorySessionContext {
  user: InventoryAccessUser
  canManageInventory: boolean
  scope: InventoryScopeResult
}

export async function getInventorySessionContext(sessionUser: {
  id: string
  role: string
  isSuperAdmin?: boolean
}): Promise<InventorySessionContext> {
  const user = toInventoryAccessUser(sessionUser)
  const canManage = await canManageInventory(user.id, user.role)
  const scope = await getInventoryScope(user.id, user.role, user.isSuperAdmin, canManage)
  return { user, canManageInventory: canManage, scope }
}

/** Admin, super admin o gestor con flag en BD (no JWT). */
export function hasInventoryModuleAccess(ctx: InventorySessionContext): boolean {
  return ctx.user.role === 'ADMIN' || ctx.user.isSuperAdmin || ctx.canManageInventory
}

export type InventoryListScopeResult =
  | { noAccess: true }
  | { noAccess: false; scopeFamilyIds: string[] | undefined; familyId?: string }

/**
 * Resuelve scope de listados: super admin sin restricción; resto por familias accesibles.
 */
export async function resolveInventoryListScope(
  sessionUser: { id: string; role: string; isSuperAdmin?: boolean },
  requestedFamilyId?: string
): Promise<InventoryListScopeResult> {
  const ctx = await getInventorySessionContext(sessionUser)

  if (ctx.user.isSuperAdmin) {
    return {
      noAccess: false,
      scopeFamilyIds: undefined,
      familyId: requestedFamilyId,
    }
  }

  if (ctx.scope.noAccess) {
    return { noAccess: true }
  }

  if (requestedFamilyId) {
    if (ctx.scope.familyIds && !ctx.scope.familyIds.includes(requestedFamilyId)) {
      return { noAccess: true }
    }
    return {
      noAccess: false,
      scopeFamilyIds: ctx.scope.familyIds,
      familyId: requestedFamilyId,
    }
  }

  return {
    noAccess: false,
    scopeFamilyIds: ctx.scope.familyIds,
  }
}
