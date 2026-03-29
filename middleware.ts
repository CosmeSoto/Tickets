import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Rutas públicas que NO requieren autenticación
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/help',
  '/help/terms',
  '/help/privacy',
  '/inventory/equipment/public',
]

// Rutas protegidas que requieren autenticación
const protectedRoutes = [
  '/admin',
  '/technician',
  '/client',
  '/profile',
  '/settings',
]

// Verificar si una ruta es pública
function isPublicRoute(pathname: string): boolean {
  // Permitir todas las rutas de API de NextAuth
  if (pathname.startsWith('/api/auth/')) {
    return true
  }
  
  // Verificar rutas públicas exactas o con sub-rutas
  return publicRoutes.some(route => {
    return pathname === route || pathname.startsWith(route + '/')
  })
}

// Verificar si una ruta es protegida
function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(route => pathname.startsWith(route))
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // DEBUG: Log para ver qué está pasando
  console.log('[MIDDLEWARE] Path:', path)

  // Permitir archivos estáticos y APIs sin procesamiento
  if (
    path.startsWith('/_next/') ||
    path.startsWith('/api/') ||
    path.includes('.') // archivos con extensión
  ) {
    return NextResponse.next()
  }

  // Verificar si es ruta pública
  const isPublic = isPublicRoute(path)
  const isProtected = isProtectedRoute(path)

  console.log('[MIDDLEWARE] isPublic:', isPublic, '| isProtected:', isProtected)

  // Si es una ruta pública, permitir acceso
  if (isPublic) {
    console.log('[MIDDLEWARE] ✅ Permitiendo acceso a ruta pública')
    return NextResponse.next()
  }

  // Si es una ruta protegida, verificar autenticación
  if (isProtected) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      })

      if (!token) {
        console.log('[MIDDLEWARE] ❌ No token, redirigiendo a login')
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('callbackUrl', path)
        return NextResponse.redirect(loginUrl)
      }

      // Verificar permisos por rol
      const userRole = token.role as string

      if (path.startsWith('/admin') && userRole !== 'ADMIN') {
        console.log('[MIDDLEWARE] ❌ No es ADMIN')
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }

      if (path.startsWith('/technician') && userRole !== 'TECHNICIAN') {
        console.log('[MIDDLEWARE] ❌ No es TECHNICIAN')
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }

      if (path.startsWith('/client') && userRole !== 'CLIENT') {
        console.log('[MIDDLEWARE] ❌ No es CLIENT')
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }

      console.log('[MIDDLEWARE] ✅ Acceso autorizado')
    } catch (error) {
      console.error('[MIDDLEWARE] Error:', error)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Para cualquier otra ruta, permitir acceso
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
