import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { ApplicationLogger } from '@/lib/logging'
import { isPublicRoute, isProtectedRoute } from './middleware-config'

// Rate limiting store (en producción usar Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Límites diferenciados por tipo de endpoint
const RATE_LIMITS = {
  // Endpoints de autenticación — más restrictivos (prevenir brute force)
  auth:        { window: 15 * 60 * 1000, max: 30 },
  // APIs normales autenticadas — por usuario, límite generoso
  authenticated: { window: 60 * 1000, max: 300 },   // 300 req/min por usuario
  // APIs públicas sin sesión — por IP
  public:      { window: 60 * 1000, max: 60 },       // 60 req/min por IP
}

// Rutas excluidas del rate limiting (SSE, streams, endpoints de config pública)
const RATE_LIMIT_EXCLUDED = [
  '/api/notifications/stream',
  '/api/auth/',
  '/api/config/session-timeout', // consultado cada 2 min por todos los usuarios
  '/api/families',               // datos de referencia — cacheados en Redis, se leen en cada página
  '/api/inventory/families',     // ídem para el endpoint de inventario
]

function getRateLimitKey(request: NextRequest, userId?: string): { key: string; limits: { window: number; max: number } } {
  const path = request.nextUrl.pathname

  // Excluir rutas específicas
  if (RATE_LIMIT_EXCLUDED.some(p => path.startsWith(p))) {
    return { key: '', limits: { window: 0, max: 0 } }
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'

  // Si hay usuario autenticado, usar userId como clave (más justo en entornos con proxy)
  if (userId) {
    return { key: `rl:user:${userId}`, limits: RATE_LIMITS.authenticated }
  }

  // Sin sesión — limitar por IP
  return { key: `rl:ip:${ip}`, limits: RATE_LIMITS.public }
}

function checkRateLimit(key: string, limits: { window: number; max: number }): { allowed: boolean; remaining: number; resetTime: number } {
  if (!key) return { allowed: true, remaining: 999, resetTime: 0 }

  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    const resetTime = now + limits.window
    rateLimitStore.set(key, { count: 1, resetTime })
    return { allowed: true, remaining: limits.max - 1, resetTime }
  }

  if (record.count >= limits.max) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }

  record.count++
  rateLimitStore.set(key, record)
  return { allowed: true, remaining: limits.max - record.count, resetTime: record.resetTime }
}

// Limpiar entradas expiradas cada 5 minutos para evitar memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) rateLimitStore.delete(key)
    }
  }, 5 * 60 * 1000)
}

export async function proxy(request: NextRequest) {
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

  // Para APIs, solo aplicar rate limiting y headers de seguridad
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next()

    // Headers de seguridad básicos para APIs
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Request-ID', requestId)

    // Rate limiting — excluye /api/auth/ y SSE stream
    if (!request.nextUrl.pathname.startsWith('/api/auth/')) {
      // Leer userId del JWT si existe (sin bloquear — getToken es async pero ligero)
      let userId: string | undefined
      try {
        const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
        userId = token?.sub ?? undefined
      } catch { /* sin token — usar IP */ }

      const { key, limits } = getRateLimitKey(request, userId)
      const { allowed, remaining, resetTime } = checkRateLimit(key, limits)

      if (key) {
        response.headers.set('X-RateLimit-Limit', limits.max.toString())
        response.headers.set('X-RateLimit-Remaining', remaining.toString())
        response.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString())
      }

      if (!allowed) {
        ApplicationLogger.securityEvent(
          'rate_limit_exceeded',
          'medium',
          { ip, path, method, userId: userId ?? 'anonymous' },
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
              'X-Request-ID': requestId,
            },
          }
        )
      }
    }

    ApplicationLogger.child({ requestId, component: 'api' }).debug(
      `API request: ${method} ${path}`,
      { metadata: { ip, userAgent: request.headers.get('user-agent') } }
    )

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

  const isPublic = isPublicRoute(request.nextUrl.pathname)
  const isProtected = isProtectedRoute(request.nextUrl.pathname)

  // Permitir acceso a la página de inicio con parámetro preview
  const isPreview = request.nextUrl.searchParams.get('preview') === 'true'
  if (request.nextUrl.pathname === '/' && isPreview) {
    ApplicationLogger.child({ requestId, component: 'middleware' }).debug(
      `Preview mode accessed: ${path}`,
      { metadata: { isPreview: true } }
    )
    return response
  }

  if (isPublic) {
    ApplicationLogger.child({ requestId, component: 'middleware' }).debug(
      `Public path accessed: ${path}`,
      { metadata: { isPublic: true } }
    )
    return response
  }

  if (isProtected) {
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

    // Helper: dashboard por rol
    const dashboardForRole = (role: string) => {
      if (role === 'ADMIN') return '/admin'
      if (role === 'TECHNICIAN') return '/technician'
      return '/client'
    }

    // Solo ADMIN puede acceder a configuración del sistema
    if (path.startsWith('/settings') && userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url))
    }

    if (path.startsWith('/admin') && userRole !== 'ADMIN') {
      ApplicationLogger.securityEvent(
        'insufficient_privileges',
        'medium',
        { userId, userRole, requiredRole: 'ADMIN', path, ip },
        { requestId }
      )
      return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url))
    }

    if (path.startsWith('/technician') && userRole !== 'TECHNICIAN') {
      ApplicationLogger.securityEvent(
        'insufficient_privileges',
        'medium',
        { userId, userRole, requiredRole: 'TECHNICIAN', path, ip },
        { requestId }
      )
      // Si el usuario tiene un rol válido, redirigir a su dashboard
      // (puede ser un cambio de rol reciente — el JWT se actualizará en el próximo ciclo)
      return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url))
    }

    if (path.startsWith('/client') && userRole !== 'CLIENT') {
      ApplicationLogger.securityEvent(
        'insufficient_privileges',
        'medium',
        { userId, userRole, requiredRole: 'CLIENT', path, ip },
        { requestId }
      )
      return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url))
    }

    // Rutas de inventario:
    // - ADMIN: acceso total
    // - TECHNICIAN: acceso total (granularidad en API routes)
    // - CLIENT gestor (canManageInventory): acceso a rutas operativas de sus familias
    // - CLIENT sin gestión: solo puede ver sus equipos asignados, licencias, actas y mantenimientos
    if (path.startsWith('/inventory')) {
      if (userRole === 'CLIENT') {
        const canManage = (token as any).canManageInventory === true
        if (!canManage) {
          const clientAllowed = [
            '/inventory',                    // lista de equipos asignados
            '/inventory/equipment',          // detalle de equipo
            '/inventory/licenses',           // sus licencias
            '/inventory/acts',               // sus actas
            '/inventory/maintenance',        // sus mantenimientos
          ]
          const isAllowed = clientAllowed.some(r => path === r || path.startsWith(r + '/'))
          if (!isAllowed) {
            return NextResponse.redirect(new URL('/client', request.url))
          }
        } else {
          // Cliente gestor: puede acceder a rutas operativas pero no a configuración del sistema
          const clientManagerBlocked = [
            '/inventory/equipment-types',
            '/inventory/consumable-types',
            '/inventory/license-types',
            '/inventory/units-of-measure',
            '/inventory/warehouses',
            '/settings/inventory',
          ]
          const isBlocked = clientManagerBlocked.some(r => path === r || path.startsWith(r + '/'))
          if (isBlocked) {
            return NextResponse.redirect(new URL('/client', request.url))
          }
        }
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
        isProtected,
        hasAuth: !!isProtected,
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
