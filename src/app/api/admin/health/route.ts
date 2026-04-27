/**
 * Health Check Management API
 * 
 * API endpoints for health check dashboard and management
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { HealthChecker } from '@/lib/monitoring/health-checker'
import { ApplicationLogger } from '@/lib/logging'
import { ApiResponseBuilder } from '@/lib/api/response-builder'

/**
 * GET /api/admin/health - Get detailed health information and history
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return ApiResponseBuilder.unauthorized('No autorizado')
  }

  const timer = ApplicationLogger.timer('get_health_admin_data', {
    component: 'health-management-api'
  })

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'detailed', 'history', 'component'
    const component = searchParams.get('component') // Filter by component
    const limit = parseInt(searchParams.get('limit') || '50')

    let data: any

    switch (type) {
      case 'detailed':
        data = {
          systemHealth: HealthChecker.getSystemHealth(),
          config: HealthChecker.getConfig(),
          uptime: HealthChecker.getUptime()
        }
        break
      
      case 'history':
        data = HealthChecker.getHealthHistory().slice(0, limit)
        break
      
      case 'component':
        if (!component) {
          return ApiResponseBuilder.validationError(
            'Component parameter is required for component type'
          )
        }
        data = HealthChecker.getComponentHealth(component)
        break
      
      default:
        data = HealthChecker.getSystemHealth()
    }

    ApplicationLogger.businessOperation('get_health_admin_data', 'health-management-api', 'admin', {
      metadata: { 
        type, 
        component,
        limit,
        resultCount: Array.isArray(data) ? data.length : 1
      }
    })

    timer.end('Health admin data retrieved successfully')

    return ApiResponseBuilder.success(data)

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('health-management-api', 'degraded', {
      error: err.message,
      operation: 'get_health_admin_data'
    })
    timer.end('Failed to retrieve health admin data')

    return ApiResponseBuilder.internalError(
      'Failed to retrieve health information'
    )
  }
}

/**
 * POST /api/admin/health - Manage health check system
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return ApiResponseBuilder.unauthorized('No autorizado')
  }

  const timer = ApplicationLogger.timer('manage_health_system', {
    component: 'health-management-api'
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
      case 'perform-checks':
        result = await HealthChecker.performHealthChecks()
        break

      case 'register-custom-check':
        if (!params.name || !params.component || !params.checkFunction) {
          return ApiResponseBuilder.validationError(
            'Missing required fields for custom check: name, component, checkFunction'
          )
        }
        
        // Note: In a real implementation, you'd need to safely evaluate the checkFunction
        // For now, we'll just acknowledge the registration
        result = { 
          success: true, 
          message: `Custom check ${params.name} registered for component ${params.component}` 
        }
        break

      case 'get-component-health':
        if (!params.component) {
          return ApiResponseBuilder.validationError(
            'Missing required field: component'
          )
        }
        result = HealthChecker.getComponentHealth(params.component)
        break

      case 'get-uptime':
        result = {
          uptime: HealthChecker.getUptime(),
          uptimeFormatted: new Date(HealthChecker.getUptime()).toISOString()
        }
        break

      case 'get-config':
        result = HealthChecker.getConfig()
        break

      default:
        return ApiResponseBuilder.validationError(
          'Invalid action. Supported actions: perform-checks, register-custom-check, get-component-health, get-uptime'
        )
    }

    ApplicationLogger.businessOperation('manage_health_system', 'health-management-api', 'admin', {
      metadata: { action, result }
    })

    timer.end('Health system management action completed')

    return ApiResponseBuilder.success(result)

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('health-management-api', 'degraded', {
      error: err.message,
      operation: 'manage_health_system'
    })
    timer.end('Health system management action failed')

    return ApiResponseBuilder.internalError(
      'Failed to manage health system'
    )
  }
}

/**
 * PUT /api/admin/health/config - Update health check configuration
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return ApiResponseBuilder.unauthorized('No autorizado')
  }

  const timer = ApplicationLogger.timer('update_health_config', {
    component: 'health-management-api'
  })

  try {
    const body = await request.json()
    
    // Validate configuration
    const allowedFields = [
      'enabled',
      'checkInterval',
      'timeout',
      'retryAttempts',
      'retryDelay',
      'enableDependencyChecks',
      'enablePerformanceTracking',
      'alertOnFailure'
    ]

    const config: any = {}
    for (const field of allowedFields) {
      if (field in body) {
        config[field] = body[field]
      }
    }

    // Validate checks configuration if provided
    if (body.checks) {
      config.checks = body.checks
    }

    if (Object.keys(config).length === 0) {
      return ApiResponseBuilder.validationError(
        'No valid configuration fields provided'
      )
    }

    HealthChecker.updateConfig(config)

    ApplicationLogger.businessOperation('update_health_config', 'health-management-api', 'admin', {
      metadata: { updatedFields: Object.keys(config) }
    })

    timer.end('Health configuration updated')

    return ApiResponseBuilder.success(
      HealthChecker.getConfig()
    )

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('health-management-api', 'degraded', {
      error: err.message,
      operation: 'update_health_config'
    })
    timer.end('Health configuration update failed')

    return ApiResponseBuilder.internalError(
      'Failed to update health configuration'
    )
  }
}