/**
 * Sistema de cache para datos del dashboard
 * Reduce llamadas innecesarias a la API
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface CacheOptions {
  ttl?: number // Time to live en milisegundos
  staleWhileRevalidate?: boolean // Devolver datos stale mientras se revalida
}

class DashboardCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL = 2 * 60 * 1000 // 2 minutos por defecto

  /**
   * Obtener datos del cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    const now = Date.now()
    
    // Si expiró, eliminar y retornar null
    if (now > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Guardar datos en cache
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || this.defaultTTL
    const now = Date.now()

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    })
  }

  /**
   * Verificar si una key existe y es válida
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return false
    }

    const now = Date.now()
    
    if (now > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Invalidar una key específica
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalidar múltiples keys que coincidan con un patrón
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Limpiar todo el cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Limpiar entradas expiradas
   */
  cleanup(): void {
    const now = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Obtener estadísticas del cache
   */
  getStats() {
    const now = Date.now()
    let valid = 0
    let expired = 0

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++
      } else {
        valid++
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired,
    }
  }

  /**
   * Obtener o establecer (fetch si no existe)
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Intentar obtener del cache
    const cached = this.get<T>(key)
    
    if (cached !== null) {
      return cached
    }

    // Si no existe, hacer fetch
    const data = await fetchFn()
    this.set(key, data, options)
    
    return data
  }

  /**
   * Revalidar datos (fetch y actualizar cache)
   */
  async revalidate<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const data = await fetchFn()
    this.set(key, data, options)
    return data
  }
}

// Instancia singleton
export const dashboardCache = new DashboardCache()

// Cleanup automático cada 5 minutos
if (typeof window !== 'undefined') {
  setInterval(() => {
    dashboardCache.cleanup()
  }, 5 * 60 * 1000)
}

// Keys de cache predefinidas
export const CACHE_KEYS = {
  // Dashboard stats
  ADMIN_STATS: 'dashboard:admin:stats',
  TECHNICIAN_STATS: 'dashboard:technician:stats',
  CLIENT_STATS: 'dashboard:client:stats',
  
  // System status
  SYSTEM_STATUS: 'system:status',
  
  // Notifications
  NOTIFICATIONS: (userId: string) => `notifications:${userId}`,
  
  // Tickets
  TICKETS_LIST: (role: string, filters?: string) => 
    `tickets:${role}${filters ? `:${filters}` : ''}`,
  TICKET_DETAIL: (id: string) => `ticket:${id}`,
  
  // Users
  USERS_LIST: (filters?: string) => `users${filters ? `:${filters}` : ''}`,
  USER_DETAIL: (id: string) => `user:${id}`,
  
  // Reports
  REPORTS_DATA: (type: string, period: string) => `reports:${type}:${period}`,
} as const

// TTL predefinidos
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000,      // 1 minuto
  MEDIUM: 5 * 60 * 1000,     // 5 minutos
  LONG: 15 * 60 * 1000,      // 15 minutos
  VERY_LONG: 60 * 60 * 1000, // 1 hora
} as const
