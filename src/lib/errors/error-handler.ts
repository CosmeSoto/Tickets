/**
 * Sistema Centralizado de Manejo de Errores
 * Proporciona respuestas consistentes y logging estructurado
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

// ============================================
// TIPOS DE ERRORES PERSONALIZADOS
// ============================================

export class AppError extends Error {
  public statusCode: number
  public code: string
  public details?: any

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any
  ) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'No autorizado') {
    super(message, 401, 'AUTHENTICATION_ERROR')
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'No tienes permisos para realizar esta acción') {
    super(message, 403, 'AUTHORIZATION_ERROR')
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Recurso') {
    super(`${resource} no encontrado`, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR')
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('Demasiadas solicitudes', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter })
    this.name = 'RateLimitError'
  }
}

// ============================================
// MANEJADOR CENTRALIZADO DE ERRORES
// ============================================

export interface ErrorResponse {
  success: false
  message: string
  error: string
  code: string
  details?: any
  timestamp: string
  path?: string
}

/**
 * Maneja errores y devuelve respuesta NextResponse apropiada
 */
export function handleError(error: unknown, path?: string): NextResponse<ErrorResponse> {
  console.error('[ERROR]', {
    error,
    path,
    timestamp: new Date().toISOString()
  })

  // Error personalizado de la aplicación
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        error: error.name,
        code: error.code,
        details: error.details,
        timestamp: new Date().toISOString(),
        path
      },
      { status: error.statusCode }
    )
  }

  // Error de validación de Zod
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        message: 'Datos de entrada inválidos',
        error: 'ValidationError',
        code: 'VALIDATION_ERROR',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })),
        timestamp: new Date().toISOString(),
        path
      },
      { status: 400 }
    )
  }

  // Errores de Prisma
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(error, path)
  }

  // Error estándar de JavaScript
  if (error instanceof Error) {
    // En producción, no exponer detalles internos
    const isProduction = process.env.NODE_ENV === 'production'
    
    return NextResponse.json(
      {
        success: false,
        message: isProduction 
          ? 'Ha ocurrido un error interno' 
          : error.message,
        error: error.name,
        code: 'INTERNAL_ERROR',
        details: isProduction ? undefined : {
          stack: error.stack
        },
        timestamp: new Date().toISOString(),
        path
      },
      { status: 500 }
    )
  }

  // Error desconocido
  return NextResponse.json(
    {
      success: false,
      message: 'Ha ocurrido un error desconocido',
      error: 'UnknownError',
      code: 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
      path
    },
    { status: 500 }
  )
}

/**
 * Maneja errores específicos de Prisma
 */
function handlePrismaError(
  error: Prisma.PrismaClientKnownRequestError,
  path?: string
): NextResponse<ErrorResponse> {
  switch (error.code) {
    // Violación de constraint único
    case 'P2002':
      return NextResponse.json(
        {
          success: false,
          message: 'Ya existe un registro con estos datos',
          error: 'ConflictError',
          code: 'DUPLICATE_ENTRY',
          details: {
            fields: (error.meta?.target as string[]) || []
          },
          timestamp: new Date().toISOString(),
          path
        },
        { status: 409 }
      )

    // Registro no encontrado
    case 'P2025':
      return NextResponse.json(
        {
          success: false,
          message: 'Registro no encontrado',
          error: 'NotFoundError',
          code: 'NOT_FOUND',
          timestamp: new Date().toISOString(),
          path
        },
        { status: 404 }
      )

    // Violación de foreign key
    case 'P2003':
      return NextResponse.json(
        {
          success: false,
          message: 'Referencia inválida a otro registro',
          error: 'ValidationError',
          code: 'INVALID_REFERENCE',
          details: {
            field: error.meta?.field_name
          },
          timestamp: new Date().toISOString(),
          path
        },
        { status: 400 }
      )

    // Violación de constraint
    case 'P2004':
      return NextResponse.json(
        {
          success: false,
          message: 'Violación de restricción de base de datos',
          error: 'ValidationError',
          code: 'CONSTRAINT_VIOLATION',
          timestamp: new Date().toISOString(),
          path
        },
        { status: 400 }
      )

    // Error de conexión
    case 'P1001':
    case 'P1002':
      return NextResponse.json(
        {
          success: false,
          message: 'Error de conexión a la base de datos',
          error: 'DatabaseError',
          code: 'DATABASE_CONNECTION_ERROR',
          timestamp: new Date().toISOString(),
          path
        },
        { status: 503 }
      )

    default:
      return NextResponse.json(
        {
          success: false,
          message: 'Error de base de datos',
          error: 'DatabaseError',
          code: error.code,
          timestamp: new Date().toISOString(),
          path
        },
        { status: 500 }
      )
  }
}

/**
 * Wrapper para handlers de API con manejo de errores automático
 */
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      // Extraer path de la request si está disponible
      const request = args[0]
      const path = request?.url ? new URL(request.url).pathname : undefined
      
      return handleError(error, path)
    }
  }
}

/**
 * Logger estructurado de errores
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    context
  }

  // En producción, aquí se enviaría a un servicio como Sentry
  console.error('[ERROR LOG]', JSON.stringify(errorLog, null, 2))
}

/**
 * Valida que un usuario tenga permisos
 */
export function requireRole(userRole: string, allowedRoles: string[]): void {
  if (!allowedRoles.includes(userRole)) {
    throw new AuthorizationError(
      `Esta acción requiere uno de los siguientes roles: ${allowedRoles.join(', ')}`
    )
  }
}

/**
 * Valida que un recurso exista
 */
export function requireResource<T>(resource: T | null | undefined, name: string = 'Recurso'): T {
  if (!resource) {
    throw new NotFoundError(name)
  }
  return resource
}
