/**
 * Quién puede ser gestor de inventario.
 * Cliente nunca: solo lectura / solicitudes. Gestión desde Técnico hacia arriba.
 */
export function roleCanBeInventoryManager(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'TECHNICIAN'
}

export function effectiveCanManageInventory(opts: {
  role: string | null | undefined
  isSuperAdmin?: boolean | null
  canManageInventory?: boolean | null
}): boolean {
  if (opts.isSuperAdmin === true) return true
  if (!roleCanBeInventoryManager(opts.role)) return false
  return opts.canManageInventory === true
}
