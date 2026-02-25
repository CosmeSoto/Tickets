/**
 * Servicio de Caché con Upstash Redis
 * Mejora el rendimiento cacheando consultas frecuentes
 */

import { Redis } from '@upstash/redis'

export class RedisCache {
  private static redis: Redis | null = null
  private static isConfigured = false

  /**
   * Inicializa la conexión a Redis
   */
  private static getRedis(): Redis {
    if (this.redis && this.isConfigured) {
      return this.redis
    }

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!redisUrl) {
      console.warn('[REDIS-CACHE] Redis no configurado, usando caché en memoria')
      throw new Error('Redis no configurado')
    }

    this.redis = new Redis({
      url: redisUrl,
      token: redisToken
    })

    this.isConfigured = true
    return this.redis
  }

  /**
   * Obtiene un valor del caché
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const redis = this.getRedis()
      const value = await redis.get(key)
      
      if (value) {
        console.log(`[REDIS-CACHE] HIT: ${key}`)
        return value as T
      }
      
      console.log(`[REDIS-CACHE] MISS: ${key}`)
      return null
    } catch (error) {
      console.error('[REDIS-CACHE] Error getting key:', key, error)
      return null
    }
  }

  /**
   * Guarda un valor en el caché con TTL
   */
  static async set(key: string, value: any, ttlSeconds: number = 300): Promise<boolean> {
    try {
      const redis = this.getRedis()
      await redis.setex(key, ttlSeconds, JSON.stringify(value))
      console.log(`[REDIS-CACHE] SET: ${key} (TTL: ${ttlSeconds}s)`)
      return true
    } catch (error) {
      console.error('[REDIS-CACHE] Error setting key:', key, error)
      return false
    }
  }

  /**
   * Elimina una clave del caché
   */
  static async del(key: string): Promise<boolean> {
    try {
      const redis = this.getRedis()
      await redis.del(key)
      console.log(`[REDIS-CACHE] DEL: ${key}`)
      return true
    } catch (error) {
      console.error('[REDIS-CACHE] Error deleting key:', key, error)
      return false
    }
  }

  /**
   * Elimina múltiples claves que coincidan con un patrón
   */
  static async delPattern(pattern: string): Promise<number> {
    try {
      const redis = this.getRedis()
      const keys = await redis.keys(pattern)
      
      if (keys.length === 0) {
        return 0
      }

      await redis.del(...keys)
      console.log(`[REDIS-CACHE] DEL PATTERN: ${pattern} (${keys.length} keys)`)
      return keys.length
    } catch (error) {
      console.error('[REDIS-CACHE] Error deleting pattern:', pattern, error)
      return 0
    }
  }

  /**
   * Wrapper para cachear el resultado de una función
   */
  static async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    // Intentar obtener del caché
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Si no está en caché, ejecutar función
    const result = await fn()
    
    // Guardar en caché
    await this.set(key, result, ttlSeconds)
    
    return result
  }

  /**
   * Verifica si Redis está disponible
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const redis = this.getRedis()
      await redis.ping()
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Obtiene estadísticas del caché
   */
  static async getStats(): Promise<{
    available: boolean
    keys?: number
    memory?: string
  }> {
    try {
      const redis = this.getRedis()
      // Note: Upstash Redis doesn't support info() command
      // const info = await redis.info()
      
      // Obtener número de claves
      const keys = await redis.dbsize()
      
      return {
        available: true,
        keys,
        memory: 'N/A' // Upstash no expone esta métrica
      }
    } catch (error) {
      return {
        available: false
      }
    }
  }
}

/**
 * Claves de caché predefinidas
 */
export const CacheKeys = {
  // Estadísticas de técnico (TTL: 5 minutos)
  technicianStats: (technicianId: string) => `stats:technician:${technicianId}`,
  
  // Categorías de técnico (TTL: 10 minutos)
  technicianCategories: (technicianId: string) => `categories:technician:${technicianId}`,
  
  // Estadísticas globales (TTL: 15 minutos)
  globalStats: () => `stats:global`,
  
  // Reporte de tickets (TTL: 30 minutos)
  ticketReport: (filters: string) => `report:tickets:${filters}`,
  
  // Reporte de técnicos (TTL: 30 minutos)
  technicianReport: (filters: string) => `report:technicians:${filters}`,
  
  // Lista de tickets (TTL: 2 minutos)
  ticketList: (filters: string) => `tickets:list:${filters}`,
  
  // Configuración del sistema (TTL: 1 hora)
  systemConfig: () => `config:system`,
  
  // Configuración de usuario (TTL: 30 minutos)
  userSettings: (userId: string) => `settings:user:${userId}`
}

/**
 * TTLs recomendados por tipo de dato
 */
export const CacheTTL = {
  SHORT: 120,      // 2 minutos - Datos que cambian frecuentemente
  MEDIUM: 300,     // 5 minutos - Estadísticas de técnico
  LONG: 900,       // 15 minutos - Estadísticas globales
  VERY_LONG: 1800, // 30 minutos - Reportes
  HOUR: 3600       // 1 hora - Configuración del sistema
}
