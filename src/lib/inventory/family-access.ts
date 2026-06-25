import { prisma } from '@/lib/prisma'
import {
  getInventoryConsumerFamilyIds,
  getInventoryOperationalFamilyIds,
  getInventoryVisibilityFamilyIds,
  isFamilyInScope,
} from '@/lib/auth/family-scope'

/**
 * Scope de familias para inventario (ver family-scope.ts).
 *
 * - visibility: listados, dashboard, lectura
 * - operational: CRUD activos (admin solo nativa; gestor nativa + inventory_manager_families)
 * - consumer: solicitud de activos (canRequestAssets)
 */

export async function getAccessibleFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean,
  canManageInventory: boolean
): Promise<string[] | undefined> {
  return getInventoryVisibilityFamilyIds(userId, role, isSuperAdmin, canManageInventory)
}

export async function getInventoryManageFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean,
  canManageInventory: boolean
): Promise<string[] | undefined> {
  return getInventoryOperationalFamilyIds(userId, role, isSuperAdmin, canManageInventory)
}

export async function checkFamilyAccess(
  userId: string,
  assetFamilyId: string,
  role: string,
  isSuperAdmin: boolean,
  canManageInventory: boolean
): Promise<boolean> {
  const accessible = await getInventoryVisibilityFamilyIds(
    userId,
    role,
    isSuperAdmin,
    canManageInventory
  )
  return isFamilyInScope(assetFamilyId, accessible)
}

export async function checkFamilyManageAccess(
  userId: string,
  assetFamilyId: string,
  role: string,
  isSuperAdmin: boolean,
  canManageInventory: boolean
): Promise<boolean> {
  const operational = await getInventoryOperationalFamilyIds(
    userId,
    role,
    isSuperAdmin,
    canManageInventory
  )
  return isFamilyInScope(assetFamilyId, operational)
}

export async function checkInventoryRequestFamilyAccess(
  userId: string,
  familyId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<boolean> {
  const consumer = await getInventoryConsumerFamilyIds(userId, role, isSuperAdmin)
  return isFamilyInScope(familyId, consumer)
}
