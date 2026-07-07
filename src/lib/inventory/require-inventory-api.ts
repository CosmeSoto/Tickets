import { NextResponse } from 'next/server'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import {
  assertContractAccess,
  InventoryAccessError,
  toInventoryAccessUser,
  type InventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

/** Admin o gestor con permiso global de inventario */
export async function requireInventoryModuleAccess(user: {
  id: string
  role: string
}): Promise<NextResponse | null> {
  if (user.role === 'ADMIN') return null
  if (!(await canManageInventory(user.id, user.role))) {
    return inventoryForbidden()
  }
  return null
}

export function inventoryAccessErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof InventoryAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }
  return null
}

export async function requireContractAccess(
  sessionUser: { id: string; role: string; isSuperAdmin?: boolean },
  contractId: string,
  mode: 'read' | 'write'
): Promise<NextResponse | null> {
  const user = toInventoryAccessUser(sessionUser)
  const denied = await requireInventoryModuleAccess(user)
  if (denied) return denied
  try {
    await assertContractAccess(user, contractId, mode)
    return null
  } catch (error) {
    return inventoryAccessErrorResponse(error)
  }
}

export { toInventoryAccessUser, type InventoryAccessUser }
