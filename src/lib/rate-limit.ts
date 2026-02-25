/**
 * Rate Limiting Simple - Sin dependencias externas
 * Protege contra abuso de endpoints costosos
 */

interface RateLimitEntry {
  count: number
  resetAt: number
  firstRequest: number
}

// Almacenamiento en memoria (se reinicia con el servidor)
const rateLimitMap = new Map<string, RateLimitEntry>()

// Limpieza automática cada 5 minutos
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

/**
 * Verifica si una solicitud está dentro del límite de rate
 * 
 * @param identifier - Identificador único (userId, IP, etc.)
 * @param maxRequests - Número máximo de solicitudes permitidas
 * @param windowMs - Ventana de tiempo en milisegundos
 * @returns Resultado del rate limit
 * 
 * @example
 * ```typescript
 * const result = checkRateLimit(userId, 10, 60000) // 10 req/min
 * if (!result.success) {
 *   return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
 * }
 * ```
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000 // 1 minuto por defecto
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  // Primera solicitud o ventana expirada
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt,
      firstRequest: now
    })

    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: resetAt
    }
  }

  // Dentro de la ventana
  if (entry.count >= maxRequests) {
    // Límite excedido
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000) // segundos
    }
  }

  // Incrementar contador
  entry.count++

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - entry.count,
    reset: entry.resetAt
  }
}

/**
 * Rate limiters predefinidos para diferentes endpoints
 */
export const RateLimiters = {
  /**
   * Para exportaciones de reportes (costosas)
   * 10 exportaciones por minuto por usuario
   */
  reports: (userId: string) => checkRateLimit(`reports:${userId}`, 10, 60000),

  /**
   * Para generación de reportes (menos costoso)
   * 30 solicitudes por minuto por usuario
   */
  reportsView: (userId: string) => checkRateLimit(`reports-view:${userId}`, 30, 60000),

  /**
   * Para API general
   * 100 solicitudes por minuto por usuario
   */
  api: (userId: string) => checkRateLimit(`api:${userId}`, 100, 60000),

  /**
   * Para login (prevenir fuerza bruta)
   * 5 intentos por 5 minutos por IP
   */
  login: (ip: string) => checkRateLimit(`login:${ip}`, 5, 5 * 60000),

  /**
   * Para creación de tickets
   * 20 tickets por hora por usuario
   */
  createTicket: (userId: string) => checkRateLimit(`create-ticket:${userId}`, 20, 60 * 60000),
}

/**
 * Resetea el rate limit para un identificador específico
 * Útil para testing o casos especiales
 */
export function resetRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier)
}

/**
 * Obtiene estadísticas del rate limiter
 * Útil para monitoreo
 */
export function getRateLimitStats() {
  const now = Date.now()
  const active = Array.from(rateLimitMap.entries())
    .filter(([_, entry]) => now <= entry.resetAt)
    .map(([key, entry]) => ({
      identifier: key,
      count: entry.count,
      resetIn: Math.ceil((entry.resetAt - now) / 1000),
      duration: Math.ceil((now - entry.firstRequest) / 1000)
    }))

  return {
    totalEntries: rateLimitMap.size,
    activeEntries: active.length,
    active
  }
}
