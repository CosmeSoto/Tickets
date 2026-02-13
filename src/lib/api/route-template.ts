/**
 * TEMPLATE PARA RUTAS API
 *
 * Proporciona un wrapper reutilizable para crear rutas API
 * con validación, autenticación y manejo de errores consistente
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { ApiResponseBuilder, withErrorHandling, PaginationUtils } from './response-builder'
import { createSecureApiRoute, SecurityConfig } from '@/lib/security/middleware'
import { ValidationService } from '@/lib/security/validation'
import { ApplicationLogger, withApiLogging } from '@/lib/logging'

export interface RouteConfig {
  // Configuración de autenticación
  auth?: {
    required: boolean
    roles?: string[] // Roles permitidos
  }

  // Configuración de validación
  validation?: {
    query?: z.ZodSchema
    body?: z.ZodSchema
    params?: z.ZodSchema
  }

  // Configuración de paginación
  pagination?: {
    enabled: boolean
    defaultLimit?: number
    maxLimit?: number
  }

  // Configuración de seguridad
  security?: SecurityConfig

  // Configuración de rate limiting específica
  rateLimit?: {
    windowMs: number
    maxRequests: number
  }
}

export interface RouteContext {
  user?: any
  query: Record<string, any>
  body?: any
  params?: Record<string, any>
  pagination?: {
    page: number
    limit: number
    offset: number
  }
  requestId: string
}

export type RouteHandler = (request: NextRequest, context: RouteContext) => Promise<NextResponse>

/**
 * Crea una ruta API con configuración completa
 */
export function createApiRoute(
  handler: RouteHandler,
  config: RouteConfig = {}
): (request: NextRequest, params?: { params: Promise<any> }) => Promise<NextResponse> {
  const wrappedHandler = withErrorHandling(
    async (request: NextRequest, routeParams?: { params: Promise<any> }) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const context: RouteContext = { requestId, query: {} }
      const path = new URL(request.url).pathname
      const method = request.method

      // Log API request start
      ApplicationLogger.apiRequestStart(method, path, {
        requestId,
        metadata: {
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        },
      })

      const startTime = performance.now()

      try {
        // 1. Autenticación
        if (config.auth?.required) {
          const session = await getServerSession(authOptions)

          if (!session) {
            ApplicationLogger.authenticationAttempt('unknown', false, { requestId })
            return ApiResponseBuilder.unauthorized('Autenticación requerida', requestId)
          }

          // Verificar roles si están especificados
          if (config.auth.roles && !config.auth.roles.includes(session.user.role)) {
            ApplicationLogger.authorizationCheck(
              session.user.id,
              path,
              method,
              false,
              { requestId }
            )
            return ApiResponseBuilder.forbidden(
              'No tienes permisos para acceder a este recurso',
              requestId
            )
          }

          ApplicationLogger.authenticationAttempt(session.user.email, true, { 
            requestId,
            userId: session.user.id 
          })
          
          if (config.auth.roles) {
            ApplicationLogger.authorizationCheck(
              session.user.id,
              path,
              method,
              true,
              { requestId }
            )
          }

          context.user = session.user
        }

        // 2. Extraer y validar parámetros de query
        const { searchParams } = new URL(request.url)
        const queryParams: Record<string, any> = {}

        for (const [key, value] of searchParams.entries()) {
          queryParams[key] = value
        }

        // Validar query params si hay schema
        if (config.validation?.query) {
          try {
            context.query = config.validation.query.parse(queryParams)
          } catch (error) {
            if (error instanceof z.ZodError) {
              const duration = performance.now() - startTime
              ApplicationLogger.apiRequestComplete(method, path, 400, duration, { requestId })
              return ApiResponseBuilder.validationError(error, requestId)
            }
            throw error
          }
        } else {
          context.query = ValidationService.sanitizeObject(queryParams)
        }

        // 3. Extraer y validar parámetros de ruta
        if (routeParams?.params && config.validation?.params) {
          try {
            const awaitedParams = await routeParams.params
            context.params = config.validation.params.parse(awaitedParams)
          } catch (error) {
            if (error instanceof z.ZodError) {
              const duration = performance.now() - startTime
              ApplicationLogger.apiRequestComplete(method, path, 400, duration, { requestId })
              return ApiResponseBuilder.validationError(error, requestId)
            }
            throw error
          }
        } else if (routeParams?.params) {
          const awaitedParams = await routeParams.params
          context.params = ValidationService.sanitizeObject(awaitedParams)
        }

        // 4. Extraer y validar body para métodos que lo requieren
        if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
          try {
            const rawBody = await request.json()

            if (config.validation?.body) {
              context.body = config.validation.body.parse(rawBody)
            } else {
              context.body = ValidationService.sanitizeObject(rawBody)
            }
          } catch (error) {
            if (error instanceof z.ZodError) {
              const duration = performance.now() - startTime
              ApplicationLogger.apiRequestComplete(method, path, 400, duration, { requestId })
              return ApiResponseBuilder.validationError(error, requestId)
            }
            const duration = performance.now() - startTime
            ApplicationLogger.apiRequestComplete(method, path, 400, duration, { requestId })
            return ApiResponseBuilder.error(
              'INVALID_INPUT',
              'Formato de datos inválido',
              400,
              undefined,
              requestId
            )
          }
        }

        // 5. Configurar paginación si está habilitada
        if (config.pagination?.enabled) {
          const { page, limit } = PaginationUtils.validatePaginationParams(
            context.query.page,
            context.query.limit || config.pagination.defaultLimit
          )

          // Aplicar límite máximo si está configurado
          const finalLimit = config.pagination.maxLimit
            ? Math.min(limit, config.pagination.maxLimit)
            : limit

          context.pagination = {
            page,
            limit: finalLimit,
            offset: PaginationUtils.calculateOffset(page, finalLimit),
          }
        }

        // 6. Ejecutar el handler
        const response = await handler(request, context)
        
        // Log successful completion
        const duration = performance.now() - startTime
        ApplicationLogger.apiRequestComplete(method, path, response.status, duration, { 
          requestId,
          userId: context.user?.id 
        })

        return response

      } catch (error) {
        const duration = performance.now() - startTime
        const err = error instanceof Error ? error : new Error(String(error))
        
        ApplicationLogger.apiRequestError(method, path, err, { 
          requestId,
          userId: context.user?.id 
        })
        
        // Re-throw to maintain existing error handling
        throw error
      }
    }
  )

  // Apply logging middleware first, then security middleware
  const loggedHandler = withApiLogging(wrappedHandler, {
    logRequestBody: false, // Already handled in route template
    logResponseBody: false,
    logHeaders: false,
  })

  // Aplicar middleware de seguridad si está configurado
  if (config.security) {
    const secureHandler = createSecureApiRoute(loggedHandler, config.security)
    return (request: NextRequest, params?: { params: Promise<any> }) => {
      return secureHandler(request, params) as Promise<NextResponse>
    }
  }

  // Wrapper para asegurar el tipo correcto de retorno
  return (request: NextRequest, params?: { params: Promise<any> }) => {
    return loggedHandler(request, params) as Promise<NextResponse>
  }
}

/**
 * Configuraciones predefinidas para diferentes tipos de rutas
 */
export const RouteConfigs = {
  // Ruta pública sin autenticación
  public: {
    auth: { required: false },
    security: {
      rateLimit: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
      validateInput: true,
      securityHeaders: true,
    },
  },

  // Ruta autenticada básica
  authenticated: {
    auth: { required: true },
    security: {
      rateLimit: { windowMs: 15 * 60 * 1000, maxRequests: 1000 },
      csrf: true,
      validateInput: true,
      securityHeaders: true,
    },
  },

  // Ruta solo para administradores
  adminOnly: {
    auth: { required: true, roles: ['ADMIN'] },
    security: {
      rateLimit: { windowMs: 15 * 60 * 1000, maxRequests: 200 },
      csrf: true,
      validateInput: true,
      securityHeaders: true,
    },
  },

  // Ruta para técnicos y administradores
  technicianOrAdmin: {
    auth: { required: true, roles: ['TECHNICIAN', 'ADMIN'] },
    security: {
      rateLimit: { windowMs: 15 * 60 * 1000, maxRequests: 500 },
      csrf: true,
      validateInput: true,
      securityHeaders: true,
    },
  },

  // Ruta con paginación
  paginated: {
    auth: { required: true },
    pagination: { enabled: true, defaultLimit: 10, maxLimit: 100 },
    security: {
      rateLimit: { windowMs: 15 * 60 * 1000, maxRequests: 500 },
      csrf: false, // GET requests don't need CSRF
      validateInput: true,
      securityHeaders: true,
    },
  },

  // Ruta para subida de archivos
  upload: {
    auth: { required: true },
    security: {
      rateLimit: { windowMs: 60 * 60 * 1000, maxRequests: 50 },
      csrf: true,
      validateInput: false, // Files validated separately
      securityHeaders: true,
    },
  },
} as const

/**
 * Schemas de validación comunes
 */
export const CommonValidationSchemas = {
  // Parámetros de ID
  idParam: z.object({
    id: z.string().cuid('ID debe ser un CUID válido'),
  }),

  // Paginación en query
  paginationQuery: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),

  // Filtros de búsqueda
  searchQuery: z.object({
    search: z.string().max(100).optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    categoryId: z.string().cuid().optional(),
  }),

  // Filtros de fecha
  dateRangeQuery: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
}

/**
 * Helpers para respuestas comunes
 */
export class RouteHelpers {
  /**
   * Respuesta de lista paginada
   */
  static paginatedList<T>(data: T[], total: number, context: RouteContext): NextResponse {
    if (!context.pagination) {
      throw new Error('Paginación no configurada')
    }

    const pagination = PaginationUtils.calculatePagination(
      context.pagination.page,
      context.pagination.limit,
      total
    )

    return ApiResponseBuilder.paginated(data, pagination, 200, context.requestId)
  }

  /**
   * Respuesta de recurso creado
   */
  static created<T>(data: T, context: RouteContext): NextResponse {
    return ApiResponseBuilder.success(data, 201, context.requestId)
  }

  /**
   * Respuesta de recurso actualizado
   */
  static updated<T>(data: T, context: RouteContext): NextResponse {
    return ApiResponseBuilder.success(data, 200, context.requestId)
  }

  /**
   * Respuesta de recurso eliminado
   */
  static deleted(context: RouteContext): NextResponse {
    return ApiResponseBuilder.success(
      { message: 'Recurso eliminado correctamente' },
      200,
      context.requestId
    )
  }

  /**
   * Respuesta de operación exitosa sin datos
   */
  static noContent(context: RouteContext): NextResponse {
    return new NextResponse(null, { status: 204 })
  }
}
