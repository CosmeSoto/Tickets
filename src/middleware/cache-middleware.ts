/**
 * Cache Middleware
 * HTTP response caching and optimization middleware
 */

import { NextRequest, NextResponse } from 'next/server'
import { cacheService } from '@/lib/cache'

export interface CacheMiddlewareOptions {
  ttl?: number
  varyBy?: string[]
  skipCache?: (req: NextRequest) => boolean
  generateKey?: (req: NextRequest) => string
  headers?: Record<string, string>
}

/**
 * HTTP Response Cache Middleware
 */
export function createCacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const {
    ttl = 300, // 5 minutes default
    varyBy = ['accept', 'authorization'],
    skipCache = () => false,
    generateKey = (req) => `http-cache:${req.url}`,
    headers = {}
  } = options

  return async function cacheMiddleware(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    // Skip caching for non-GET requests or when skipCache returns true
    if (req.method !== 'GET' || skipCache(req)) {
      return handler(req)
    }

    // Generate cache key
    const baseKey = generateKey(req)
    const varyValues = varyBy.map(header => req.headers.get(header) || '').join(':')
    const cacheKey = `${baseKey}:${varyValues}`

    try {
      // Try to get cached response
      const cached = await cacheService.get<{
        status: number
        headers: Record<string, string>
        body: string
      }>(cacheKey, { prefix: 'http' })

      if (cached) {
        // Return cached response
        const response = new NextResponse(cached.body, {
          status: cached.status,
          headers: {
            ...cached.headers,
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey
          }
        })
        
        return response
      }

      // Execute handler and cache response
      const response = await handler(req)
      
      // Only cache successful responses
      if (response.status >= 200 && response.status < 300) {
        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value
        })

        const body = await response.text()
        
        await cacheService.set(
          cacheKey,
          {
            status: response.status,
            headers: responseHeaders,
            body
          },
          { ttl, prefix: 'http' }
        )

        // Return response with cache headers
        const cachedResponse = new NextResponse(body, {
          status: response.status,
          headers: {
            ...responseHeaders,
            ...headers,
            'X-Cache': 'MISS',
            'X-Cache-Key': cacheKey,
            'Cache-Control': `public, max-age=${ttl}`,
            'Vary': varyBy.join(', ')
          }
        })

        return cachedResponse
      }

      return response
    } catch (error) {
      console.error('Cache middleware error:', error)
      return handler(req)
    }
  }
}

/**
 * API Response Cache Decorator
 */
export function CacheResponse(options: {
  ttl?: number
  tags?: string[]
  varyBy?: string[]
  condition?: (req: NextRequest, res: any) => boolean
} = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (req: NextRequest, ...args: any[]) {
      const {
        ttl = 300,
        tags = [],
        varyBy = ['authorization'],
        condition = () => true
      } = options

      // Generate cache key
      const url = new URL(req.url)
      const baseKey = `api:${url.pathname}${url.search}`
      const varyValues = varyBy.map(header => req.headers.get(header) || '').join(':')
      const cacheKey = `${baseKey}:${varyValues}`

      try {
        // Check cache first
        const cached = await cacheService.get(cacheKey, { 
          prefix: 'api',
          tags 
        })

        if (cached) {
          return NextResponse.json(cached, {
            headers: {
              'X-Cache': 'HIT',
              'Cache-Control': `public, max-age=${ttl}`
            }
          })
        }

        // Execute method
        const response = await method.call(this, req, ...args)
        
        // Extract JSON data from response
        let data
        if (response instanceof NextResponse) {
          data = await response.json()
        } else {
          data = response
        }

        // Cache if condition is met
        if (condition(req, data)) {
          await cacheService.set(cacheKey, data, { 
            ttl, 
            prefix: 'api',
            tags 
          })
        }

        return NextResponse.json(data, {
          headers: {
            'X-Cache': 'MISS',
            'Cache-Control': `public, max-age=${ttl}`,
            'Vary': varyBy.join(', ')
          }
        })
      } catch (error) {
        console.error('API cache error:', error)
        return method.call(this, req, ...args)
      }
    }

    return descriptor
  }
}

/**
 * Static Asset Cache Headers
 */
export function setStaticCacheHeaders(response: NextResponse, maxAge: number = 31536000) {
  response.headers.set('Cache-Control', `public, max-age=${maxAge}, immutable`)
  response.headers.set('Expires', new Date(Date.now() + maxAge * 1000).toUTCString())
  return response
}

/**
 * Dynamic Content Cache Headers
 */
export function setDynamicCacheHeaders(
  response: NextResponse, 
  options: {
    maxAge?: number
    staleWhileRevalidate?: number
    mustRevalidate?: boolean
  } = {}
) {
  const {
    maxAge = 300,
    staleWhileRevalidate = 600,
    mustRevalidate = false
  } = options

  let cacheControl = `public, max-age=${maxAge}`
  
  if (staleWhileRevalidate > 0) {
    cacheControl += `, stale-while-revalidate=${staleWhileRevalidate}`
  }
  
  if (mustRevalidate) {
    cacheControl += ', must-revalidate'
  }

  response.headers.set('Cache-Control', cacheControl)
  return response
}

/**
 * ETag Generation and Validation
 */
export function generateETag(content: string): string {
  // Simple hash function for ETag generation
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return `"${Math.abs(hash).toString(16)}"`
}

export function handleETag(req: NextRequest, content: string): NextResponse | null {
  const etag = generateETag(content)
  const ifNoneMatch = req.headers.get('if-none-match')
  
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': 'public, max-age=300'
      }
    })
  }
  
  return null
}

/**
 * Compression Headers
 */
export function setCompressionHeaders(response: NextResponse, contentType: string) {
  if (contentType.includes('text/') || 
      contentType.includes('application/json') || 
      contentType.includes('application/javascript') ||
      contentType.includes('text/css')) {
    response.headers.set('Content-Encoding', 'gzip')
    response.headers.set('Vary', 'Accept-Encoding')
  }
  return response
}

/**
 * Cache Invalidation Utilities
 */
export class CacheInvalidation {
  /**
   * Invalidate API cache by pattern
   */
  static async invalidateApiCache(pattern: string) {
    return cacheService.clear(`api:${pattern}`)
  }

  /**
   * Invalidate HTTP cache by pattern
   */
  static async invalidateHttpCache(pattern: string) {
    return cacheService.clear(`http:${pattern}`)
  }

  /**
   * Invalidate all caches for a specific entity
   */
  static async invalidateEntity(entity: string) {
    const patterns = [
      `api:*${entity}*`,
      `http:*${entity}*`
    ]
    
    let totalInvalidated = 0
    for (const pattern of patterns) {
      totalInvalidated += await cacheService.clear(pattern)
    }
    
    return totalInvalidated
  }

  /**
   * Purge expired cache entries
   */
  static async purgeExpired() {
    // This would typically be handled by Redis TTL, but we can implement
    // additional cleanup logic here if needed
    const stats = cacheService.getStats()
    return stats
  }
}

export default {
  createCacheMiddleware,
  CacheResponse,
  setStaticCacheHeaders,
  setDynamicCacheHeaders,
  generateETag,
  handleETag,
  setCompressionHeaders,
  CacheInvalidation
}