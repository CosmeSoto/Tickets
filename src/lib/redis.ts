/**
 * Re-exporta el cliente Redis desde @/lib/server.
 * Mantiene compatibilidad con todos los imports existentes:
 *   import { redis } from '@/lib/redis'
 *   import { getCached, setCache, deleteCache } from '@/lib/redis'
 */
import { getRedis, getCached, setCache, deleteCache } from '@/lib/server'
import type Redis from 'ioredis'

// Valores de retorno seguros por método cuando Redis no está disponible
const NOOP_RETURNS: Record<string, unknown> = {
  get: null,
  set: 'OK',
  setex: 'OK',
  del: 0,
  exists: 0,
  expire: 0,
  ttl: -2,
  incr: 0,
  incrby: 0,
  keys: [],
  smembers: [],
  sadd: 0,
  srem: 0,
  ping: 'PONG',
  dbsize: 0,
  subscribe: undefined,
  publish: 0,
  quit: 'OK',
}

function noop(method: string) {
  return async (..._args: unknown[]) => NOOP_RETURNS[method] ?? null
}

/**
 * Proxy lazy — delega al cliente real si Redis está disponible,
 * o retorna valores seguros (no-op) si no lo está.
 */
export const redis: Redis = new Proxy({} as Redis, {
  get(_target, prop: string) {
    const client = getRedis()
    if (!client) return noop(prop)
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

export { getCached, setCache, deleteCache }
