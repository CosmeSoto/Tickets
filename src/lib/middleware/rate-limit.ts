/**
 * Rate Limiting Middleware
 * Protege contra abuso de API usando ioredis (singleton de @/lib/server)
 */

import { getRedis } from '@/lib/server'
import { NextRequest, NextResponse } from 'next/server'

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  message?: string
}

// Configuraciones predefinidas
export const RateLimitPresets = {
  // APIs públicas (más restrictivo)
  PUBLIC: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minuto
    message: 'Demasiadas solicitudes. Por favor intenta de nuevo en 1 minuto.'
  },
  
  // APIs autenticadas (moderado)
  AUTHENTICATED: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minuto
    message: 'Límite de solicitudes excedido. Por favor intenta de nuevo en 1 minuto.'
  },
  
  // APIs de escritura (más restrictivo)
  WRITE: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minuto
    message: 'Demasiadas operaciones de escritura. Por favor intenta de nuevo en 1 minuto.'
  },
  
  // APIs de lectura (menos restrictivo)
  READ: {
    maxRequests: 200,
    windowMs: 60 * 1000, // 1 minuto
    message: 'Límite de solicitudes excedido. Por favor intenta de nuevo en 1 minuto.'
  },
  
  // Webhooks (muy restrictivo)
  WEBHOOK: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minuto
    message: 'Demasiadas solicitudes de webhook. Por favor intenta de nuevo en 1 minuto.'
  }
}

/**
 * Aplica rate limiting a una solicitud
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  identifier?: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const redis = getRedis()
  // Si Redis no está disponible, permitir la solicitud (fail open)
  if (!redis) {
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: Date.now() + config.windowMs
    }
  }

  try {
    const id = identifier || getClientIdentifier(request)
    const key = `rate-limit:${id}`

    const [rawCurrent, ttl] = await Promise.all([
      redis.get(key),
      redis.ttl(key),
    ])
    const current = rawCurrent ? parseInt(rawCurrent as string, 10) : 0

    const resetTime = ttl > 0
      ? Date.now() + ttl * 1000
      : Date.now() + config.windowMs

    if (current >= config.maxRequests) {
      return { success: false, limit: config.maxRequests, remaining: 0, reset: resetTime }
    }

    if (current === 0) {
      await redis.set(key, '1', 'EX', Math.floor(config.windowMs / 1000))
    } else {
      await redis.incr(key)
    }

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - current - 1,
      reset: resetTime,
    }
  } catch (error) {
    console.error('[RATE-LIMIT] Error:', error)
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: Date.now() + config.windowMs,
    }
  }
}

/**
 * Obtiene un identificador único del cliente
 */
function getClientIdentifier(request: NextRequest): string {
  // Intentar obtener IP real (considerando proxies)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || 'unknown'
  
  return ip
}

/**
 * Middleware helper para aplicar rate limiting
 */
export function withRateLimit(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  config: RateLimitConfig
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const result = await rateLimit(request, config)

    // Agregar headers de rate limit
    const headers = new Headers()
    headers.set('X-RateLimit-Limit', result.limit.toString())
    headers.set('X-RateLimit-Remaining', result.remaining.toString())
    headers.set('X-RateLimit-Reset', result.reset.toString())

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: config.message || 'Demasiadas solicitudes',
          error: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers 
        }
      )
    }

    // Ejecutar handler original
    const response = await handler(request, ...args)
    
    // Agregar headers a la respuesta
    headers.forEach((value, key) => {
      response.headers.set(key, value)
    })

    return response
  }
}

/**
 * Rate limit por usuario autenticado
 */
export async function rateLimitByUser(
  userId: string,
  config: RateLimitConfig
): Promise<{ success: boolean; remaining: number }> {
  const redis = getRedis()
  if (!redis) return { success: true, remaining: config.maxRequests }

  try {
    const key = `rate-limit:user:${userId}`
    const raw = await redis.get(key)
    const current = raw ? parseInt(raw as string, 10) : 0

    if (current >= config.maxRequests) return { success: false, remaining: 0 }

    if (current === 0) {
      await redis.set(key, '1', 'EX', Math.floor(config.windowMs / 1000))
    } else {
      await redis.incr(key)
    }

    return { success: true, remaining: config.maxRequests - current - 1 }
  } catch (error) {
    console.error('[RATE-LIMIT] Error en rateLimitByUser:', error)
    return { success: true, remaining: config.maxRequests }
  }
}
