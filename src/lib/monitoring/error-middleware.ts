/**
 * Error Tracking Middleware
 * 
 * Automatic error capture for API routes and middleware
 */

import { NextRequest, NextResponse } from 'next/server'
import { ErrorTracker, ErrorType, ErrorSeverity } from './error-tracker'
import { ApplicationLogger } from '@/lib/logging'

export interface ErrorMiddlewareConfig {
  enabled: boolean
  captureRequestBody: boolean
  captureResponseBody: boolean
  maxBodySize: number
  excludePaths: string[]
  excludeStatusCodes: number[]
}

const DEFAULT_CONFIG: ErrorMiddlewareConfig = {
  enabled: true,
  captureRequestBody: true,
  captureResponseBody: false,
  maxBodySize: 10 * 1024, // 10KB
  excludePaths: ['/api/health', '/api/metrics', '/_next/'],
  excludeStatusCodes: [401, 404] // Don't track auth failures and not found as errors
}

export class ErrorMiddleware {
  private config: ErrorMiddlewareConfig

  constructor(config: Partial<ErrorMiddlewareConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Wrap API route handler with error tracking
   */
  withErrorTracking<T extends any[], R>(
    handler: (...args: T) => Promise<R>,
    context: {
      route: string
      method: string
      component?: string
    }
  ) {
    return async (...args: T): Promise<R> => {
      const timer = ApplicationLogger.timer('api_request_with_error_tracking', {
        component: 'error-middleware',
        metadata: { route: context.route, method: context.method }
      })

      try {
        const result = await handler(...args)
        timer.end('API request completed successfully')
        return result

      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        
        // Extract request context if available
        const request = args[0] as NextRequest
        const requestContext = this.extractRequestContext(request, context)

        // Track the error
        await ErrorTracker.trackAPIError(
          err,
          {
            method: context.method,
            url: context.route,
            headers: requestContext.headers,
            body: requestContext.body
          },
          undefined, // Response not available in error case
          requestContext.userId
        )

        timer.end('API request failed with error')
        throw error // Re-throw to maintain normal error handling
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

    // Continue with request - errors will be caught by route handlers
    return null
  }

  /**
   * Error boundary for React components
   */
  static createErrorBoundary() {
    return class ErrorBoundary extends Error {
      constructor(
        public error: Error,
        public errorInfo: { componentStack: string }
      ) {
        super(error.message)
        this.name = 'ErrorBoundary'
        
        // Track React error
        ErrorTracker.trackError(
          error,
          {
            component: 'react-error-boundary',
            metadata: {
              componentStack: errorInfo.componentStack
            }
          },
          ErrorType.JAVASCRIPT,
          ErrorSeverity.HIGH
        )
      }
    }
  }

  /**
   * Global error handler for unhandled errors
   */
  static setupGlobalErrorHandler(): void {
    // Client-side error handling
    if (typeof window !== 'undefined') {
      // Handle JavaScript errors
      window.addEventListener('error', (event) => {
        ErrorTracker.trackError(
          event.error || new Error(event.message),
          {
            url: event.filename,
            component: 'global-error-handler',
            metadata: {
              lineno: event.lineno,
              colno: event.colno,
              source: event.filename
            }
          },
          ErrorType.JAVASCRIPT,
          ErrorSeverity.MEDIUM
        )
      })

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error 
          ? event.reason 
          : new Error(String(event.reason))

        ErrorTracker.trackError(
          error,
          {
            component: 'unhandled-promise',
            metadata: {
              reason: String(event.reason)
            }
          },
          ErrorType.JAVASCRIPT,
          ErrorSeverity.HIGH
        )
      })

      // Handle network errors
      window.addEventListener('offline', () => {
        ErrorTracker.trackError(
          new Error('Network connection lost'),
          {
            component: 'network',
            metadata: {
              online: navigator.onLine,
              connectionType: (navigator as any).connection?.effectiveType
            }
          },
          ErrorType.NETWORK,
          ErrorSeverity.MEDIUM
        )
      })
    }

    // Server-side error handling
    if (typeof process !== 'undefined') {
      process.on('unhandledRejection', (reason, promise) => {
        const error = reason instanceof Error ? reason : new Error(String(reason))
        ErrorTracker.trackError(
          error,
          {
            component: 'unhandled-promise-server',
            metadata: {
              promise: promise.toString()
            }
          },
          ErrorType.SYSTEM,
          ErrorSeverity.HIGH
        )
      })

      process.on('uncaughtException', (error) => {
        ErrorTracker.trackError(
          error,
          {
            component: 'uncaught-exception',
            metadata: {
              pid: process.pid,
              memory: process.memoryUsage()
            }
          },
          ErrorType.SYSTEM,
          ErrorSeverity.CRITICAL
        )
      })
    }
  }

  private extractRequestContext(request: NextRequest, context: any) {
    const headers: Record<string, string> = {}
    
    // Extract safe headers
    const safeHeaders = [
      'user-agent',
      'accept',
      'accept-language',
      'content-type',
      'referer'
    ]
    
    safeHeaders.forEach(header => {
      const value = request.headers.get(header)
      if (value) {
        headers[header] = value
      }
    })

    // Extract user ID from headers or session
    const userId = request.headers.get('x-user-id') || 
                  request.headers.get('authorization')?.split(' ')[1] // Basic extraction

    let body: any = undefined
    if (this.config.captureRequestBody && request.body) {
      // Note: In practice, you'd need to clone the request to read the body
      // This is a simplified version
      body = '[Request body capture not implemented in middleware]'
    }

    return {
      headers,
      userId,
      body,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    }
  }
}

/**
 * Higher-order function to wrap API routes with error tracking
 */
export function withErrorTracking(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    route: string
    method: string
    component?: string
  }
) {
  const middleware = new ErrorMiddleware()
  
  return middleware.withErrorTracking(handler, options)
}

/**
 * Decorator for class methods
 */
export function trackErrors(
  target: any,
  propertyName: string,
  descriptor: PropertyDescriptor
) {
  const method = descriptor.value

  descriptor.value = async function (...args: any[]) {
    try {
      return await method.apply(this, args)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      
      await ErrorTracker.trackError(
        err,
        {
          component: target.constructor.name,
          operation: propertyName,
          metadata: {
            className: target.constructor.name,
            methodName: propertyName,
            argsCount: args.length
          }
        },
        ErrorType.BUSINESS_LOGIC,
        ErrorSeverity.MEDIUM
      )
      
      throw error
    }
  }

  return descriptor
}

/**
 * Utility to manually track errors in try-catch blocks
 */
export async function captureError(
  error: Error,
  context: {
    component?: string
    operation?: string
    userId?: string
    metadata?: Record<string, any>
  } = {}
): Promise<void> {
  await ErrorTracker.trackError(
    error,
    context,
    ErrorType.BUSINESS_LOGIC,
    ErrorSeverity.MEDIUM
  )
}

/**
 * Create error tracking middleware for Express-style middleware
 */
export function createErrorTrackingMiddleware(config?: Partial<ErrorMiddlewareConfig>) {
  const middleware = new ErrorMiddleware(config)
  
  return async (request: NextRequest): Promise<NextResponse | null> => {
    return middleware.handleRequest(request)
  }
}