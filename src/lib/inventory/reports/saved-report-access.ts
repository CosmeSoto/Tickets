import {
  canAccessDataset,
  canAccessTemplate,
  getDatasetById,
  getTemplateBySlug,
  resolveUserReportRole,
} from './catalog'
import { resolveReportScope } from './scope'
import { resolveCanManageInventory } from '@/lib/inventory/inventory-session'
import { InventoryAccessError } from '@/lib/inventory/inventory-resource-access'
import type { SavedReportKind } from '@prisma/client'

export async function assertSavedReportConfigAccess(
  sessionUser: { id: string; role: string; isSuperAdmin?: boolean },
  kind: SavedReportKind,
  targetId: string,
  familyId?: string | null
): Promise<void> {
  const isSuperAdmin = sessionUser.isSuperAdmin === true
  const canManage = await resolveCanManageInventory(sessionUser.id, sessionUser.role)
  const userRole = resolveUserReportRole(sessionUser.role, isSuperAdmin, canManage)

  if (kind === 'DATASET') {
    const dataset = getDatasetById(targetId)
    if (!dataset) {
      throw new InventoryAccessError('Dataset de reporte no encontrado', 404)
    }
    if (!canAccessDataset(targetId, userRole)) {
      throw new InventoryAccessError('No tienes permiso para este dataset', 403)
    }
  } else {
    const template = getTemplateBySlug(targetId)
    if (!template) {
      throw new InventoryAccessError('Plantilla de reporte no encontrada', 404)
    }
    if (!canAccessTemplate(targetId, userRole)) {
      throw new InventoryAccessError('No tienes permiso para esta plantilla', 403)
    }
  }

  const scope = await resolveReportScope(sessionUser, familyId ?? undefined)
  if (scope.noAccess) {
    throw new InventoryAccessError('Sin acceso a familias de inventario', 403)
  }

  if (familyId && scope.familyIds !== undefined && !scope.familyIds.includes(familyId)) {
    throw new InventoryAccessError('No tienes acceso a la familia seleccionada', 403)
  }
}
