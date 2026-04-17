/**
 * api-cache.ts — Caché Redis para rutas API
 *
 * Uso:
 *   const data = await withCache('key', 120, () => expensiveQuery())
 *
 * Invalidación:
 *   await invalidateCache('tickets:*')
 *   await invalidateCache(['tickets:user:abc', 'dashboard:admin:abc'])
 */

import { getCached, setCache, deleteCache } from '@/lib/redis'

/**
 * Ejecuta fn() y cachea el resultado en Redis.
 * Si Redis no está disponible, ejecuta fn() directamente (graceful degradation).
 *
 * @param key   Clave única del caché
 * @param ttl   Tiempo de vida en segundos
 * @param fn    Función que produce el dato (solo se llama si no hay caché)
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const cached = await getCached<T>(key)
    if (cached !== null) return cached
  } catch {
    // Redis no disponible → ejecutar sin caché
    return fn()
  }

  const data = await fn()

  try {
    await setCache(key, data, ttl)
  } catch {
    // Fallo silencioso — el dato se devuelve igual
  }

  return data
}

/**
 * Invalida una o varias claves de caché.
 * Acepta claves exactas o patrones con wildcard (ej: 'tickets:user:*').
 */
export async function invalidateCache(keys: string | string[]): Promise<void> {
  const list = Array.isArray(keys) ? keys : [keys]
  await Promise.allSettled(list.map(k => deleteCache(k)))
}

/**
 * Construye una clave de caché normalizada.
 * Elimina valores undefined/null para que la misma query con distintos
 * parámetros vacíos produzca la misma clave.
 */
export function buildCacheKey(prefix: string, params: Record<string, unknown>): string {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== '')
  )
  const suffix = Object.keys(clean).length > 0
    ? ':' + Object.entries(clean).map(([k, v]) => `${k}=${v}`).join(':')
    : ''
  return `${prefix}${suffix}`
}
