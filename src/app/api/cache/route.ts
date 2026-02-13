/**
 * Cache Management API
 * Endpoints for cache monitoring and management
 */

import { NextRequest, NextResponse } from 'next/server'
import { cacheService } from '@/lib/cache'
import { cacheManagementService } from '@/services/cached-services'
import { CacheInvalidation } from '@/middleware/cache-middleware'
import { ApiResponse } from '@/lib/api-response'

/**
 * GET /api/cache - Get cache statistics and health
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'stats':
        const stats = cacheService.getStats()
        const hitRatio = cacheService.getHitRatio()
        
        return ApiResponse.success({
          stats,
          hitRatio: Math.round(hitRatio * 100),
          status: hitRatio > 0.7 ? 'healthy' : hitRatio > 0.5 ? 'warning' : 'poor'
        })

      case 'health':
        const health = await cacheManagementService.getCacheHealth()
        return ApiResponse.success(health)

      default:
        const overview = {
          stats: cacheService.getStats(),
          hitRatio: Math.round(cacheService.getHitRatio() * 100),
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
        
        return ApiResponse.success(overview)
    }
  } catch (error) {
    console.error('Cache GET error:', error)
    return ApiResponse.error('Failed to get cache information', 500)
  }
}

/**
 * POST /api/cache - Cache management operations
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, pattern, entity, tags } = body

    switch (action) {
      case 'clear':
        if (pattern) {
          const cleared = await cacheService.clear(pattern)
          return ApiResponse.success({ 
            message: `Cleared ${cleared} cache entries`,
            cleared 
          })
        } else {
          const cleared = await cacheManagementService.clearAllCaches()
          return ApiResponse.success({ 
            message: `Cleared all caches (${cleared} entries)`,
            cleared 
          })
        }

      case 'invalidate':
        if (entity) {
          const invalidated = await cacheManagementService.invalidateEntity(entity)
          return ApiResponse.success({ 
            message: `Invalidated ${invalidated} cache entries for ${entity}`,
            invalidated 
          })
        } else if (tags && Array.isArray(tags)) {
          const invalidated = await cacheService.invalidateByTags(tags)
          return ApiResponse.success({ 
            message: `Invalidated ${invalidated} cache entries by tags`,
            invalidated 
          })
        } else {
          return ApiResponse.error('Entity or tags required for invalidation', 400)
        }

      case 'warmup':
        await cacheManagementService.warmUpCaches()
        return ApiResponse.success({ 
          message: 'Cache warm-up completed successfully' 
        })

      case 'reset-stats':
        cacheService.resetStats()
        return ApiResponse.success({ 
          message: 'Cache statistics reset successfully' 
        })

      case 'purge-expired':
        const purgeResult = await CacheInvalidation.purgeExpired()
        return ApiResponse.success({ 
          message: 'Expired cache entries purged',
          stats: purgeResult 
        })

      default:
        return ApiResponse.error('Invalid action', 400)
    }
  } catch (error) {
    console.error('Cache POST error:', error)
    return ApiResponse.error('Cache operation failed', 500)
  }
}

/**
 * DELETE /api/cache - Delete specific cache entries
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const key = url.searchParams.get('key')
    const pattern = url.searchParams.get('pattern')

    if (key) {
      const deleted = await cacheService.delete(key)
      return ApiResponse.success({ 
        message: deleted ? 'Cache entry deleted' : 'Cache entry not found',
        deleted 
      })
    } else if (pattern) {
      const cleared = await cacheService.clear(pattern)
      return ApiResponse.success({ 
        message: `Cleared ${cleared} cache entries matching pattern`,
        cleared 
      })
    } else {
      return ApiResponse.error('Key or pattern required', 400)
    }
  } catch (error) {
    console.error('Cache DELETE error:', error)
    return ApiResponse.error('Failed to delete cache entries', 500)
  }
}

/**
 * PUT /api/cache - Update cache settings or entries
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { key, value, ttl, tags } = body

    if (!key || value === undefined) {
      return ApiResponse.error('Key and value required', 400)
    }

    const success = await cacheService.set(key, value, { 
      ttl: ttl || 3600,
      tags: tags || []
    })

    return ApiResponse.success({ 
      message: success ? 'Cache entry updated' : 'Failed to update cache entry',
      success 
    })
  } catch (error) {
    console.error('Cache PUT error:', error)
    return ApiResponse.error('Failed to update cache entry', 500)
  }
}