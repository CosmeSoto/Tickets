/** Verifica sesión ADMIN o Super Admin para rutas /api/admin/inventory/* */
export function isAdminInventorySession(
  session: { user?: { role?: string; isSuperAdmin?: boolean } | null } | null
): boolean {
  if (!session?.user) return false
  return session.user.role === 'ADMIN' || session.user.isSuperAdmin === true
}
