/**
 * Helper centralizado para aplicar filtrado de scope de inventario.
 * Usado por todos los endpoints de inventario que necesitan restringir datos por familia.
 *
 * Para Admin Normal: user_family_access (módulo inventory) + familia nativa
 * Para Super Admin: sin restricción
 * Para Gestores (canManageInventory): grants inventory en user_family_access + nativa
 */

import { getAccessibleFamilyIds } from './family-access'

export interface InventoryScopeResult {
  /** IDs de familias accesibles. undefined = sin restricción */
  familyIds: string[] | undefined
  /** true si el usuario no tiene acceso a ninguna familia */
  noAccess: boolean
}

/**
 * Resuelve las familias accesibles para un usuario en el módulo de inventario.
 * Retorna undefined si es Super Admin (sin restricción).
 * Retorna array vacío si no tiene acceso.
 */
export async function getInventoryScope(
  userId: string,
  role: string,
  isSuperAdmin: boolean,
  canManageInventory: boolean
): Promise<InventoryScopeResult> {
  const familyIds = await getAccessibleFamilyIds(userId, role, isSuperAdmin, canManageInventory)

  if (familyIds === undefined) {
    return { familyIds: undefined, noAccess: false }
  }

  if (familyIds.length === 0) {
    return { familyIds: [], noAccess: true }
  }

  return { familyIds, noAccess: false }
}

/**
 * Construye un filtro Prisma para familyId basado en el scope de inventario.
 * Soporta modelos que tienen familyId directo (suppliers, warehouses, etc.)
 *
 * @param familyIds - IDs de familias accesibles (undefined = sin filtro)
 * @param includeGlobal - Si true, incluye registros con familyId=null (catálogos globales)
 */
export function buildInventoryFamilyWhere(
  familyIds: string[] | undefined,
  includeGlobal: boolean = false
): Record<string, any> {
  if (familyIds === undefined) return {} // Super Admin: sin filtro

  if (familyIds.length === 0) {
    return includeGlobal ? { familyId: null } : { id: '__NONE__' }
  }

  if (includeGlobal) {
    return { OR: [{ familyId: { in: familyIds } }, { familyId: null }] }
  }

  return { familyId: { in: familyIds } }
}

/**
 * Construye un filtro para modelos de equipment (que se relacionan con familia a través de type).
 * Retorna un filtro por typeId basado en los tipos que pertenecen a las familias del scope.
 */
export async function buildEquipmentTypeFilter(
  familyIds: string[] | undefined
): Promise<Record<string, any>> {
  if (familyIds === undefined) return {} // Super Admin: sin filtro

  if (familyIds.length === 0) return { id: '__NONE__' }

  const { prisma } = await import('@/lib/prisma')
  const typesInScope = await prisma.equipment_types.findMany({
    where: { familyId: { in: familyIds } },
    select: { id: true },
  })

  const typeIds = typesInScope.map(t => t.id)
  if (typeIds.length === 0) return { id: '__NONE__' }

  return { typeId: { in: typeIds } }
}

/** Filtro Prisma para equipos por familias (vía equipment_types). */
export function buildEquipmentFamilyWhere(
  familyIds: string[] | undefined
): Record<string, unknown> {
  if (familyIds === undefined) return {}
  if (familyIds.length === 0) return { id: '__NONE__' }
  return { type: { familyId: { in: familyIds } } }
}

/** Filtro Prisma para consumibles por familias (vía consumable_types). */
export function buildConsumableFamilyWhere(
  familyIds: string[] | undefined
): Record<string, unknown> {
  if (familyIds === undefined) return {}
  if (familyIds.length === 0) return { id: '__NONE__' }
  return { consumableType: { familyId: { in: familyIds } } }
}

/** Filtro Prisma para licencias por familias (vía license_types). */
export function buildLicenseFamilyWhere(familyIds: string[] | undefined): Record<string, unknown> {
  if (familyIds === undefined) return {}
  if (familyIds.length === 0) return { id: '__NONE__' }
  return { licenseType: { familyId: { in: familyIds } } }
}
