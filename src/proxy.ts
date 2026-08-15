import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { ApplicationLogger } from '@/lib/logging'
import { isPublicRoute, isProtectedRoute } from './middleware-config'
import { checkMaintenanceForApi } from '@/lib/api/check-maintenance-api'

// Rate limiting store (en producción usar Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Límites diferenciados por tipo de endpoint
const RATE_LIMITS = {
  // Endpoints de autenticación — más restrictivos (prevenir brute force)
  auth: { window: 15 * 60 * 1000, max: 30 },
  // APIs normales autenticadas — por usuario (SPA con varios contextos en paralelo)
  authenticated: { window: 60 * 1000, max: 600 },
  // APIs públicas sin sesión — por IP
  public: { window: 60 * 1000, max: 120 },
}

// Rutas excluidas del rate limiting (SSE, streams, datos de referencia, inbox)
const RATE_LIMIT_EXCLUDED = [
  '/api/notifications/stream',
  '/api/notifications', // campana / inbox (SSE ya excluido arriba)
  '/api/auth/',
  '/api/config/session-timeout',
  '/api/config/maintenance',
  '/api/families',
  '/api/inventory/families',
  '/api/inventory/suppliers',
  '/api/users',
  '/api/departments',
  '/api/credentials/vaults',
  '/api/credentials/entries',
]

function getRateLimitKey(
  request: NextRequest,
  userId?: string
): { key: string; limits: { window: number; max: number } } {
  const path = request.nextUrl.pathname

  // Excluir rutas específicas
  if (RATE_LIMIT_EXCLUDED.some(p => path.startsWith(p))) {
    return { key: '', limits: { window: 0, max: 0 } }
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded
    ? forwarded.split(',')[0].trim()
    : request.headers.get('x-real-ip') || 'unknown'

  // Si hay usuario autenticado, usar userId como clave (más justo en entornos con proxy)
  if (userId) {
    return { key: `rl:user:${userId}`, limits: RATE_LIMITS.authenticated }
  }

  // Sin sesión — limitar por IP
  return { key: `rl:ip:${ip}`, limits: RATE_LIMITS.public }
}

function checkRateLimit(
  key: string,
  limits: { window: number; max: number }
): { allowed: boolean; remaining: number; resetTime: number } {
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
  setInterval(
    () => {
      const now = Date.now()
      for (const [key, record] of rateLimitStore.entries()) {
        if (now > record.resetTime) rateLimitStore.delete(key)
      }
    },
    5 * 60 * 1000
  )
}

export async function proxy(request: NextRequest) {
  const startTime = performance.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const path = request.nextUrl.pathname
  const method = request.method
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown'

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
    const maintenanceBlock = await checkMaintenanceForApi(request)
    if (maintenanceBlock) return maintenanceBlock

    const response = NextResponse.next()

    // Rutas que sirven archivos para vista previa en iframe (mismo origen).
    // Estas necesitan SAMEORIGIN en lugar de DENY para que PdfPreviewModal / FilePreviewModal funcionen.
    const isFilePreviewRoute =
      /^\/api\/forms\/[^/]+\/file/.test(path) ||
      /^\/api\/admin\/forms\/[^/]+\/attachments\/[^/]+\/file/.test(path) ||
      /^\/api\/news\/[^/]+\/attachments\/[^/]+\/file/.test(path) ||
      /^\/api\/admin\/news\/[^/]+\/attachments\/[^/]+\/file/.test(path) ||
      /^\/api\/attachments\/[^/]+/.test(path) ||
      /^\/api\/tickets\/[^/]+\/attachments\/[^/]+/.test(path) ||
      /^\/api\/inventory\/acts\/[^/]+\/preview/.test(path) ||
      /^\/api\/inventory\/return-acts\/[^/]+\/preview/.test(path) ||
      /^\/api\/inventory\/decommission-acts\/[^/]+\/preview/.test(path) ||
      /^\/api\/inventory\/contract-return-acts\/[^/]+\/preview/.test(path)

    // Headers de seguridad básicos para APIs
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', isFilePreviewRoute ? 'SAMEORIGIN' : 'DENY')
    response.headers.set('X-Request-ID', requestId)

    // Rate limiting — excluye /api/auth/ y SSE stream
    if (!request.nextUrl.pathname.startsWith('/api/auth/')) {
      // Leer userId del JWT si existe (sin bloquear — getToken es async pero ligero)
      let userId: string | undefined
      let mustChangePassword = false
      let needsProfileCompletion = false
      let sessionError: string | undefined
      try {
        const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
        userId = token?.sub ?? undefined
        mustChangePassword = token?.mustChangePassword === true
        needsProfileCompletion = token?.needsProfileCompletion === true
        sessionError = token?.error as string | undefined
      } catch {
        /* sin token — usar IP */
      }

      if (
        sessionError === 'UserDeleted' ||
        sessionError === 'UserDeactivated' ||
        sessionError === 'SessionExpired'
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              sessionError === 'UserDeleted'
                ? 'Tu cuenta fue eliminada'
                : sessionError === 'UserDeactivated'
                  ? 'Tu cuenta fue desactivada'
                  : 'Tu sesión expiró',
            code: sessionError,
          },
          { status: 401, headers: { 'X-Request-ID': requestId } }
        )
      }

      // Completar perfil: bloquear APIs excepto el endpoint de completar perfil
      if (
        needsProfileCompletion &&
        !path.startsWith('/api/user/complete-profile') &&
        !path.startsWith('/api/departments') &&
        !path.startsWith('/api/auth/')
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'Debes completar tu departamento y teléfono celular antes de continuar',
            code: 'PROFILE_COMPLETION_REQUIRED',
          },
          { status: 403, headers: { 'X-Request-ID': requestId } }
        )
      }

      // Forzar cambio de contraseña: bloquear APIs excepto el propio endpoint de cambio
      if (
        mustChangePassword &&
        !path.startsWith('/api/user/change-password') &&
        !path.startsWith('/api/auth/password-policy')
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'Debes cambiar tu contraseña antes de continuar',
            code: 'PASSWORD_CHANGE_REQUIRED',
          },
          { status: 403, headers: { 'X-Request-ID': requestId } }
        )
      }

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
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
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

    const tokenError = token.error as string | undefined
    if (
      tokenError === 'UserDeleted' ||
      tokenError === 'UserDeactivated' ||
      tokenError === 'SessionExpired'
    ) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set(
        'reason',
        tokenError === 'UserDeleted'
          ? 'deleted'
          : tokenError === 'UserDeactivated'
            ? 'deactivated'
            : 'timeout'
      )
      return NextResponse.redirect(loginUrl)
    }

    // Política: forzar cambio de contraseña antes de usar el sistema
    if (token.mustChangePassword === true && path !== '/change-password') {
      const changePasswordUrl = new URL('/change-password', request.url)
      changePasswordUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
      return NextResponse.redirect(changePasswordUrl)
    }

    // Política: completar departamento antes de usar el sistema (OAuth / registro)
    if (token.needsProfileCompletion === true && path !== '/complete-profile') {
      const completeProfileUrl = new URL('/complete-profile', request.url)
      completeProfileUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
      return NextResponse.redirect(completeProfileUrl)
    }

    // Modo mantenimiento — redirigir usuarios bloqueados (admins/super admin pueden pasar)
    try {
      const { MaintenanceModeService } = await import('@/lib/services/maintenance-mode-service')
      const maintenance = await MaintenanceModeService.shouldBlockUser({
        role: token.role as string,
        isSuperAdmin: token.isSuperAdmin === true,
      })
      if (maintenance.block && !path.startsWith('/admin/settings')) {
        return NextResponse.redirect(new URL('/maintenance', request.url))
      }
    } catch {
      /* continuar si falla la lectura */
    }

    // Verificar permisos por rol
    const userRole = token.role as string
    const userId = token.sub as string

    ApplicationLogger.authorizationCheck(userId, path, 'access', true, {
      requestId,
      metadata: { role: userRole },
    })

    // Helper: dashboard por rol
    const dashboardForRole = (role: string) => {
      if (role === 'ADMIN') return '/admin'
      if (role === 'TECHNICIAN') return '/technician'
      return '/client'
    }

    // /admin/settings es la configuración del sistema (protegida por el bloque /admin abajo)
    // /settings es la configuración personal del usuario (accesible para todos los roles)

    if (path.startsWith('/admin') && userRole !== 'ADMIN' && !(token as any).isSuperAdmin) {
      // Noticias/Documentos admin: JWT manage + módulo habilitado.
      // Módulo activo sin canManage* = solo lectura en feed /forms (no /admin).
      // Rondas: TECH con patrolsEnabled → agenda/reportes/incidentes admin (no config).
      // CLIENT con patrolsEnabled usa solo /patrol (Mis Rondas), no la consola admin.
      const techPatrolSuperviseAllowed =
        userRole === 'TECHNICIAN' &&
        (token as any).patrolsEnabled === true &&
        (path === '/admin/patrols' ||
          path.startsWith('/admin/patrols/reports') ||
          path.startsWith('/admin/patrols/incidents'))

      if (
        (path.startsWith('/admin/news') &&
          (token as any).canManageNews === true &&
          (token as any).newsEnabled === true) ||
        (path.startsWith('/admin/forms') &&
          (token as any).canManageForms === true &&
          (token as any).formsEnabled === true) ||
        (path.startsWith('/admin/processes') &&
          (token as any).canManageProcesses === true &&
          (token as any).processesEnabled === true) ||
        techPatrolSuperviseAllowed
      ) {
        // Permitir acceso a gestión de noticias, formularios o supervisión de rondas
      } else {
        ApplicationLogger.securityEvent(
          'insufficient_privileges',
          'medium',
          { userId, userRole, requiredRole: 'ADMIN', path, ip },
          { requestId }
        )
        return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url))
      }
    }

    // Auditoría: solo Super Admin (la UI ya filtra; el proxy cierra la URL directa)
    if (path.startsWith('/admin/audit') && (token as any).isSuperAdmin !== true) {
      ApplicationLogger.securityEvent(
        'insufficient_privileges',
        'medium',
        { userId, userRole, requiredCapability: 'isSuperAdmin', path, ip },
        { requestId }
      )
      return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url))
    }

    // Configuración de Procesos: solo Super Admin escribe política; la UI de settings
    // queda cerrada a gestores vía nav + proxy (API GET sí permite gestores).
    if (path.startsWith('/admin/processes/settings') && (token as any).isSuperAdmin !== true) {
      ApplicationLogger.securityEvent(
        'insufficient_privileges',
        'medium',
        { userId, userRole, requiredCapability: 'isSuperAdmin', path, ip },
        { requestId }
      )
      return NextResponse.redirect(new URL('/admin/processes', request.url))
    }

    // ADMIN de familia: respetar toggles de módulos (Super Admin exento).
    if (userRole === 'ADMIN' && (token as any).isSuperAdmin !== true) {
      if (
        (path.startsWith('/admin/tickets') || path === '/admin/tickets') &&
        (token as any).ticketsEnabled !== true
      ) {
        ApplicationLogger.securityEvent(
          'insufficient_privileges',
          'medium',
          { userId, userRole, requiredCapability: 'ticketsEnabled', path, ip },
          { requestId }
        )
        return NextResponse.redirect(new URL('/admin', request.url))
      }
      if (path.startsWith('/admin/news') && (token as any).newsEnabled !== true) {
        ApplicationLogger.securityEvent(
          'insufficient_privileges',
          'medium',
          { userId, userRole, requiredCapability: 'newsEnabled', path, ip },
          { requestId }
        )
        return NextResponse.redirect(new URL('/admin', request.url))
      }
      if (path.startsWith('/admin/forms') && (token as any).formsEnabled !== true) {
        ApplicationLogger.securityEvent(
          'insufficient_privileges',
          'medium',
          { userId, userRole, requiredCapability: 'formsEnabled', path, ip },
          { requestId }
        )
        return NextResponse.redirect(new URL('/admin', request.url))
      }
      if (path.startsWith('/admin/processes') && (token as any).processesEnabled !== true) {
        ApplicationLogger.securityEvent(
          'insufficient_privileges',
          'medium',
          { userId, userRole, requiredCapability: 'processesEnabled', path, ip },
          { requestId }
        )
        return NextResponse.redirect(new URL('/admin', request.url))
      }
      if (
        (path.startsWith('/admin/patrols') || path === '/admin/patrols') &&
        (token as any).patrolsEnabled !== true
      ) {
        ApplicationLogger.securityEvent(
          'insufficient_privileges',
          'medium',
          { userId, userRole, requiredCapability: 'patrolsEnabled', path, ip },
          { requestId }
        )
        return NextResponse.redirect(new URL('/admin', request.url))
      }
      if (
        (path.startsWith('/inventory') ||
          path === '/settings/inventory' ||
          path.startsWith('/settings/inventory/')) &&
        (token as any).inventoryEnabled !== true &&
        (token as any).canManageInventory !== true
      ) {
        ApplicationLogger.securityEvent(
          'insufficient_privileges',
          'medium',
          { userId, userRole, requiredCapability: 'inventoryEnabled', path, ip },
          { requestId }
        )
        return NextResponse.redirect(new URL('/admin', request.url))
      }
    }

    // TECH/CLIENT: tickets requieren ticketsEnabled
    if (
      ((path.startsWith('/technician/tickets') && userRole === 'TECHNICIAN') ||
        (path.startsWith('/client/tickets') && userRole === 'CLIENT')) &&
      (token as any).ticketsEnabled !== true
    ) {
      ApplicationLogger.securityEvent(
        'insufficient_privileges',
        'medium',
        { userId, userRole, requiredCapability: 'ticketsEnabled', path, ip },
        { requestId }
      )
      return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url))
    }

    // Base de conocimientos: requiere Tickets + canAccessKnowledge (Super Admin exento)
    const isKnowledgePath =
      path === '/knowledge' ||
      path.startsWith('/knowledge/') ||
      path === '/admin/knowledge' ||
      path.startsWith('/admin/knowledge/') ||
      path === '/technician/knowledge' ||
      path.startsWith('/technician/knowledge/')
    if (
      isKnowledgePath &&
      (token as any).isSuperAdmin !== true &&
      ((token as any).ticketsEnabled !== true || (token as any).canAccessKnowledge === false)
    ) {
      ApplicationLogger.securityEvent(
        'insufficient_privileges',
        'medium',
        { userId, userRole, requiredCapability: 'canAccessKnowledge', path, ip },
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

    // Documentos (lectura): todos excepto Super Admin requieren formsEnabled o canManageForms.
    if (
      path.startsWith('/forms') &&
      (token as any).isSuperAdmin !== true &&
      (token as any).formsEnabled !== true &&
      (token as any).canManageForms !== true
    ) {
      ApplicationLogger.securityEvent(
        'insufficient_privileges',
        'medium',
        { userId, userRole, requiredCapability: 'formsEnabled', path, ip },
        { requestId }
      )
      return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url))
    }

    // Procesos y procedimientos: requiere habilitación del módulo (Super Admin exento).
    if (
      path.startsWith('/processes') &&
      (token as any).isSuperAdmin !== true &&
      (token as any).processesEnabled !== true &&
      (token as any).canManageProcesses !== true
    ) {
      ApplicationLogger.securityEvent(
        'insufficient_privileges',
        'medium',
        { userId, userRole, requiredCapability: 'processesEnabled', path, ip },
        { requestId }
      )
      return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url))
    }

    // Accesos (pases QR): requiere accessEnabled o canManageAccess (Super Admin exento).
    if (
      path.startsWith('/access') &&
      (token as any).isSuperAdmin !== true &&
      (token as any).accessEnabled !== true &&
      (token as any).canManageAccess !== true
    ) {
      ApplicationLogger.securityEvent(
        'insufficient_privileges',
        'medium',
        { userId, userRole, requiredCapability: 'accessEnabled', path, ip },
        { requestId }
      )
      return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url))
    }

    // Credenciales: requieren credentialsEnabled (SuperAdmin exento).
    if (
      path.startsWith('/credentials') &&
      (token as any).isSuperAdmin !== true &&
      (token as any).credentialsEnabled !== true
    ) {
      ApplicationLogger.securityEvent(
        'insufficient_privileges',
        'medium',
        { userId, userRole, requiredCapability: 'credentialsEnabled', path, ip },
        { requestId }
      )
      return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url))
    }

    // Rondas (agente): TECH/CLIENT requieren patrolsEnabled. ADMIN puede monitorear.
    if (
      (path.startsWith('/patrol') || path.startsWith('/patrol-checkpoint-display')) &&
      userRole !== 'ADMIN' &&
      (token as any).patrolsEnabled !== true
    ) {
      ApplicationLogger.securityEvent(
        'insufficient_privileges',
        'medium',
        { userId, userRole, requiredCapability: 'patrolsEnabled', path, ip },
        { requestId }
      )
      return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url))
    }

    // Rutas de inventario:
    // - Super Admin: acceso total
    // - ADMIN/TECH/CLIENT: inventoryEnabled o canManageInventory; CLIENT sin gestión → allowlist
    if (
      path.startsWith('/inventory') ||
      path === '/settings/inventory' ||
      path.startsWith('/settings/inventory/')
    ) {
      const isSuper = (token as any).isSuperAdmin === true
      const invOn = (token as any).inventoryEnabled === true
      const canManage = (token as any).canManageInventory === true
      const canRequest = (token as any).canRequestAssets === true

      if (!isSuper && !invOn && !canManage && !(userRole === 'CLIENT' && canRequest)) {
        ApplicationLogger.securityEvent(
          'insufficient_privileges',
          'medium',
          { userId, userRole, requiredCapability: 'inventoryEnabled', path, ip },
          { requestId }
        )
        return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url))
      }

      if (userRole === 'CLIENT' && !canManage) {
        const clientAllowed = [
          '/inventory',
          '/inventory/equipment',
          '/inventory/license',
          '/inventory/suministros',
          '/inventory/acts',
          '/inventory/maintenance',
          '/inventory/contracts',
        ]
        if (canRequest) {
          clientAllowed.push('/inventory/asset-requests')
        }
        const isAllowed = clientAllowed.some(r => path === r || path.startsWith(r + '/'))
        if (!isAllowed) {
          return NextResponse.redirect(new URL('/client', request.url))
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
