import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { ApplicationLogger } from '@/lib/logging'

// Rate limiting store (en producción usar Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Configuración de rate limiting
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutos
const RATE_LIMIT_MAX_REQUESTS = 100 // máximo 100 requests por ventana

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
  return `rate_limit:${ip}`
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    // Nueva ventana o primera request
    const resetTime = now + RATE_LIMIT_WINDOW
    rateLimitStore.set(key, { count: 1, resetTime })
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetTime }
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }

  record.count++
  rateLimitStore.set(key, record)
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - record.count,
    resetTime: record.resetTime,
  }
}

export async function middleware(request: NextRequest) {
  const startTime = performance.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const path = request.nextUrl.pathname
  const method = request.method
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 'unknown'

  // Log middleware start
  ApplicationLogger.child({ requestId, component: 'middleware' }).debug(
    `Middleware processing: ${method} ${path}`,
    {
      metadata: {
        ip,
        userAgent: request.headers.get('user-agent'),
      },
    }
  )

  // Para APIs básicas, solo aplicar rate limiting y headers de seguridad
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    
    // Headers de seguridad básicos para APIs
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    
    // Rate limiting para APIs
    const rateLimitKey = getRateLimitKey(request)
    const { allowed, remaining, resetTime } = checkRateLimit(rateLimitKey)

    response.headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString())
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString())

    if (!allowed) {
      ApplicationLogger.securityEvent(
        'rate_limit_exceeded',
        'medium',
        {
          ip,
          path,
          method,
          rateLimitKey,
          maxRequests: RATE_LIMIT_MAX_REQUESTS,
          windowMs: RATE_LIMIT_WINDOW,
        },
        { requestId }
      )

      return new NextResponse(
        JSON.stringify({
          error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    return response
  }

  const response = NextResponse.next()

  // Headers de seguridad completos para páginas web
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
  )

  // Protección de rutas autenticadas
  const protectedPaths = ['/admin', '/technician', '/client']
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

  if (isProtectedPath) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token) {
      ApplicationLogger.securityEvent(
        'unauthorized_access_attempt',
        'low',
        {
          path,
          ip,
          userAgent: request.headers.get('user-agent'),
        },
        { requestId }
      )

      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Verificar permisos por rol
    const userRole = token.role as string
    const userId = token.sub as string

    ApplicationLogger.authorizationCheck(
      userId,
      path,
      'access',
      true,
      { requestId, metadata: { role: userRole } }
    )

    if (path.startsWith('/admin') && userRole !== 'ADMIN') {
      ApplicationLogger.securityEvent(
        'insufficient_privileges',
        'medium',
        {
          userId,
          userRole,
          requiredRole: 'ADMIN',
          path,
          ip,
        },
        { requestId }
      )

      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (path.startsWith('/technician')) {
      // Solo los técnicos pueden acceder a sus propias rutas
      // ADMIN puede supervisar pero debe usar rutas específicas de admin
      if (userRole !== 'TECHNICIAN') {
        ApplicationLogger.securityEvent(
          'insufficient_privileges',
          'medium',
          {
            userId,
            userRole,
            requiredRole: 'TECHNICIAN',
            path,
            ip,
            reason: 'Only technicians can access technician routes'
          },
          { requestId }
        )

        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }

    if (path.startsWith('/client')) {
      // Solo los clientes pueden acceder a sus propias rutas
      // ADMIN puede supervisar pero debe usar rutas específicas de admin
      if (userRole !== 'CLIENT') {
        ApplicationLogger.securityEvent(
          'insufficient_privileges',
          'medium',
          {
            userId,
            userRole,
            requiredRole: 'CLIENT',
            path,
            ip,
            reason: 'Only clients can access client routes'
          },
          { requestId }
        )

        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }
  }

  // Log middleware completion
  const duration = performance.now() - startTime
  ApplicationLogger.child({ requestId, component: 'middleware' }).performance(
    `Middleware completed: ${method} ${path}`,
    duration,
    {
      metadata: {
        statusCode: response.status,
        isProtectedPath,
        hasAuth: !!isProtectedPath,
      },
    }
  )

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
