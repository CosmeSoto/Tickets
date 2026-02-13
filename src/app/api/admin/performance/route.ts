/**
 * Performance Monitoring API
 * 
 * API endpoints for performance monitoring dashboard
 */

import { NextRequest } from 'next/server'
import { PerformanceMonitor } from '@/lib/monitoring/performance-monitor'
import { ApplicationLogger } from '@/lib/logging'
import { ApiResponseBuilder } from '@/lib/api/response-builder'

/**
 * GET /api/admin/performance - Get performance statistics and metrics
 */
export async function GET(request: NextRequest) {
  const timer = ApplicationLogger.timer('get_performance_stats', {
    component: 'performance-management-api'
  })

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'stats', 'metrics', 'alerts'
    const timeRange = searchParams.get('timeRange') // '1h', '24h', '7d', '30d'
    const component = searchParams.get('component') // Filter by component

    // Parse time range
    let start: Date | undefined
    let end: Date | undefined
    
    if (timeRange) {
      const now = new Date()
      switch (timeRange) {
        case '1h':
          start = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case '24h':
          start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
      }
      end = now
    }

    const stats = PerformanceMonitor.getPerformanceStats(
      start && end ? { start, end } : undefined
    )

    let data: any

    switch (type) {
      case 'stats':
        data = stats.summary
        break
      
      case 'metrics':
        data = stats.metrics
        // Filter by component if specified
        if (component) {
          const filtered: any = {}
          for (const [key, metrics] of Object.entries(data)) {
            const componentMetrics = (metrics as any[]).filter((m: any) => 
              m.context.component === component
            )
            if (componentMetrics.length > 0) {
              filtered[key] = componentMetrics
            }
          }
          data = filtered
        }
        break
      
      case 'alerts':
        data = stats.alerts
        break
      
      case 'aggregated':
        data = stats.aggregated
        break
      
      default:
        data = stats
    }

    ApplicationLogger.businessOperation('get_performance_stats', 'performance-management-api', 'admin', {
      metadata: { 
        type, 
        timeRange, 
        component,
        resultCount: Array.isArray(data) ? data.length : Object.keys(data).length
      }
    })

    timer.end('Performance stats retrieved successfully')

    return ApiResponseBuilder.success(data)

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('performance-management-api', 'degraded', {
      error: err.message,
      operation: 'get_performance_stats'
    })
    timer.end('Failed to retrieve performance stats')

    return ApiResponseBuilder.internalError(
      'Failed to retrieve performance statistics'
    )
  }
}

/**
 * POST /api/admin/performance - Manage performance monitoring
 */
export async function POST(request: NextRequest) {
  const timer = ApplicationLogger.timer('manage_performance', {
    component: 'performance-management-api'
  })

  try {
    const body = await request.json()
    const { action, ...params } = body

    if (!action) {
      return ApiResponseBuilder.validationError(
        'Missing required field: action'
      )
    }

    let result: any

    switch (action) {
      case 'clear-old-metrics':
        const days = params.days || 30
        result = PerformanceMonitor.clearOldMetrics(days)
        break

      case 'track-custom-metric':
        if (!params.name || !params.type || params.value === undefined) {
          return ApiResponseBuilder.validationError(
            'Missing required fields for custom metric: name, type, value'
          )
        }
        
        PerformanceMonitor.recordMetric({
          name: params.name,
          type: params.type,
          value: params.value,
          unit: params.unit || 'count',
          context: params.context || {}
        })
        
        result = { success: true, message: 'Custom metric recorded' }
        break

      case 'get-system-resources':
        PerformanceMonitor.trackSystemResources()
        result = { success: true, message: 'System resources tracked' }
        break

      default:
        return ApiResponseBuilder.validationError(
          'Invalid action. Supported actions: clear-old-metrics, track-custom-metric, get-system-resources'
        )
    }

    ApplicationLogger.businessOperation('manage_performance', 'performance-management-api', 'admin', {
      metadata: { action, result }
    })

    timer.end('Performance management action completed')

    return ApiResponseBuilder.success(result)

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('performance-management-api', 'degraded', {
      error: err.message,
      operation: 'manage_performance'
    })
    timer.end('Performance management action failed')

    return ApiResponseBuilder.internalError(
      'Failed to manage performance monitoring'
    )
  }
}

/**
 * PUT /api/admin/performance/config - Update performance monitoring configuration
 */
export async function PUT(request: NextRequest) {
  const timer = ApplicationLogger.timer('update_performance_config', {
    component: 'performance-management-api'
  })

  try {
    const body = await request.json()
    
    // Validate configuration
    const allowedFields = [
      'enabled',
      'sampleRate',
      'enableRealTimeMonitoring',
      'enableAggregation',
      'aggregationInterval',
      'retentionPeriod'
    ]

    const config: any = {}
    for (const field of allowedFields) {
      if (field in body) {
        config[field] = body[field]
      }
    }

    // Validate thresholds if provided
    if (body.thresholds) {
      config.thresholds = body.thresholds
    }

    // Validate alerting config if provided
    if (body.alerting) {
      config.alerting = body.alerting
    }

    if (Object.keys(config).length === 0) {
      return ApiResponseBuilder.validationError(
        'No valid configuration fields provided'
      )
    }

    PerformanceMonitor.updateConfig(config)

    ApplicationLogger.businessOperation('update_performance_config', 'performance-management-api', 'admin', {
      metadata: { updatedFields: Object.keys(config) }
    })

    timer.end('Performance configuration updated')

    return ApiResponseBuilder.success(
      PerformanceMonitor.getConfig()
    )

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('performance-management-api', 'degraded', {
      error: err.message,
      operation: 'update_performance_config'
    })
    timer.end('Performance configuration update failed')

    return ApiResponseBuilder.internalError(
      'Failed to update performance configuration'
    )
  }
}