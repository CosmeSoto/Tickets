/**
 * CONSTRUCTOR DE RESPUESTAS API
 *
 * Proporciona una interfaz consistente para todas las respuestas de la API
 * con formato estandarizado, manejo de errores y metadatos
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

// Tipos para respuestas API
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    requestId: string
    timestamp: string
    version: string
    pagination?: PaginationMeta
  }
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ApiResponse['meta'] & {
    pagination: PaginationMeta
  }
}

// Códigos de error estandarizados
export const ErrorCodes = {
  // Errores de autenticación
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Errores de validación
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Errores de recursos
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  GONE: 'GONE',

  // Errores de rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Errores de servidor
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Errores de archivos
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',

  // Errores de negocio
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

export class ApiResponseBuilder {
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private static getApiVersion(): string {
    return process.env.API_VERSION || '1.0.0'
  }

  /**
   * Crea una respuesta de éxito
   */
  static success<T>(
    data: T,
    status: number = 200,
    requestId?: string
  ): NextResponse<ApiResponse<T>> {
    const response: ApiResponse<T> = {
      success: true,
      data,
      meta: {
        requestId: requestId || this.generateRequestId(),
        timestamp: new Date().toISOString(),
        version: this.getApiVersion(),
      },
    }

    return NextResponse.json(response, { status })
  }

  /**
   * Crea una respuesta paginada
   */
  static paginated<T>(
    data: T[],
    pagination: PaginationMeta,
    status: number = 200,
    requestId?: string
  ): NextResponse<PaginatedResponse<T>> {
    const response: PaginatedResponse<T> = {
      success: true,
      data,
      meta: {
        requestId: requestId || this.generateRequestId(),
        timestamp: new Date().toISOString(),
        version: this.getApiVersion(),
        pagination,
      },
    }

    return NextResponse.json(response, { status })
  }

  /**
   * Crea una respuesta de error
   */
  static error(
    code: ErrorCode,
    message: string,
    status: number,
    details?: any,
    requestId?: string
  ): NextResponse<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      meta: {
        requestId: requestId || this.generateRequestId(),
        timestamp: new Date().toISOString(),
        version: this.getApiVersion(),
      },
    }

    return NextResponse.json(response, { status })
  }

  /**
   * Crea una respuesta de error de validación
   */
  static validationError(
    errors: z.ZodError | string | string[],
    requestId?: string
  ): NextResponse<ApiResponse> {
    let message = 'Error de validación'
    let details: any = undefined

    if (errors instanceof z.ZodError) {
      message = 'Los datos proporcionados no son válidos'
      details = errors.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }))
    } else if (Array.isArray(errors)) {
      message = 'Múltiples errores de validación'
      details = errors
    } else if (typeof errors === 'string') {
      message = errors
    }

    return this.error(ErrorCodes.VALIDATION_ERROR, message, 400, details, requestId)
  }

  /**
   * Crea una respuesta de no autorizado
   */
  static unauthorized(
    message: string = 'No autorizado',
    requestId?: string
  ): NextResponse<ApiResponse> {
    return this.error(ErrorCodes.UNAUTHORIZED, message, 401, undefined, requestId)
  }

  /**
   * Crea una respuesta de prohibido
   */
  static forbidden(
    message: string = 'Acceso prohibido',
    requestId?: string
  ): NextResponse<ApiResponse> {
    return this.error(ErrorCodes.FORBIDDEN, message, 403, undefined, requestId)
  }

  /**
   * Crea una respuesta de no encontrado
   */
  static notFound(
    message: string = 'Recurso no encontrado',
    requestId?: string
  ): NextResponse<ApiResponse> {
    return this.error(ErrorCodes.NOT_FOUND, message, 404, undefined, requestId)
  }

  /**
   * Crea una respuesta de conflicto
   */
  static conflict(
    message: string = 'Conflicto con el estado actual del recurso',
    requestId?: string
  ): NextResponse<ApiResponse> {
    return this.error(ErrorCodes.CONFLICT, message, 409, undefined, requestId)
  }

  /**
   * Crea una respuesta de rate limit excedido
   */
  static rateLimitExceeded(
    message: string = 'Demasiadas peticiones',
    retryAfter?: number,
    requestId?: string
  ): NextResponse<ApiResponse> {
    const response = this.error(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      message,
      429,
      retryAfter ? { retryAfter } : undefined,
      requestId
    )

    if (retryAfter) {
      response.headers.set('Retry-After', retryAfter.toString())
    }

    return response
  }

  /**
   * Crea una respuesta de error interno
   */
  static internalError(
    message: string = 'Error interno del servidor',
    details?: any,
    requestId?: string
  ): NextResponse<ApiResponse> {
    // En producción, no exponer detalles internos
    const safeDetails = process.env.NODE_ENV === 'development' ? details : undefined

    return this.error(ErrorCodes.INTERNAL_ERROR, message, 500, safeDetails, requestId)
  }

  /**
   * Crea una respuesta de servicio no disponible
   */
  static serviceUnavailable(
    message: string = 'Servicio temporalmente no disponible',
    requestId?: string
  ): NextResponse<ApiResponse> {
    return this.error(ErrorCodes.SERVICE_UNAVAILABLE, message, 503, undefined, requestId)
  }
}

/**
 * Utilidades para paginación
 */
export class PaginationUtils {
  /**
   * Calcula metadatos de paginación
   */
  static calculatePagination(page: number, limit: number, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit)

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    }
  }

  /**
   * Valida parámetros de paginación
   */
  static validatePaginationParams(
    page?: string | number,
    limit?: string | number
  ): { page: number; limit: number } {
    const parsedPage = typeof page === 'string' ? parseInt(page) : page || 1
    const parsedLimit = typeof limit === 'string' ? parseInt(limit) : limit || 10

    return {
      page: Math.max(1, parsedPage),
      limit: Math.min(100, Math.max(1, parsedLimit)), // Máximo 100, mínimo 1
    }
  }

  /**
   * Calcula offset para queries de base de datos
   */
  static calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit
  }
}

/**
 * Wrapper para manejo consistente de errores en rutas API
 */
export function withErrorHandling<T extends any[], R>(handler: (...args: T) => Promise<R>) {
  return async (...args: T): Promise<R | NextResponse<ApiResponse>> => {
    try {
      return await handler(...args)
    } catch (error) {
      console.error('Error en handler API:', error)

      // Manejo específico de errores conocidos
      if (error instanceof z.ZodError) {
        return ApiResponseBuilder.validationError(error)
      }

      if (error instanceof Error) {
        // Errores de base de datos
        if (error.message.includes('Unique constraint')) {
          return ApiResponseBuilder.conflict('El recurso ya existe')
        }

        if (error.message.includes('Foreign key constraint')) {
          return ApiResponseBuilder.error(
            ErrorCodes.VALIDATION_ERROR,
            'Referencia inválida a otro recurso',
            400
          )
        }

        if (error.message.includes('Not found')) {
          return ApiResponseBuilder.notFound()
        }

        // Error genérico
        return ApiResponseBuilder.internalError(
          'Error procesando la petición',
          process.env.NODE_ENV === 'development' ? error.message : undefined
        )
      }

      // Error desconocido
      return ApiResponseBuilder.internalError()
    }
  }
}

/**
 * Schemas de validación para respuestas API
 */
export const ApiResponseSchemas = {
  success: z.object({
    success: z.literal(true),
    data: z.any(),
    meta: z.object({
      requestId: z.string(),
      timestamp: z.string(),
      version: z.string(),
    }),
  }),

  error: z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
    }),
    meta: z.object({
      requestId: z.string(),
      timestamp: z.string(),
      version: z.string(),
    }),
  }),

  paginated: z.object({
    success: z.literal(true),
    data: z.array(z.any()),
    meta: z.object({
      requestId: z.string(),
      timestamp: z.string(),
      version: z.string(),
      pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number(),
        hasNext: z.boolean(),
        hasPrev: z.boolean(),
      }),
    }),
  }),
}
