/**
 * MIDDLEWARE DE SEGURIDAD
 *
 * Proporciona middleware para protección CSRF, rate limiting,
 * validación de entrada y headers de seguridad
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { ValidationService } from './validation'

// Configuración de rate limiting (en memoria para desarrollo)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Configuración de CSRF tokens (en memoria para desarrollo)
const csrfTokens = new Set<string>()

export interface SecurityConfig {
  rateLimit?: {
    windowMs: number
    maxRequests: number
  }
  csrf?: boolean
  validateInput?: boolean
  securityHeaders?: boolean
}

export class SecurityMiddleware {
  /**
   * Aplica headers de seguridad a la respuesta
   */
  static applySecurityHeaders(response: NextResponse): NextResponse {
    // Content Security Policy
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' data:; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none';"
    )

    // Otros headers de seguridad
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

    // HSTS (solo en HTTPS)
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }

    return response
  }

  /**
   * Implementa rate limiting básico
   */
  static checkRateLimit(
    request: NextRequest,
    config: { windowMs: number; maxRequests: number }
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const clientId = this.getClientId(request)
    const now = Date.now()
    const windowStart = now - config.windowMs

    // Limpiar entradas expiradas
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key)
      }
    }

    const current = rateLimitStore.get(clientId)

    if (!current || current.resetTime < now) {
      // Nueva ventana de tiempo
      const resetTime = now + config.windowMs
      rateLimitStore.set(clientId, { count: 1, resetTime })
      return { allowed: true, remaining: config.maxRequests - 1, resetTime }
    }

    if (current.count >= config.maxRequests) {
      // Límite excedido
      return { allowed: false, remaining: 0, resetTime: current.resetTime }
    }

    // Incrementar contador
    current.count++
    rateLimitStore.set(clientId, current)

    return {
      allowed: true,
      remaining: config.maxRequests - current.count,
      resetTime: current.resetTime,
    }
  }

  /**
   * Genera y valida tokens CSRF
   */
  static generateCsrfToken(): string {
    const token = crypto.randomUUID()
    csrfTokens.add(token)

    // Limpiar tokens antiguos (mantener solo los últimos 1000)
    if (csrfTokens.size > 1000) {
      const tokensArray = Array.from(csrfTokens)
      csrfTokens.clear()
      tokensArray.slice(-500).forEach(t => csrfTokens.add(t))
    }

    return token
  }

  /**
   * Valida token CSRF
   */
  static validateCsrfToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false
    }

    const isValid = csrfTokens.has(token)

    // Eliminar token después de uso (one-time use)
    if (isValid) {
      csrfTokens.delete(token)
    }

    return isValid
  }

  /**
   * Obtiene identificador único del cliente
   */
  private static getClientId(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0] || realIp || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    return `${ip}:${userAgent}`.substring(0, 100)
  }

  /**
   * Valida método HTTP permitido
   */
  static validateHttpMethod(request: NextRequest, allowedMethods: string[]): boolean {
    return allowedMethods.includes(request.method)
  }

  /**
   * Extrae y valida datos del cuerpo de la petición
   */
  static async validateRequestBody(request: NextRequest): Promise<any> {
    try {
      const contentType = request.headers.get('content-type') || ''

      if (contentType.includes('application/json')) {
        const body = await request.json()
        return ValidationService.sanitizeObject(body)
      }

      if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData()
        const body: any = {}

        for (const [key, value] of formData.entries()) {
          body[ValidationService.sanitizeText(key)] =
            typeof value === 'string' ? ValidationService.sanitizeText(value) : value
        }

        return body
      }

      return {}
    } catch (error) {
      throw new Error('Formato de datos inválido')
    }
  }
}

/**
 * Wrapper para crear rutas API seguras
 */
export function createSecureApiRoute(
  handler: (request: NextRequest, context: any) => Promise<NextResponse | Response>,
  config: SecurityConfig = {}
) {
  return async (request: NextRequest, context: any) => {
    try {
      // 1. Validar método HTTP
      const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
      if (!SecurityMiddleware.validateHttpMethod(request, allowedMethods)) {
        return NextResponse.json({ error: 'Método no permitido' }, { status: 405 })
      }

      // 2. Rate limiting
      if (config.rateLimit) {
        const rateCheck = SecurityMiddleware.checkRateLimit(request, config.rateLimit)

        if (!rateCheck.allowed) {
          const response = NextResponse.json(
            {
              error: 'Demasiadas peticiones',
              retryAfter: Math.ceil((rateCheck.resetTime - Date.now()) / 1000),
            },
            { status: 429 }
          )

          response.headers.set('X-RateLimit-Limit', config.rateLimit.maxRequests.toString())
          response.headers.set('X-RateLimit-Remaining', '0')
          response.headers.set('X-RateLimit-Reset', rateCheck.resetTime.toString())

          return SecurityMiddleware.applySecurityHeaders(response)
        }
      }

      // 3. Validación CSRF para métodos de escritura
      if (config.csrf && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        const csrfToken = request.headers.get('x-csrf-token')

        if (!csrfToken || !SecurityMiddleware.validateCsrfToken(csrfToken)) {
          return NextResponse.json({ error: 'Token CSRF inválido o faltante' }, { status: 403 })
        }
      }

      // 4. Validar y sanitizar entrada
      if (config.validateInput && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        try {
          const sanitizedBody = await SecurityMiddleware.validateRequestBody(request)
          // Agregar el cuerpo sanitizado al contexto
          context.sanitizedBody = sanitizedBody
        } catch (error) {
          return NextResponse.json({ error: 'Datos de entrada inválidos' }, { status: 400 })
        }
      }

      // 5. Ejecutar el handler
      const response = await handler(request, context)

      // 6. Aplicar headers de seguridad
      if (config.securityHeaders !== false) {
        // Convertir Response a NextResponse si es necesario
        if (response instanceof NextResponse) {
          return SecurityMiddleware.applySecurityHeaders(response)
        } else {
          // Si es Response, crear un NextResponse equivalente
          const nextResponse = NextResponse.json(
            response.body ? await response.json() : null,
            { status: response.status, statusText: response.statusText }
          )
          return SecurityMiddleware.applySecurityHeaders(nextResponse)
        }
      }

      return response
    } catch (error) {
      console.error('Error en middleware de seguridad:', error)

      const response = NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })

      return SecurityMiddleware.applySecurityHeaders(response)
    }
  }
}

/**
 * Configuraciones predefinidas para diferentes tipos de endpoints
 */
export const SecurityConfigs = {
  // Para endpoints públicos (login, registro)
  public: {
    rateLimit: { windowMs: 15 * 60 * 1000, maxRequests: 100 }, // 100 req/15min
    csrf: false,
    validateInput: true,
    securityHeaders: true,
  },

  // Para endpoints autenticados
  authenticated: {
    rateLimit: { windowMs: 15 * 60 * 1000, maxRequests: 1000 }, // 1000 req/15min
    csrf: true,
    validateInput: true,
    securityHeaders: true,
  },

  // Para endpoints administrativos
  admin: {
    rateLimit: { windowMs: 15 * 60 * 1000, maxRequests: 200 }, // 200 req/15min
    csrf: true,
    validateInput: true,
    securityHeaders: true,
  },

  // Para endpoints de archivos
  upload: {
    rateLimit: { windowMs: 60 * 60 * 1000, maxRequests: 50 }, // 50 req/hora
    csrf: true,
    validateInput: false, // Los archivos se validan por separado
    securityHeaders: true,
  },
} as const
