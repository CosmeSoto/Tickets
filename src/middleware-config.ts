/**
 * Configuración de rutas públicas para el middleware
 * Estas rutas NO requieren autenticación
 */
export const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/help',
  '/help/terms',
  '/help/privacy',
  '/api/auth/signin',
  '/api/auth/signout',
  '/api/auth/callback',
  '/api/auth/csrf',
  '/api/auth/session',
  '/api/auth/providers',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/check-oauth',
]

/**
 * Rutas que requieren autenticación
 */
export const protectedRoutes = [
  '/admin',
  '/technician',
  '/client',
  '/profile',
  '/settings',
]

/**
 * Verifica si una ruta es pública
 */
export function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => {
    if (route.endsWith('*')) {
      return pathname.startsWith(route.slice(0, -1))
    }
    return pathname === route || pathname.startsWith(route + '/')
  })
}

/**
 * Verifica si una ruta es protegida
 */
export function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(route => pathname.startsWith(route))
}
