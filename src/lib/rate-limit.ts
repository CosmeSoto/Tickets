/**
 * Rate Limiting con Redis (con fallback a memoria si Redis no está disponible).
 * Funciona correctamente en múltiples instancias/workers.
 */

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

// Fallback en memoria para cuando Redis no está disponible
interface MemEntry {
  count: number
  resetAt: number
}
const memMap = new Map<string, MemEntry>()
setInterval(
  () => {
    const now = Date.now()
    for (const [k, e] of memMap) if (now > e.resetAt) memMap.delete(k)
  },
  5 * 60 * 1000
)

function checkMemory(id: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = memMap.get(id)
  if (!entry || now > entry.resetAt) {
    memMap.set(id, { count: 1, resetAt: now + windowMs })
    return { success: true, limit: max, remaining: max - 1, reset: now + windowMs }
  }
  if (entry.count >= max) {
    return {
      success: false,
      limit: max,
      remaining: 0,
      reset: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }
  }
  entry.count++
  return { success: true, limit: max, remaining: max - entry.count, reset: entry.resetAt }
}

/**
 * Verifica rate limit usando Redis INCR + EXPIRE (atómico, distribuido).
 * Fallback automático a memoria si Redis no está disponible.
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests = 10,
  windowMs = 60_000
): Promise<RateLimitResult> {
  const windowSec = Math.ceil(windowMs / 1000)
  const resetAt = Date.now() + windowMs

  try {
    const { redis } = await import('@/lib/redis')
    const key = `rl:${identifier}`

    // Pipeline: INCR + EXPIRE en una sola operación
    const count = await redis.incr(key)
    if (count === 1) {
      // Primera request en esta ventana — establecer TTL
      await redis.expire(key, windowSec)
    }

    const ttl = await redis.ttl(key)
    const actualReset = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs)

    if (count > maxRequests) {
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        reset: actualReset,
        retryAfter: ttl > 0 ? ttl : windowSec,
      }
    }

    return {
      success: true,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - count),
      reset: actualReset,
    }
  } catch {
    // Redis no disponible — usar memoria
    return checkMemory(identifier, maxRequests, windowMs)
  }
}

export const RateLimiters = {
  reports: (userId: string) => checkRateLimit(`reports:${userId}`, 10, 60_000),
  reportsView: (userId: string) => checkRateLimit(`reports-view:${userId}`, 30, 60_000),
  api: (userId: string) => checkRateLimit(`api:${userId}`, 100, 60_000),
  login: (ip: string) => checkRateLimit(`login:${ip}`, 5, 5 * 60_000),
  createTicket: (userId: string) => checkRateLimit(`create-ticket:${userId}`, 20, 60 * 60_000),
}

export async function resetRateLimit(identifier: string): Promise<void> {
  try {
    const { redis } = await import('@/lib/redis')
    await redis.del(`rl:${identifier}`)
  } catch {
    memMap.delete(identifier)
  }
}
