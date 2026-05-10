/**
 * Pantalla principal según rol (alineado con landing /page.tsx cuando hay sesión).
 */
export function getHomePathForRole(role: string | undefined): string {
  switch (role) {
    case 'ADMIN':
      return '/admin'
    case 'TECHNICIAN':
      return '/technician'
    default:
      return '/client'
  }
}

/** `callbackUrl` lo interpreta NextAuth al iniciar sesión. */
export function loginPathWithReturnTo(returnToPath: string): string {
  return `/login?callbackUrl=${encodeURIComponent(returnToPath)}`
}

/**
 * Verifica si el usuario tiene acceso al módulo de inventario.
 * - ADMIN: siempre tiene acceso (gestiona el sistema)
 * - TECHNICIAN/CLIENT: necesita inventoryEnabled o canManageInventory
 */
export function canAccessInventory(user: {
  role?: string
  inventoryEnabled?: boolean
  canManageInventory?: boolean
}): boolean {
  if (user.role === 'ADMIN') return true
  return !!(user.inventoryEnabled || user.canManageInventory)
}
