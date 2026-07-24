/**
 * Middleware de Next.js — ejecutado en el Edge Runtime antes de cada request.
 *
 * Responsabilidades:
 *  1. Redirigir a /change-password cuando el token JWT contiene mustChangePassword=true
 *     (política de caducidad/forzado de contraseña activada por el admin).
 *  2. No interferir con rutas públicas, assets, ni con la propia página de cambio.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Rutas que siempre pasan sin chequeo de mustChangePassword
const BYPASS_PATHS = new Set([
  '/change-password',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/api/auth',
  '/api/user/change-password',
  '/api/auth/password-policy',
  '/_next',
  '/favicon.ico',
  '/help',
])

function isBypassed(pathname: string): boolean {
  for (const prefix of BYPASS_PATHS) {
    if (
      pathname === prefix ||
      pathname.startsWith(prefix + '/') ||
      pathname.startsWith(prefix + '?')
    ) {
      return true
    }
  }
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Dejar pasar rutas exentas y assets estáticos
  if (isBypassed(pathname)) {
    return NextResponse.next()
  }

  // Solo actuar sobre rutas autenticadas — si no hay token, next-auth se encarga del redirect
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  if (token?.mustChangePassword === true) {
    const changePasswordUrl = request.nextUrl.clone()
    changePasswordUrl.pathname = '/change-password'
    // Guardar la URL original para redirigir después del cambio
    changePasswordUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(changePasswordUrl)
  }

  return NextResponse.next()
}

export const config = {
  /*
   * Aplicar el middleware solo a rutas de la app (excluye _next/static,
   * _next/image, y archivos con extensión explícita como .png, .css, etc.)
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot)$).*)',
  ],
}
