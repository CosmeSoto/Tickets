/**
 * Resolución de permisos de inventario desde sesión (siempre contra BD, no JWT).
 */

import prisma from '@/lib/prisma'
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
  /** Módulo visible (inventoryEnabled o gestión). Super Admin siempre. */
  inventoryEnabled: boolean
  scope: InventoryScopeResult
}

export async function getInventorySessionContext(sessionUser: {
  id: string
  role: string
  isSuperAdmin?: boolean
}): Promise<InventorySessionContext> {
  const user = toInventoryAccessUser(sessionUser)
  const db = await prisma.users.findUnique({
    where: { id: user.id },
    select: { inventoryEnabled: true, isActive: true },
  })
  const canManage = await canManageInventory(user.id, user.role)
  const inventoryEnabled =
    user.isSuperAdmin ||
    (db?.isActive !== false && (db?.inventoryEnabled === true || canManage))
  const scope = await getInventoryScope(user.id, user.role, user.isSuperAdmin, canManage)
  return { user, canManageInventory: canManage, inventoryEnabled, scope }
}

/** Módulo inventario accesible: Super Admin, inventoryEnabled o gestión completa. */
export function hasInventoryModuleAccess(ctx: InventorySessionContext): boolean {
  return ctx.user.isSuperAdmin || ctx.inventoryEnabled || ctx.canManageInventory
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

  if (!hasInventoryModuleAccess(ctx) || ctx.scope.noAccess) {
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

/** familyIds efectivos para reportes/listados tras resolver scope. */
export function effectiveFamilyIdsFromListScope(
  listScope: InventoryListScopeResult
): string[] | undefined {
  if (listScope.noAccess) return []
  if (listScope.familyId) return [listScope.familyId]
  return listScope.scopeFamilyIds
}
