import prisma from '@/lib/prisma'
import { withCache } from '@/lib/api-cache'
import {
  adminCanOperateInventoryFamily,
  getInventoryOperationalFamilyIds,
  getInventoryVisibilityFamilyIds,
  managerCanOperateInventoryFamily,
} from '@/lib/auth/family-scope'
import { effectiveCanManageInventory } from '@/lib/inventory/manager-eligibility'

/**
 * Verifica si un usuario tiene permiso GLOBAL de gestión de inventario.
 * - Super Admin: siempre sí
 * - Admin / Técnico: flag canManageInventory en BD
 * - Cliente: nunca (aunque el flag legado esté en true)
 */
export async function canManageInventory(userId: string, _role: string): Promise<boolean> {
  try {
    return await withCache(`perm:inv:v2:${userId}`, 300, async () => {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { canManageInventory: true, isActive: true, isSuperAdmin: true, role: true },
      })
      if (!user || !user.isActive) return false
      return effectiveCanManageInventory({
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        canManageInventory: user.canManageInventory,
      })
    })
  } catch {
    return false
  }
}

/**
 * CRUD de activos en una familia concreta (scope operational).
 */
export async function canManageAsset(
  userId: string,
  role: string,
  isSuperAdmin: boolean,
  assetFamilyId: string | null | undefined
): Promise<boolean> {
  if (role === 'ADMIN' && isSuperAdmin) return true

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { canManageInventory: true, isActive: true, role: true, isSuperAdmin: true },
  })
  if (!user?.isActive) return false
  if (
    !effectiveCanManageInventory({
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
      canManageInventory: user.canManageInventory,
    })
  ) {
    return false
  }

  if (role === 'ADMIN') {
    return adminCanOperateInventoryFamily(userId, assetFamilyId ?? null, false)
  }

  return managerCanOperateInventoryFamily(userId, assetFamilyId ?? null, true)
}

export async function getAssetFamilyId(
  assetType: 'EQUIPMENT' | 'LICENSE',
  assetId: string
): Promise<string | null> {
  try {
    if (assetType === 'EQUIPMENT') {
      const eq = await prisma.equipment.findUnique({
        where: { id: assetId },
        select: { type: { select: { familyId: true } } },
      })
      return eq?.type?.familyId ?? null
    }
    const lic = await prisma.software_licenses.findUnique({
      where: { id: assetId },
      select: { licenseType: { select: { familyId: true } } },
    })
    return lic?.licenseType?.familyId ?? null
  } catch {
    return null
  }
}

/** @deprecated Usar managerCanOperateInventoryFamily — técnico gestor nativo o asignado */
export async function isTechnicianOfFamily(
  technicianId: string,
  familyId: string
): Promise<boolean> {
  return managerCanOperateInventoryFamily(technicianId, familyId, true)
}

export async function isManagerOfFamily(userId: string, familyId: string): Promise<boolean> {
  return managerCanOperateInventoryFamily(userId, familyId, true)
}

/** Aprobar bajas: admin solo en familia nativa; super admin siempre */
export async function isAdminOfFamily(
  userId: string,
  isSuperAdmin: boolean,
  familyId: string | null
): Promise<boolean> {
  if (isSuperAdmin) return true
  if (!familyId) return false
  return adminCanOperateInventoryFamily(userId, familyId, false)
}

export function inventoryForbidden() {
  return Response.json({ error: 'No tienes permiso para gestionar el inventario' }, { status: 403 })
}

export { getInventoryOperationalFamilyIds, getInventoryVisibilityFamilyIds }
