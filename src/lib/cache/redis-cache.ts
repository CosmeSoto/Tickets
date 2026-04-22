/**
 * Servicio de Caché con Redis
 * Usa el singleton centralizado de @/lib/server — build-safe y lazy.
 */

import { getRedis } from '@/lib/server'

export class RedisCache {
  static async get<T>(key: string): Promise<T | null> {
    try {
      const redis = getRedis()
      if (!redis) return null
      const value = await redis.get(key)
      return value ? (JSON.parse(value) as T) : null
    } catch {
      return null
    }
  }

  static async set(key: string, value: unknown, ttlSeconds = 300): Promise<boolean> {
    try {
      const redis = getRedis()
      if (!redis) return false
      await redis.setex(key, ttlSeconds, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }

  static async del(key: string): Promise<boolean> {
    try {
      const redis = getRedis()
      if (!redis) return false
      await redis.del(key)
      return true
    } catch {
      return false
    }
  }

  static async delPattern(pattern: string): Promise<number> {
    try {
      const redis = getRedis()
      if (!redis) return 0
      const keys = await redis.keys(pattern)
      if (keys.length === 0) return 0
      await redis.del(...keys)
      return keys.length
    } catch {
      return 0
    }
  }

  static async wrap<T>(key: string, fn: () => Promise<T>, ttlSeconds = 300): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) return cached
    const result = await fn()
    await this.set(key, result, ttlSeconds)
    return result
  }

  static async isAvailable(): Promise<boolean> {
    try {
      const redis = getRedis()
      if (!redis) return false
      await redis.ping()
      return true
    } catch {
      return false
    }
  }
}

// ─── Claves de caché predefinidas ─────────────────────────────────────────────
export const CacheKeys = {
  technicianStats:      (id: string)      => `stats:technician:${id}`,
  technicianCategories: (id: string)      => `categories:technician:${id}`,
  globalStats:          ()                => `stats:global`,
  ticketReport:         (filters: string) => `report:tickets:${filters}`,
  technicianReport:     (filters: string) => `report:technicians:${filters}`,
  ticketList:           (filters: string) => `tickets:list:${filters}`,
  systemConfig:         ()                => `config:system`,
  userSettings:         (id: string)      => `settings:user:${id}`,
}

export const CacheTTL = {
  SHORT:     120,   // 2 min
  MEDIUM:    300,   // 5 min
  LONG:      900,   // 15 min
  VERY_LONG: 1800,  // 30 min
  HOUR:      3600,  // 1 h
}
