/**
 * SINGLETON GLOBAL DE SERVICIOS DEL SERVIDOR
 *
 * Punto de entrada único para Prisma, Redis e ioredis.
 * - Inicialización lazy: nada se instancia hasta que se usa por primera vez.
 * - Build-safe: no lanza errores si las variables de entorno no están disponibles.
 * - Hot-reload safe: usa globalThis para sobrevivir recargas de Turbopack/webpack.
 *
 * Uso:
 *   import { db, redis, pubsub } from '@/lib/server'
 */

import { PrismaClient } from '@prisma/client'
import type Redis from 'ioredis'

// ─── Tipos del registro global ────────────────────────────────────────────────

type GlobalRegistry = {
  __db__?: PrismaClient
  __redis__?: Redis | null
  __redisPub__?: Redis | null
  __redisSub__?: Redis | null
}

const g = globalThis as unknown as GlobalRegistry

// ─── Prisma ───────────────────────────────────────────────────────────────────

function createPrisma(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : [],
  })

  // Log de queries lentas (>100ms warn, >1s error)
  client.$use(async (params, next) => {
    const before = Date.now()
    const result = await next(params)
    const ms = Date.now() - before
    if (ms > 1000) {
      console.error(`🚨 Query muy lenta: ${ms}ms — ${params.model}.${params.action}`)
    } else if (ms > 100) {
      console.warn(`🐌 Query lenta: ${ms}ms — ${params.model}.${params.action}`)
    }
    return result
  })

  return client
}

/**
 * Instancia singleton de Prisma.
 * Lazy: se crea la primera vez que se accede a cualquier propiedad.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!g.__db__) {
      if (!process.env.DATABASE_URL) {
        // Durante el build sin DATABASE_URL, devolver un objeto vacío seguro
        // Las rutas de API nunca se ejecutan en build time, así que esto es seguro
        return undefined
      }
      g.__db__ = createPrisma()
    }
    return (g.__db__ as any)[prop]
  },
})

// Alias para compatibilidad con imports existentes
export { db as prisma }

// ─── ioredis (pub/sub y caché general) ───────────────────────────────────────

function createIoRedis(url: string): Redis {
  // Importación dinámica para evitar que el módulo se evalúe en build time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Redis = require('ioredis')
  return new Redis(url, {
    lazyConnect: true,
    connectTimeout: 3000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times: number) => (times > 5 ? null : Math.min(times * 500, 5000)),
    family: 4,
  })
}

/**
 * Cliente ioredis para caché general.
 * Retorna null si REDIS_URL no está configurada.
 */
export function getRedis(): Redis | null {
  if (g.__redis__ !== undefined) return g.__redis__

  if (!process.env.REDIS_URL) {
    g.__redis__ = null
    return null
  }

  try {
    const client = createIoRedis(process.env.REDIS_URL)
    client.on('error', () => { /* degradación silenciosa */ })
    g.__redis__ = client
  } catch {
    g.__redis__ = null
  }

  return g.__redis__ ?? null
}

/**
 * Publisher Redis para Pub/Sub.
 * Retorna null si REDIS_URL no está configurada.
 */
export function getRedisPub(): Redis | null {
  if (g.__redisPub__ !== undefined) return g.__redisPub__

  if (!process.env.REDIS_URL) {
    g.__redisPub__ = null
    return null
  }

  try {
    const client = createIoRedis(process.env.REDIS_URL)
    client.on('error', () => { /* degradación silenciosa */ })
    g.__redisPub__ = client
  } catch {
    g.__redisPub__ = null
  }

  return g.__redisPub__ ?? null
}

/**
 * Subscriber Redis para Pub/Sub.
 * Retorna null si REDIS_URL no está configurada.
 */
export function getRedisSub(): Redis | null {
  if (g.__redisSub__ !== undefined) return g.__redisSub__

  if (!process.env.REDIS_URL) {
    g.__redisSub__ = null
    return null
  }

  try {
    const client = createIoRedis(process.env.REDIS_URL)
    client.on('error', () => { /* degradación silenciosa */ })
    g.__redisSub__ = client
  } catch {
    g.__redisSub__ = null
  }

  return g.__redisSub__ ?? null
}

// ─── Utilidades de caché con graceful degradation ─────────────────────────────

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis()
    if (!client) return null
    const raw = await client.get(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export async function setCache(key: string, value: unknown, ttl = 3600): Promise<void> {
  try {
    const client = getRedis()
    if (!client) return
    await client.setex(key, ttl, JSON.stringify(value))
  } catch {
    // silencioso
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    const client = getRedis()
    if (!client) return
    await client.del(key)
  } catch {
    // silencioso
  }
}

// ─── Cierre graceful ──────────────────────────────────────────────────────────

async function shutdown() {
  const tasks: Promise<unknown>[] = []

  if (g.__db__) tasks.push(g.__db__.$disconnect())
  if (g.__redis__) tasks.push(g.__redis__.quit().catch(() => {}))
  if (g.__redisPub__) tasks.push(g.__redisPub__.quit().catch(() => {}))
  if (g.__redisSub__) tasks.push(g.__redisSub__.quit().catch(() => {}))

  await Promise.allSettled(tasks)
}

// Solo registrar los handlers una vez
if (!(globalThis as any).__shutdownRegistered__) {
  ;(globalThis as any).__shutdownRegistered__ = true
  process.on('beforeExit', shutdown)
  process.on('SIGINT', () => shutdown().then(() => process.exit(0)))
  process.on('SIGTERM', () => shutdown().then(() => process.exit(0)))
}
