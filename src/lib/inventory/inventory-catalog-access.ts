/**
 * Acceso a catálogos de inventario (tipos, unidades, supplier-types).
 * Lectura: módulo inventario o técnico. Escritura global: solo ADMIN/super admin.
 * Escritura por familia: assertInventoryManageByFamily.
 */

import {
  assertInventoryManageByFamily,
  assertInventoryReadByFamily,
  InventoryAccessError,
  type InventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import {
  getInventorySessionContext,
  hasInventoryModuleAccess,
  type InventorySessionContext,
} from '@/lib/inventory/inventory-session'
import { buildInventoryFamilyWhere } from '@/lib/inventory/scope-filter'

export async function requireInventoryCatalogRead(sessionUser: {
  id: string
  role: string
  isSuperAdmin?: boolean
}): Promise<InventorySessionContext> {
  const ctx = await getInventorySessionContext(sessionUser)
  const canRead = hasInventoryModuleAccess(ctx) || ctx.user.role === 'TECHNICIAN'
  if (!canRead) {
    throw new InventoryAccessError('No tienes permiso para acceder al catálogo de inventario', 403)
  }
  return ctx
}

/** Filtro Prisma familyId para listados de catálogo (incluye globales por defecto). */
export function buildCatalogFamilyWhere(
  ctx: InventorySessionContext,
  explicitFamilyId?: string | null,
  includeGlobal = true
): Record<string, unknown> {
  if (explicitFamilyId) {
    return includeGlobal
      ? { OR: [{ familyId: explicitFamilyId }, { familyId: null }] }
      : { familyId: explicitFamilyId }
  }

  if (ctx.user.isSuperAdmin) return {}

  if (ctx.user.role === 'ADMIN' && ctx.scope.familyIds === undefined) {
    return {}
  }

  if (ctx.scope.noAccess) {
    return includeGlobal ? { familyId: null } : { id: '__NONE__' }
  }

  return buildInventoryFamilyWhere(ctx.scope.familyIds, includeGlobal)
}

export async function assertCatalogEntryWrite(
  user: InventoryAccessUser,
  familyId: string | null | undefined
): Promise<void> {
  if (!familyId) {
    if (user.role !== 'ADMIN' && !user.isSuperAdmin) {
      throw new InventoryAccessError(
        'Solo administradores pueden gestionar entradas globales del catálogo',
        403
      )
    }
    return
  }
  await assertInventoryManageByFamily(user, familyId)
}

export async function assertCatalogEntryRead(
  user: InventoryAccessUser,
  familyId: string | null | undefined
): Promise<void> {
  if (!familyId) return
  await assertInventoryReadByFamily(user, familyId)
}

export async function assertGlobalCatalogDelete(user: InventoryAccessUser): Promise<void> {
  if (user.role !== 'ADMIN' && !user.isSuperAdmin) {
    throw new InventoryAccessError(
      'Solo administradores pueden eliminar entradas del catálogo',
      403
    )
  }
}
