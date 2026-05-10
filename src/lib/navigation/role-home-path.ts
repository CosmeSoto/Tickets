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
