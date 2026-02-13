import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const isAuthPage = req.nextUrl.pathname.startsWith('/login')
    const isPublicPage = req.nextUrl.pathname === '/' || 
                        req.nextUrl.pathname.startsWith('/api/auth') ||
                        req.nextUrl.pathname.startsWith('/help/center') ||
                        req.nextUrl.pathname.startsWith('/help/contact')

    // Si está en página de login y ya está autenticado, redirigir al dashboard
    if (isAuthPage && isAuth) {
      const role = token.role as string
      let redirectUrl = '/'
      
      switch (role) {
        case 'ADMIN':
          redirectUrl = '/admin'
          break
        case 'TECHNICIAN':
          redirectUrl = '/technician'
          break
        case 'CLIENT':
          redirectUrl = '/client'
          break
        default:
          redirectUrl = '/'
      }
      
      return NextResponse.redirect(new URL(redirectUrl, req.url))
    }

    // Si no está autenticado y trata de acceder a página protegida
    if (!isAuth && !isAuthPage && !isPublicPage) {
      let from = req.nextUrl.pathname
      if (req.nextUrl.search) {
        from += req.nextUrl.search
      }

      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${encodeURIComponent(from)}`, req.url)
      )
    }

    // Verificar permisos de rol
    if (isAuth && !isAuthPage && !isPublicPage) {
      const role = token.role as string
      const pathname = req.nextUrl.pathname

      // Rutas de admin SOLO para ADMIN
      if (pathname.startsWith('/admin')) {
        if (role !== 'ADMIN') {
          return NextResponse.redirect(new URL('/unauthorized', req.url))
        }
      }

      // Rutas de técnico SOLO para TECHNICIAN (admin no puede acceder)
      if (pathname.startsWith('/technician')) {
        if (role !== 'TECHNICIAN') {
          return NextResponse.redirect(new URL('/unauthorized', req.url))
        }
      }

      // Rutas de cliente SOLO para CLIENT (otros roles no pueden acceder)
      if (pathname.startsWith('/client')) {
        if (role !== 'CLIENT') {
          return NextResponse.redirect(new URL('/unauthorized', req.url))
        }
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Permitir acceso a páginas públicas sin token
        const isPublicPage = req.nextUrl.pathname === '/' || 
                            req.nextUrl.pathname.startsWith('/api/auth') ||
                            req.nextUrl.pathname.startsWith('/help/center') ||
                            req.nextUrl.pathname.startsWith('/help/contact') ||
                            req.nextUrl.pathname.startsWith('/login')

        if (isPublicPage) return true

        // Para páginas protegidas, requerir token
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
}