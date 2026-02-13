/**
 * Advanced Caching Service
 * Provides comprehensive caching capabilities with Redis
 */

import { redis } from './redis'

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  prefix?: string // Cache key prefix
  tags?: string[] // Cache tags for invalidation
  serialize?: boolean // Whether to serialize/deserialize data
  compress?: boolean // Whether to compress large data
}

export interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  errors: number
}

class CacheService {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  }

  private defaultOptions: CacheOptions = {
    ttl: 3600, // 1 hour default
    prefix: 'app',
    serialize: true,
    compress: false
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const opts = { ...this.defaultOptions, ...options }
      const fullKey = this.buildKey(key, opts.prefix)
      
      const cached = await redis.get(fullKey)
      
      if (cached === null) {
        this.stats.misses++
        return null
      }

      this.stats.hits++
      
      if (opts.serialize) {
        return JSON.parse(cached) as T
      }
      
      return cached as T
    } catch (error) {
      this.stats.errors++
      console.error('Cache get error:', error)
      return null
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    try {
      const opts = { ...this.defaultOptions, ...options }
      const fullKey = this.buildKey(key, opts.prefix)
      
      let serializedValue = value
      if (opts.serialize) {
        serializedValue = JSON.stringify(value)
      }

      if (opts.ttl && opts.ttl > 0) {
        await redis.setex(fullKey, opts.ttl, serializedValue)
      } else {
        await redis.set(fullKey, serializedValue)
      }

      // Store tags for invalidation
      if (opts.tags && opts.tags.length > 0) {
        await this.storeTags(fullKey, opts.tags)
      }

      this.stats.sets++
      return true
    } catch (error) {
      this.stats.errors++
      console.error('Cache set error:', error)
      return false
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, prefix?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, prefix || this.defaultOptions.prefix)
      const result = await redis.del(fullKey)
      
      this.stats.deletes++
      return result > 0
    } catch (error) {
      this.stats.errors++
      console.error('Cache delete error:', error)
      return false
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, prefix?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, prefix || this.defaultOptions.prefix)
      const result = await redis.exists(fullKey)
      return result === 1
    } catch (error) {
      this.stats.errors++
      console.error('Cache exists error:', error)
      return false
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key, options)
    
    if (cached !== null) {
      return cached
    }

    const value = await fetchFn()
    await this.set(key, value, options)
    
    return value
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      let deletedCount = 0

      for (const tag of tags) {
        const tagKey = `tags:${tag}`
        const keys = await redis.smembers(tagKey)
        
        if (keys.length > 0) {
          const deleted = await redis.del(...keys)
          deletedCount += deleted
          
          // Clean up the tag set
          await redis.del(tagKey)
        }
      }

      return deletedCount
    } catch (error) {
      this.stats.errors++
      console.error('Cache invalidate by tags error:', error)
      return 0
    }
  }

  /**
   * Clear all cache with optional pattern
   */
  async clear(pattern?: string): Promise<number> {
    try {
      const searchPattern = pattern || `${this.defaultOptions.prefix}:*`
      const keys = await redis.keys(searchPattern)
      
      if (keys.length === 0) {
        return 0
      }

      const deleted = await redis.del(...keys)
      return deleted
    } catch (error) {
      this.stats.errors++
      console.error('Cache clear error:', error)
      return 0
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    }
  }

  /**
   * Get cache hit ratio
   */
  getHitRatio(): number {
    const total = this.stats.hits + this.stats.misses
    return total > 0 ? this.stats.hits / total : 0
  }

  /**
   * Increment a counter in cache
   */
  async increment(key: string, amount: number = 1, options?: CacheOptions): Promise<number> {
    try {
      const opts = { ...this.defaultOptions, ...options }
      const fullKey = this.buildKey(key, opts.prefix)
      
      const result = await redis.incrby(fullKey, amount)
      
      if (opts.ttl && opts.ttl > 0) {
        await redis.expire(fullKey, opts.ttl)
      }

      return result
    } catch (error) {
      this.stats.errors++
      console.error('Cache increment error:', error)
      return 0
    }
  }

  /**
   * Set expiration for existing key
   */
  async expire(key: string, ttl: number, prefix?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, prefix || this.defaultOptions.prefix)
      const result = await redis.expire(fullKey, ttl)
      return result === 1
    } catch (error) {
      this.stats.errors++
      console.error('Cache expire error:', error)
      return false
    }
  }

  /**
   * Get remaining TTL for key
   */
  async ttl(key: string, prefix?: string): Promise<number> {
    try {
      const fullKey = this.buildKey(key, prefix || this.defaultOptions.prefix)
      return await redis.ttl(fullKey)
    } catch (error) {
      this.stats.errors++
      console.error('Cache TTL error:', error)
      return -1
    }
  }

  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    const keyPrefix = prefix || this.defaultOptions.prefix
    return `${keyPrefix}:${key}`
  }

  /**
   * Store tags for cache invalidation
   */
  private async storeTags(key: string, tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = `tags:${tag}`
        await redis.sadd(tagKey, key)
      }
    } catch (error) {
      console.error('Store tags error:', error)
    }
  }
}

// Create singleton instance
export const cacheService = new CacheService()

/**
 * Cache decorator for methods
 */
export function Cache(options?: CacheOptions) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      // Generate cache key from method name and arguments
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`
      
      return cacheService.getOrSet(
        cacheKey,
        () => method.apply(this, args),
        options
      )
    }

    return descriptor
  }
}

/**
 * Cache invalidation decorator
 */
export function InvalidateCache(tags: string[]) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args)
      
      // Invalidate cache after successful method execution
      await cacheService.invalidateByTags(tags)
      
      return result
    }

    return descriptor
  }
}

/**
 * Utility functions for common caching patterns
 */
export class CachePatterns {
  /**
   * Cache with automatic refresh
   */
  static async cacheWithRefresh<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions & { refreshThreshold?: number } = {}
  ): Promise<T> {
    const { refreshThreshold = 300, ...cacheOptions } = options // 5 minutes default
    
    const cached = await cacheService.get<T>(key, cacheOptions)
    
    if (cached !== null) {
      // Check if cache is about to expire and refresh in background
      const ttl = await cacheService.ttl(key, cacheOptions.prefix)
      
      if (ttl > 0 && ttl < refreshThreshold) {
        // Refresh in background
        fetchFn().then(value => {
          cacheService.set(key, value, cacheOptions)
        }).catch(error => {
          console.error('Background cache refresh error:', error)
        })
      }
      
      return cached
    }

    const value = await fetchFn()
    await cacheService.set(key, value, cacheOptions)
    
    return value
  }

  /**
   * Cache with fallback
   */
  static async cacheWithFallback<T>(
    key: string,
    fetchFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    try {
      return await cacheService.getOrSet(key, fetchFn, options)
    } catch (error) {
      console.error('Cache with fallback error:', error)
      return await fallbackFn()
    }
  }

  /**
   * Multi-level cache (L1: memory, L2: Redis)
   */
  private static memoryCache = new Map<string, { value: any; expires: number }>()

  static async multiLevelCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions & { memoryTtl?: number } = {}
  ): Promise<T> {
    const { memoryTtl = 60, ...redisOptions } = options // 1 minute memory cache
    
    // Check L1 cache (memory)
    const memoryKey = `${redisOptions.prefix || 'app'}:${key}`
    const memoryCached = this.memoryCache.get(memoryKey)
    
    if (memoryCached && memoryCached.expires > Date.now()) {
      return memoryCached.value
    }

    // Check L2 cache (Redis)
    const redisCached = await cacheService.get<T>(key, redisOptions)
    
    if (redisCached !== null) {
      // Store in L1 cache
      this.memoryCache.set(memoryKey, {
        value: redisCached,
        expires: Date.now() + (memoryTtl * 1000)
      })
      
      return redisCached
    }

    // Fetch and cache in both levels
    const value = await fetchFn()
    
    await cacheService.set(key, value, redisOptions)
    this.memoryCache.set(memoryKey, {
      value,
      expires: Date.now() + (memoryTtl * 1000)
    })
    
    return value
  }
}

export default cacheService