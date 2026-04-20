import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

function createRedisClient(): Redis {
  if (!process.env.REDIS_URL) {
    // Sin REDIS_URL — cliente que falla silenciosamente
    const dummy = new Redis({ lazyConnect: true, maxRetriesPerRequest: 0, enableOfflineQueue: false })
    dummy.disconnect()
    return dummy
  }

  const client = new Redis(process.env.REDIS_URL, {
    // NO lazyConnect — conectar inmediatamente para que los comandos no fallen
    lazyConnect: false,
    connectTimeout: 3000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 1,       // 1 reintento antes de fallar
    enableOfflineQueue: false,     // No encolar si está desconectado
    retryStrategy: (times: number) => {
      if (times > 5) return null   // Dejar de reintentar después de 5 intentos
      return Math.min(times * 500, 5000)
    },
    family: 4,
  })

  client.on('connect', () => console.log('✅ [REDIS] Conectado'))
  client.on('error', () => { /* silencioso — degradación graceful */ })

  return client
}

export const redis = globalForRedis.redis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// ── Utilidades con graceful degradation ──────────────────────────────────────

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
    // Silencioso
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch {
    // Silencioso
  }
}
