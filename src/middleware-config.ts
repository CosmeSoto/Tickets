/**
 * Configuración de rutas públicas / protegidas.
 *
 * Convención App Router:
 * - `app/(dashboard)/**` → shell compartido (sidebar/header)
 * - `app/(public)/**` → sin shell (aceptación de actas, verificación QR, etc.)
 * - auth pages (`/login`, …) → fuera de ambos
 */

/**
 * Rutas públicas — NO requieren autenticación
 */
export const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/change-password',
  '/complete-profile',
  '/unauthorized',
  '/maintenance',
  '/help/terms',
  '/help/privacy',
  '/terminos',
  '/privacidad',
  // Aceptación de actas por token (email / link externo)
  '/acts/*/accept',
  '/acts/contract-return/*/accept',
  // Verificación pública (QR)
  '/verify/equipment/*',
  '/api/public',
  '/api/uploads',
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
  '/api/auth/validate-reset-token',
  '/api/auth/oauth-providers',
  '/api/auth/oauth-register-context',
  '/api/auth/password-policy',
  '/api/config/maintenance',
]

/**
 * Prefijos que requieren autenticación (shell de dashboard)
 */
export const protectedRoutes = [
  '/admin',
  '/technician',
  '/client',
  '/patrol',
  '/profile',
  '/settings',
  '/inventory',
  '/credentials',
  '/forms',
  '/knowledge',
  '/help/center',
  '/help/documentation',
  '/help/contact',
  '/help/report-bug',
  '/patrol-checkpoint-display',
]

/**
 * Verifica si una ruta es pública
 */
export function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => {
    // Soporte para wildcard: '/acts/*/accept' o '/verify/equipment/*'
    if (route.includes('*')) {
      const regex = new RegExp('^' + route.replace(/\*/g, '[^/]+') + '(/.*)?$')
      return regex.test(pathname)
    }
    return pathname === route || pathname.startsWith(route + '/')
  })
}

/**
 * Verifica si una ruta es protegida
 */
export function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))
}
