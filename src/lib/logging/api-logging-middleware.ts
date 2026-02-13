/**
 * API Logging Middleware
 * 
 * Automatically logs all API requests and responses with structured logging
 * Integrates with the existing API route template system
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApplicationLogger } from './application-logger';
import { LogContext } from './logger';

export interface ApiLoggingConfig {
  logRequestBody?: boolean;
  logResponseBody?: boolean;
  logHeaders?: boolean;
  excludePaths?: string[];
  excludeHeaders?: string[];
  maxBodySize?: number;
}

const DEFAULT_CONFIG: ApiLoggingConfig = {
  logRequestBody: true,
  logResponseBody: false, // Usually too verbose for production
  logHeaders: false, // May contain sensitive data
  excludePaths: ['/api/health', '/api/metrics'],
  excludeHeaders: ['authorization', 'cookie', 'x-api-key'],
  maxBodySize: 1024 * 10, // 10KB max
};

export class ApiLoggingMiddleware {
  private config: ApiLoggingConfig;

  constructor(config: Partial<ApiLoggingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Wrap an API handler with logging
   */
  public withLogging<T>(
    handler: (request: NextRequest, context?: any) => Promise<NextResponse | Response>,
    operationName?: string
  ) {
    return async (request: NextRequest, context?: any): Promise<NextResponse | Response> => {
      const startTime = performance.now();
      const requestId = this.generateRequestId();
      const path = new URL(request.url).pathname;
      const method = request.method;

      // Skip logging for excluded paths
      if (this.config.excludePaths?.includes(path)) {
        return handler(request, context);
      }

      // Create base logging context
      const logContext: LogContext = {
        requestId,
        operation: operationName || `${method} ${path}`,
        component: 'api',
        metadata: {
          method,
          path,
          userAgent: request.headers.get('user-agent'),
          ip: this.getClientIp(request),
        },
      };

      // Add user context if available
      const userId = await this.extractUserId(request);
      if (userId) {
        logContext.userId = userId;
      }

      // Log request start
      ApplicationLogger.apiRequestStart(method, path, logContext);

      // Log request details if enabled
      if (this.config.logRequestBody || this.config.logHeaders) {
        await this.logRequestDetails(request, logContext);
      }

      let response: NextResponse | Response;
      let error: Error | null = null;

      try {
        // Execute the handler
        response = await handler(request, context);
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
        
        // Log the error
        ApplicationLogger.apiRequestError(method, path, error, logContext);
        
        // Re-throw to maintain error handling behavior
        throw error;
      }

      // Calculate duration
      const duration = performance.now() - startTime;
      const statusCode = response.status;

      // Log response details if enabled
      if (this.config.logResponseBody && response instanceof NextResponse) {
        await this.logResponseDetails(response, logContext);
      }

      // Log request completion
      ApplicationLogger.apiRequestComplete(method, path, statusCode, duration, {
        ...logContext,
        metadata: {
          ...logContext.metadata,
          responseSize: this.getResponseSize(response),
        },
      });

      return response;
    };
  }

  /**
   * Create a logging decorator for API route handlers
   */
  public static logged(config?: Partial<ApiLoggingConfig>) {
    const middleware = new ApiLoggingMiddleware(config);
    
    return function <T extends Function>(
      target: any,
      propertyName: string,
      descriptor: TypedPropertyDescriptor<T>
    ) {
      const method = descriptor.value;
      if (!method) return;

      descriptor.value = middleware.withLogging(
        method as any,
        `${target.constructor.name}.${propertyName}`
      ) as any;
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientIp(request: NextRequest): string {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'unknown'
    );
  }

  private async extractUserId(request: NextRequest): Promise<string | undefined> {
    try {
      // Try to extract user ID from various sources
      
      // From Authorization header (if JWT)
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        // This would need to be implemented based on your auth system
        // For now, we'll skip JWT parsing
      }

      // From session cookie (if using NextAuth)
      const sessionToken = request.cookies.get('next-auth.session-token')?.value ||
                          request.cookies.get('__Secure-next-auth.session-token')?.value;
      
      if (sessionToken) {
        // This would need to decode the session token
        // For now, we'll return a placeholder
        return 'user_from_session';
      }

      return undefined;
    } catch (error) {
      // Don't fail the request if user extraction fails
      return undefined;
    }
  }

  private async logRequestDetails(request: NextRequest, context: LogContext): Promise<void> {
    const details: Record<string, any> = {};

    // Log headers if enabled
    if (this.config.logHeaders) {
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        if (!this.config.excludeHeaders?.includes(key.toLowerCase())) {
          headers[key] = value;
        }
      });
      details.headers = headers;
    }

    // Log request body if enabled
    if (this.config.logRequestBody && this.hasBody(request)) {
      try {
        const body = await this.getRequestBody(request);
        if (body && body.length <= (this.config.maxBodySize || 0)) {
          details.body = body;
        } else {
          details.bodySize = body?.length || 0;
          details.bodyTruncated = true;
        }
      } catch (error) {
        details.bodyError = 'Failed to read request body';
      }
    }

    if (Object.keys(details).length > 0) {
      ApplicationLogger.child(context).debug('Request details', {
        metadata: details,
      });
    }
  }

  private async logResponseDetails(response: NextResponse, context: LogContext): Promise<void> {
    const details: Record<string, any> = {};

    // Log response headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    details.headers = headers;

    // Log response body if enabled and not too large
    try {
      const body = await response.text();
      if (body && body.length <= (this.config.maxBodySize || 0)) {
        details.body = body;
      } else {
        details.bodySize = body?.length || 0;
        details.bodyTruncated = true;
      }
    } catch (error) {
      details.bodyError = 'Failed to read response body';
    }

    ApplicationLogger.child(context).debug('Response details', {
      metadata: details,
    });
  }

  private hasBody(request: NextRequest): boolean {
    const method = request.method.toUpperCase();
    return ['POST', 'PUT', 'PATCH'].includes(method);
  }

  private async getRequestBody(request: NextRequest): Promise<string | null> {
    try {
      const contentType = request.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const json = await request.json();
        return JSON.stringify(json);
      } else if (contentType.includes('text/')) {
        return await request.text();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        const obj: Record<string, any> = {};
        formData.forEach((value, key) => {
          obj[key] = value;
        });
        return JSON.stringify(obj);
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private getResponseSize(response: NextResponse | Response): number | undefined {
    const contentLength = response.headers.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : undefined;
  }
}

// Export convenience function for wrapping handlers
export function withApiLogging<T>(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse | Response>,
  config?: Partial<ApiLoggingConfig>
) {
  const middleware = new ApiLoggingMiddleware(config);
  return middleware.withLogging(handler);
}

// Export decorator
export const logged = ApiLoggingMiddleware.logged;