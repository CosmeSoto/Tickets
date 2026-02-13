/**
 * Error Management API
 * 
 * API endpoints for error tracking dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { ErrorTracker } from '@/lib/monitoring/error-tracker'
import { ApplicationLogger } from '@/lib/logging'
import { ApiResponseBuilder } from '@/lib/api/response-builder'

/**
 * GET /api/admin/errors - Get error statistics and reports
 */
export async function GET(request: NextRequest) {
  const timer = ApplicationLogger.timer('get_error_stats', {
    component: 'error-management-api'
  })

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'stats', 'recent', 'top'
    const limit = parseInt(searchParams.get('limit') || '10')

    let data: any

    switch (type) {
      case 'stats':
        data = ErrorTracker.getErrorStats()
        break
      
      case 'recent':
        const stats = ErrorTracker.getErrorStats()
        data = stats.recentErrors.slice(0, limit)
        break
      
      case 'top':
        const topStats = ErrorTracker.getErrorStats()
        data = topStats.topErrors.slice(0, limit)
        break
      
      default:
        data = ErrorTracker.getErrorStats()
    }

    ApplicationLogger.businessOperation('get_error_stats', 'error-management-api', 'admin', {
      metadata: { type, limit, resultCount: Array.isArray(data) ? data.length : 1 }
    })

    timer.end('Error stats retrieved successfully')

    return ApiResponseBuilder.success(data)

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('error-management-api', 'degraded', {
      error: err.message,
      operation: 'get_error_stats'
    })
    timer.end('Failed to retrieve error stats')

    return ApiResponseBuilder.internalError(
      'Failed to retrieve error statistics'
    )
  }
}

/**
 * POST /api/admin/errors - Resolve or manage errors
 */
export async function POST(request: NextRequest) {
  const timer = ApplicationLogger.timer('manage_error', {
    component: 'error-management-api'
  })

  try {
    const body = await request.json()
    const { action, errorId, resolvedBy } = body

    if (!action || !errorId) {
      return ApiResponseBuilder.validationError(
        'Missing required fields: action, errorId'
      )
    }

    let result: any

    switch (action) {
      case 'resolve':
        result = ErrorTracker.resolveError(errorId, resolvedBy)
        if (!result) {
          return ApiResponseBuilder.notFound(
            'Error not found'
          )
        }
        break

      case 'clear-old':
        const days = body.days || 30
        result = ErrorTracker.clearOldErrors(days)
        break

      default:
        return ApiResponseBuilder.validationError(
          'Invalid action. Supported actions: resolve, clear-old'
        )
    }

    ApplicationLogger.businessOperation('manage_error', 'error-management-api', 'admin', {
      metadata: { action, errorId, resolvedBy, result }
    })

    timer.end('Error management action completed')

    return ApiResponseBuilder.success(result)

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('error-management-api', 'degraded', {
      error: err.message,
      operation: 'manage_error'
    })
    timer.end('Error management action failed')

    return ApiResponseBuilder.internalError(
      'Failed to manage error'
    )
  }
}

/**
 * PUT /api/admin/errors/config - Update error tracking configuration
 */
export async function PUT(request: NextRequest) {
  const timer = ApplicationLogger.timer('update_error_config', {
    component: 'error-management-api'
  })

  try {
    const body = await request.json()
    
    // Validate configuration
    const allowedFields = [
      'enabled',
      'sampleRate',
      'enableStackTrace',
      'enableUserContext',
      'enablePerformanceTracking'
    ]

    const config: any = {}
    for (const field of allowedFields) {
      if (field in body) {
        config[field] = body[field]
      }
    }

    if (Object.keys(config).length === 0) {
      return ApiResponseBuilder.validationError(
        'No valid configuration fields provided'
      )
    }

    ErrorTracker.updateConfig(config)

    ApplicationLogger.businessOperation('update_error_config', 'error-management-api', 'admin', {
      metadata: { updatedFields: Object.keys(config) }
    })

    timer.end('Error configuration updated')

    return ApiResponseBuilder.success(
      ErrorTracker.getConfig()
    )

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('error-management-api', 'degraded', {
      error: err.message,
      operation: 'update_error_config'
    })
    timer.end('Error configuration update failed')

    return ApiResponseBuilder.internalError(
      'Failed to update error configuration'
    )
  }
}