import {
  effectiveFamilyIdsFromListScope,
  getInventorySessionContext,
  hasInventoryModuleAccess,
  resolveInventoryListScope,
} from '@/lib/inventory/inventory-session'
import { InventoryAccessError } from '@/lib/inventory/inventory-resource-access'
import {
  buildConsumableFamilyWhere,
  buildEquipmentFamilyWhere,
  buildLicenseFamilyWhere,
} from '@/lib/inventory/scope-filter'

export interface ReportScopeContext {
  familyIds: string[] | undefined
  noAccess: boolean
}

export async function resolveReportScope(
  sessionUser: { id: string; role: string; isSuperAdmin?: boolean },
  requestedFamilyId?: string
): Promise<ReportScopeContext> {
  const ctx = await getInventorySessionContext(sessionUser)
  if (!hasInventoryModuleAccess(ctx)) {
    throw new InventoryAccessError('No tienes permiso para ver reportes', 403)
  }

  const listScope = await resolveInventoryListScope(sessionUser, requestedFamilyId)
  const familyIds = effectiveFamilyIdsFromListScope(listScope)

  return {
    familyIds,
    noAccess: listScope.noAccess || familyIds?.length === 0,
  }
}

export function equipmentScopeWhere(familyIds: string[] | undefined) {
  return buildEquipmentFamilyWhere(familyIds)
}

export function licenseScopeWhere(familyIds: string[] | undefined) {
  return buildLicenseFamilyWhere(familyIds)
}

export function consumableScopeWhere(familyIds: string[] | undefined) {
  return buildConsumableFamilyWhere(familyIds)
}

export function contractFamilyFilter(familyIds: string[] | undefined) {
  if (familyIds === undefined) return {}
  if (familyIds.length === 0) return { id: '__NONE__' }
  return { familyId: { in: familyIds } }
}
