/**
 * Health Check API
 *
 * Public health check endpoint for system monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { HealthChecker, HealthStatus } from '@/lib/monitoring/health-checker'
import { ApplicationLogger } from '@/lib/logging'

/**
 * GET /api/health - Get system health status
 */
export async function GET(request: NextRequest) {
  const timer = ApplicationLogger.timer('health_check_api', {
    component: 'health-api',
  })

  try {
    const { searchParams } = new URL(request.url)
    const detailed = searchParams.get('detailed') === 'true'
    const component = searchParams.get('component')

    let healthData: any

    if (component) {
      // Get health for specific component
      const componentHealth = HealthChecker.getComponentHealth(component)
      healthData = {
        component,
        checks: componentHealth,
        status:
          componentHealth.length > 0
            ? componentHealth.every(c => c.status === HealthStatus.HEALTHY)
              ? HealthStatus.HEALTHY
              : HealthStatus.UNHEALTHY
            : HealthStatus.UNKNOWN,
      }
    } else {
      // Get overall system health
      const systemHealth = HealthChecker.getSystemHealth()

      if (detailed) {
        healthData = systemHealth
      } else {
        // Simplified response for load balancers/monitoring tools
        healthData = {
          status: systemHealth.overall,
          timestamp: systemHealth.lastCheck,
          uptime: systemHealth.uptime,
          summary: systemHealth.summary,
        }
      }
    }

    // Determine HTTP status code based on health
    // Only return 503 if critical services (database) are unhealthy
    // Degraded state or unknown (no checks yet) should still return 200
    let statusCode = 200
    if (healthData.status === HealthStatus.UNHEALTHY) {
      // Check if it's only non-critical services that are unhealthy
      const components = healthData.components || {}
      const dbCheck = components['database_connectivity']
      const isCriticalFailure = dbCheck && dbCheck.status === HealthStatus.UNHEALTHY
      if (isCriticalFailure) {
        statusCode = 503 // Only 503 if database is down
      }
      // Other unhealthy components (redis, external) → still 200 to avoid container restart loop
    }

    ApplicationLogger.businessOperation('health_check_request', 'health-api', 'monitoring', {
      metadata: {
        detailed,
        component,
        status: healthData.status,
        statusCode,
      },
    })

    timer.end('Health check completed')

    return NextResponse.json(healthData, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('health-api', 'unhealthy', {
      error: err.message,
      operation: 'health_check_api',
    })
    timer.end('Health check failed')

    return NextResponse.json(
      {
        status: HealthStatus.UNHEALTHY,
        message: 'Health check system error',
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    )
  }
}

/**
 * POST /api/health - Trigger manual health check
 */
export async function POST(request: NextRequest) {
  const timer = ApplicationLogger.timer('manual_health_check', {
    component: 'health-api',
  })

  try {
    // Perform fresh health checks
    const systemHealth = await HealthChecker.performHealthChecks()

    ApplicationLogger.businessOperation('manual_health_check', 'health-api', 'monitoring', {
      metadata: {
        status: systemHealth.overall,
        checksPerformed: systemHealth.summary.total,
      },
    })

    timer.end('Manual health check completed')

    return NextResponse.json(
      {
        message: 'Health check completed',
        ...systemHealth,
      },
      {
        status: systemHealth.overall === HealthStatus.UNHEALTHY ? 503 : 200,
      }
    )
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('health-api', 'unhealthy', {
      error: err.message,
      operation: 'manual_health_check',
    })
    timer.end('Manual health check failed')

    return NextResponse.json(
      {
        status: HealthStatus.UNHEALTHY,
        message: 'Manual health check failed',
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
