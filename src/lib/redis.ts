import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

// Configuración robusta de Redis con graceful degradation
// Si Redis no está disponible, las funciones retornan null/void silenciosamente
const redisConfig = {
  lazyConnect: true,
  connectTimeout: 3000,          // 3s timeout de conexión
  commandTimeout: 2000,          // 2s timeout por comando
  maxRetriesPerRequest: 0,       // No reintentar — falla rápido y silencioso
  enableOfflineQueue: false,     // No encolar comandos si está desconectado
  retryStrategy: (times: number) => {
    // Reintentar conexión con backoff: 1s, 2s, 4s... máx 30s
    if (times > 10) return null  // Dejar de reintentar después de 10 intentos
    return Math.min(times * 1000, 30_000)
  },
  family: 4,
}

function createRedisClient(): Redis {
  if (!process.env.REDIS_URL) {
    // Sin REDIS_URL configurado — crear cliente dummy que siempre falla silenciosamente
    const dummy = new Redis({ lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 0 })
    dummy.disconnect()
    return dummy
  }
  return new Redis(process.env.REDIS_URL, redisConfig)
}

export const redis = globalForRedis.redis ?? createRedisClient()

redis.on('connect', () => console.log('✅ [REDIS] Conectado'))
redis.on('error', () => { /* silencioso — degradación graceful */ })

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// ── Utilidades con graceful degradation ──────────────────────────────────────
// Si Redis no está disponible, retornan null/void sin lanzar excepción

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key)
    return cached ? (JSON.parse(cached) as T) : null
  } catch {
    return null
  }
}

export async function setCache(key: string, value: any, ttl = 3600): Promise<void> {
  try {
    await redis.setex(key, ttl, JSON.stringify(value))
  } catch {
    // Silencioso — el sistema funciona sin caché
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch {
    // Silencioso
  }
}
