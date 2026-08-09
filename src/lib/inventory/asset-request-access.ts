import { canManageInventory } from '@/lib/inventory-access'

type SessionUser = {
  id: string
  role: string
  isSuperAdmin?: boolean
  canRequestAssets?: boolean
  inventoryEnabled?: boolean
}

/** Super Admin o gestor con canManageInventory (incluye ADMIN de familia). */
export async function canManageAssetRequests(user: SessionUser): Promise<boolean> {
  if (user.isSuperAdmin) return true
  return canManageInventory(user.id, user.role)
}

/** Ver detalle/lista propia: solicitantes o personal de inventario */
export async function canViewAssetRequests(user: SessionUser): Promise<boolean> {
  if (user.canRequestAssets) return true
  if (user.inventoryEnabled) return true
  return canManageAssetRequests(user)
}
