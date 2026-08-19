/**
 * Acceso a configuración por familia (gobernanza vs operación).
 *
 * - Lectura: Super Admin, admin con visibilidad del módulo, gestor inventario (solo inventario).
 * - Escritura reglas de negocio inventario: Super Admin, admin operativo, o técnico
 *   gestor (canManageInventory) en familias asignadas.
 * - Escritura tickets/patrols: Super Admin o admin nativo (operational).
 * - Flags de módulo (inventoryEnabled, ticketsEnabled, patrolsEnabled): solo Super Admin.
 */

import {
  adminCanOperateInventoryFamily,
  adminCanOperatePatrolFamily,
  adminCanOperateTicketFamily,
} from '@/lib/auth/family-scope'
import { checkFamilyAccess, checkFamilyManageAccess } from '@/lib/inventory/family-access'
import { checkPatrolFamilyAccess } from '@/lib/patrol/patrol-access'
import { adminCanViewTicketFamily } from '@/lib/auth/family-scope'
import { canManageInventory } from '@/lib/inventory-access'

export type ModuleConfigKey = 'inventory' | 'tickets' | 'patrols'

export async function canReadModuleFamilyConfig(
  userId: string,
  role: string,
  isSuperAdmin: boolean,
  familyId: string,
  module: ModuleConfigKey
): Promise<boolean> {
  if (isSuperAdmin && role === 'ADMIN') return true

  if (module === 'inventory') {
    if (role === 'ADMIN') {
      const manages = await canManageInventory(userId, role)
      return checkFamilyAccess(userId, familyId, role, false, manages)
    }
    if (role === 'TECHNICIAN') {
      const manages = await canManageInventory(userId, role)
      if (!manages) return false
      return checkFamilyAccess(userId, familyId, role, false, true)
    }
    return false
  }

  if (module === 'tickets') {
    if (role !== 'ADMIN') return false
    return adminCanViewTicketFamily(userId, familyId, false)
  }

  if (module === 'patrols') {
    return checkPatrolFamilyAccess(userId, familyId, role, false)
  }

  return false
}

export async function canWriteModuleFamilyConfig(
  userId: string,
  role: string,
  isSuperAdmin: boolean,
  familyId: string,
  module: ModuleConfigKey
): Promise<boolean> {
  if (isSuperAdmin && role === 'ADMIN') return true

  if (module === 'inventory') {
    if (role === 'ADMIN') {
      return adminCanOperateInventoryFamily(userId, familyId, false)
    }
    if (role === 'TECHNICIAN') {
      const manages = await canManageInventory(userId, role)
      if (!manages) return false
      return checkFamilyManageAccess(userId, familyId, role, false, true)
    }
    return false
  }

  if (role !== 'ADMIN') return false

  switch (module) {
    case 'tickets':
      return adminCanOperateTicketFamily(userId, familyId, false)
    case 'patrols':
      return adminCanOperatePatrolFamily(userId, familyId, false)
  }
}

/** Quita campos reservados a Super Admin del body de config inventario. */
export function sanitizeInventoryConfigBody<T extends Record<string, unknown>>(
  body: T,
  isSuperAdmin: boolean
): T {
  if (isSuperAdmin) return body
  const next = { ...body }
  delete next.inventoryEnabled
  return next
}

/** Quita campos reservados a Super Admin del body de config tickets. */
export function sanitizeTicketConfigBody<T extends Record<string, unknown>>(
  body: T,
  isSuperAdmin: boolean
): T {
  if (isSuperAdmin) return body
  const next = { ...body }
  delete next.ticketsEnabled
  delete next.isDefault
  return next
}

/** Quita patrolsEnabled si no es Super Admin. */
export function sanitizePatrolConfigBody<T extends Record<string, unknown>>(
  body: T,
  isSuperAdmin: boolean
): T {
  if (isSuperAdmin) return body
  const next = { ...body }
  delete next.patrolsEnabled
  return next
}
