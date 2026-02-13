import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

// Configuración robusta de Redis
const redisConfig = {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  // Configuración de reconexión
  retryDelayOnClusterDown: 300,
  // Configuración de keepalive
  keepAlive: 30000,
  // Configuración de familia de direcciones
  family: 4,
}

export const redis = globalForRedis.redis ?? new Redis(process.env.REDIS_URL!, redisConfig)

// Eventos de conexión para debugging
redis.on('connect', () => {
  console.log('✅ [REDIS] Conectado exitosamente')
})

redis.on('ready', () => {
  console.log('✅ [REDIS] Listo para comandos')
})

redis.on('error', (error) => {
  console.error('❌ [REDIS] Error:', error.message)
})

redis.on('close', () => {
  console.log('🔌 [REDIS] Conexión cerrada')
})

redis.on('reconnecting', () => {
  console.log('🔄 [REDIS] Reconectando...')
})

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// Utilidades para cache
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key)
    return cached ? JSON.parse(cached) : null
  } catch (error) {
    console.error('❌ [REDIS] Error en GET:', error instanceof Error ? error.message : 'Error desconocido')
    return null
  }
}

export async function setCache(key: string, value: any, ttl: number = 3600): Promise<void> {
  try {
    await redis.setex(key, ttl, JSON.stringify(value))
  } catch (error) {
    console.error('❌ [REDIS] Error en SET:', error instanceof Error ? error.message : 'Error desconocido')
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch (error) {
    console.error('❌ [REDIS] Error en DEL:', error instanceof Error ? error.message : 'Error desconocido')
  }
}
