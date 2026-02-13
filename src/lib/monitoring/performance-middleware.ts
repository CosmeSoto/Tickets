/**
 * Performance Monitoring Middleware
 * 
 * Automatic performance tracking for API routes and middleware
 */

import { NextRequest, NextResponse } from 'next/server'
import { PerformanceMonitor } from './performance-monitor'
import { ApplicationLogger } from '@/lib/logging'

export interface PerformanceMiddlewareConfig {
  enabled: boolean
  trackAllRequests: boolean
  trackSlowRequests: boolean
  slowRequestThreshold: number // ms
  trackResourceUsage: boolean
  resourceUsageInterval: number // ms
  excludePaths: string[]
  sampleRate: number
}

const DEFAULT_CONFIG: PerformanceMiddlewareConfig = {
  enabled: true,
  trackAllRequests: true,
  trackSlowRequests: true,
  slowRequestThreshold: 1000, // 1 second
  trackResourceUsage: true,
  resourceUsageInterval: 30000, // 30 seconds
  excludePaths: ['/api/health', '/api/metrics', '/_next/', '/favicon.ico'],
  sampleRate: 1.0
}

export class PerformanceMiddleware {
  private config: PerformanceMiddlewareConfig
  private resourceUsageTimer?: NodeJS.Timeout

  constructor(config: Partial<PerformanceMiddlewareConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    if (this.config.enabled && this.config.trackResourceUsage) {
      this.startResourceUsageTracking()
    }
  }

  /**
   * Wrap API route handler with performance tracking
   */
  withPerformanceTracking<T extends any[], R>(
    handler: (...args: T) => Promise<R>,
    context: {
      route: string
      method: string
      component?: string
    }
  ) {
    return async (...args: T): Promise<R> => {
      if (!this.config.enabled || Math.random() > this.config.sampleRate) {
        return handler(...args)
      }

      const startTime = performance.now()
      const timerId = PerformanceMonitor.startTimer(`api_${context.method}_${context.route}`, {
        component: context.component || 'api',
        operation: context.method,
        endpoint: context.route
      })

      const timer = ApplicationLogger.timer('api_request_performance', {
        component: 'performance-middleware',
        metadata: { route: context.route, method: context.method }
      })

      try {
        const result = await handler(...args)
        const duration = performance.now() - startTime
        
        // End performance timer
        PerformanceMonitor.endTimer(timerId)
        
        // Extract response info if available
        let statusCode = 200
        if (result && typeof result === 'object' && 'status' in result) {
          statusCode = (result as any).status
        }

        // Track API performance
        PerformanceMonitor.trackAPIPerformance(
          context.route,
          context.method,
          duration,
          statusCode,
          {
            component: context.component || 'api',
            operation: context.method
          }
        )

        // Log slow requests
        if (this.config.trackSlowRequests && duration > this.config.slowRequestThreshold) {
          ApplicationLogger.systemHealth('performance-middleware', 'degraded', {
            slowRequest: context.route,
            method: context.method,
            duration,
            threshold: this.config.slowRequestThreshold
          })
        }

        timer.end('API request performance tracked')
        return result

      } catch (error) {
        const duration = performance.now() - startTime
        
        // End performance timer
        PerformanceMonitor.endTimer(timerId)
        
        // Track failed API performance
        PerformanceMonitor.trackAPIPerformance(
          context.route,
          context.method,
          duration,
          500, // Assume 500 for errors
          {
            component: context.component || 'api',
            operation: context.method,
            metadata: { error: true }
          }
        )

        timer.end('API request failed - performance tracked')
        throw error
      }
    }
  }

  /**
   * Middleware for Next.js middleware.ts
   */
  async handleRequest(request: NextRequest): Promise<NextResponse | null> {
    if (!this.config.enabled) {
      return null
    }

    const pathname = request.nextUrl.pathname

    // Skip excluded paths
    if (this.config.excludePaths.some(path => pathname.startsWith(path))) {
      return null
    }

    // Track request start time in headers for downstream handlers
    const response = NextResponse.next()
    response.headers.set('x-perf-start', performance.now().toString())
    response.headers.set('x-perf-path', pathname)
    response.headers.set('x-perf-method', request.method)

    return response
  }

  /**
   * Start resource usage tracking
   */
  private startResourceUsageTracking(): void {
    this.resourceUsageTimer = setInterval(() => {
      PerformanceMonitor.trackSystemResources()
    }, this.config.resourceUsageInterval)
  }

  /**
   * Stop resource usage tracking
   */
  stopResourceUsageTracking(): void {
    if (this.resourceUsageTimer) {
      clearInterval(this.resourceUsageTimer)
      this.resourceUsageTimer = undefined
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PerformanceMiddlewareConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceMiddlewareConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Restart resource tracking if config changed
    if (newConfig.trackResourceUsage !== undefined || newConfig.resourceUsageInterval !== undefined) {
      this.stopResourceUsageTracking()
      if (this.config.trackResourceUsage) {
        this.startResourceUsageTracking()
      }
    }
  }
}

/**
 * Higher-order function to wrap API routes with performance tracking
 */
export function withPerformanceTracking(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    route: string
    method: string
    component?: string
  }
) {
  const middleware = new PerformanceMiddleware()
  
  return middleware.withPerformanceTracking(handler, options)
}

/**
 * Decorator for class methods
 */
export function trackPerformance(
  target: any,
  propertyName: string,
  descriptor: PropertyDescriptor
) {
  const method = descriptor.value

  descriptor.value = async function (...args: any[]) {
    const timerId = PerformanceMonitor.startTimer(`method_${propertyName}`, {
      component: target.constructor.name,
      operation: propertyName
    })

    try {
      const result = await method.apply(this, args)
      PerformanceMonitor.endTimer(timerId)
      return result
    } catch (error) {
      PerformanceMonitor.endTimer(timerId)
      throw error
    }
  }

  return descriptor
}

/**
 * Create performance tracking middleware for Express-style middleware
 */
export function createPerformanceMiddleware(config?: Partial<PerformanceMiddlewareConfig>) {
  const middleware = new PerformanceMiddleware(config)
  
  return async (request: NextRequest): Promise<NextResponse | null> => {
    return middleware.handleRequest(request)
  }
}