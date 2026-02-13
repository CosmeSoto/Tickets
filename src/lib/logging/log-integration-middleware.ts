/**
 * Log Integration Middleware
 * 
 * Integrates log management with the application by automatically
 * capturing and processing log entries
 */

import { logger } from './logger';
import { logManager } from './log-manager';
import { logAggregator, LogEntry } from './log-aggregator';
import { ApplicationLogger } from './application-logger';

// Type definitions for Next.js compatibility
interface RequestLike {
  url: string;
  method: string;
  headers: {
    get(name: string): string | null;
  };
}

interface ResponseLike {
  status?: number;
}

export interface LogIntegrationConfig {
  enableAutoCapture: boolean;
  captureApiRequests: boolean;
  captureErrors: boolean;
  capturePerformance: boolean;
  excludePaths: string[];
  maxLogEntrySize: number;
}

export class LogIntegrationMiddleware {
  private static config: LogIntegrationConfig = {
    enableAutoCapture: true,
    captureApiRequests: true,
    captureErrors: true,
    capturePerformance: true,
    excludePaths: ['/api/health', '/api/metrics', '/_next'],
    maxLogEntrySize: 10000, // 10KB
  };

  /**
   * Configure the middleware
   */
  public static configure(config: Partial<LogIntegrationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public static getConfiguration(): LogIntegrationConfig {
    return { ...this.config };
  }

  /**
   * Middleware function for Next.js API routes
   */
  public static withLogIntegration<T extends any[], R>(
    handler: (...args: T) => Promise<R>
  ) {
    return async (...args: T): Promise<R> => {
      if (!this.config.enableAutoCapture) {
        return handler(...args);
      }

      const startTime = Date.now();
      let request: RequestLike | undefined;
      let response: ResponseLike | undefined;

      // Extract request and response from arguments
      if (args.length >= 1 && args[0] && typeof args[0] === 'object' && 'url' in args[0]) {
        request = args[0] as RequestLike;
      }

      try {
        const result = await handler(...args);
        
        if (result && typeof result === 'object' && 'status' in result) {
          response = result as ResponseLike;
        }

        // Capture successful API request
        if (request && this.config.captureApiRequests) {
          this.captureApiRequest(request, response, Date.now() - startTime, null);
        }

        return result;
      } catch (error) {
        // Capture error
        if (this.config.captureErrors) {
          this.captureError(error as Error, request);
        }

        // Capture failed API request
        if (request && this.config.captureApiRequests) {
          this.captureApiRequest(request, response, Date.now() - startTime, error as Error);
        }

        throw error;
      }
    };
  }

  /**
   * Capture API request log entry
   */
  private static captureApiRequest(
    request: RequestLike,
    response: ResponseLike | undefined,
    duration: number,
    error: Error | null
  ): void {
    const url = new URL(request.url);
    const path = url.pathname;

    // Check if path should be excluded
    if (this.config.excludePaths.some(excludePath => path.startsWith(excludePath))) {
      return;
    }

    const statusCode = response?.status || (error ? 500 : 200);
    const level = error ? 'ERROR' : (statusCode >= 400 ? 'WARN' : 'INFO');

    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      level,
      message: `API Request: ${request.method} ${path} - ${statusCode}`,
      component: 'api',
      operation: 'api_request',
      requestId: this.extractRequestId(request),
      metadata: {
        method: request.method,
        path,
        statusCode,
        duration,
        userAgent: request.headers.get('user-agent'),
        ip: this.extractClientIP(request),
        ...(error && { error: this.serializeError(error) }),
      },
    };

    this.processLogEntry(logEntry);
  }

  /**
   * Capture error log entry
   */
  private static captureError(error: Error, request?: RequestLike): void {
    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      level: 'ERROR',
      message: `Error: ${error.message}`,
      component: 'application',
      operation: 'error_handling',
      requestId: request ? this.extractRequestId(request) : undefined,
      error: this.serializeError(error),
      metadata: {
        errorName: error.name,
        stack: error.stack,
        ...(request && {
          method: request.method,
          path: new URL(request.url).pathname,
        }),
      },
    };

    this.processLogEntry(logEntry);
  }

  /**
   * Process log entry through the logging system
   */
  private static processLogEntry(logEntry: LogEntry): void {
    try {
      // Truncate large log entries
      if (JSON.stringify(logEntry).length > this.config.maxLogEntrySize) {
        logEntry.metadata = { ...logEntry.metadata, truncated: true };
        if (logEntry.error?.stack) {
          logEntry.error.stack = logEntry.error.stack.substring(0, 1000) + '... [truncated]';
        }
      }

      // Add to aggregator for analysis
      logAggregator.addLogEntry(logEntry);

      // Process through log manager for alerts
      logManager.processLogEntry(logEntry);

    } catch (processingError) {
      // Fallback to basic logging if processing fails
      logger.error('Failed to process log entry', {
        component: 'log-integration',
        operation: 'process_log_entry',
        metadata: { originalLogId: logEntry.id },
      }, processingError as Error);
    }
  }

  /**
   * Generate unique log ID
   */
  private static generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract request ID from headers
   */
  private static extractRequestId(request: RequestLike): string | undefined {
    return request.headers.get('x-request-id') || 
           request.headers.get('x-correlation-id') || 
           undefined;
  }

  /**
   * Extract client IP address
   */
  private static extractClientIP(request: RequestLike): string | undefined {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
           request.headers.get('x-real-ip') ||
           request.headers.get('cf-connecting-ip') ||
           undefined;
  }

  /**
   * Serialize error for logging
   */
  private static serializeError(error: Error): { name: string; message: string; stack?: string } {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  /**
   * Create a performance timer for operations
   */
  public static createTimer(operation: string, component?: string) {
    const startTime = Date.now();
    const logId = this.generateLogId();

    return {
      end: (metadata?: Record<string, any>) => {
        const duration = Date.now() - startTime;
        
        if (this.config.capturePerformance) {
          const logEntry: LogEntry = {
            id: logId,
            timestamp: new Date(),
            level: duration > 1000 ? 'WARN' : 'INFO',
            message: `Performance: ${operation} completed in ${duration}ms`,
            component: component || 'application',
            operation: 'performance_measurement',
            metadata: {
              operation,
              duration,
              ...metadata,
            },
          };

          this.processLogEntry(logEntry);
        }

        return duration;
      },
    };
  }

  /**
   * Log a business operation
   */
  public static logBusinessOperation(
    operation: string,
    entityType: string,
    entityId: string,
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.config.enableAutoCapture) return;

    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      level: 'INFO',
      message: `Business Operation: ${operation} on ${entityType}`,
      component: 'business',
      operation: 'business_operation',
      userId,
      metadata: {
        businessOperation: operation,
        entityType,
        entityId,
        ...metadata,
      },
    };

    this.processLogEntry(logEntry);
  }

  /**
   * Log a security event
   */
  public static logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    userId?: string,
    request?: RequestLike
  ): void {
    if (!this.config.enableAutoCapture) return;

    const level = severity === 'critical' || severity === 'high' ? 'ERROR' : 
                  severity === 'medium' ? 'WARN' : 'INFO';

    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      level,
      message: `Security Event: ${event}`,
      component: 'security',
      operation: 'security_event',
      userId,
      requestId: request ? this.extractRequestId(request) : undefined,
      metadata: {
        event,
        severity,
        ip: request ? this.extractClientIP(request) : undefined,
        userAgent: request?.headers.get('user-agent'),
        ...details,
      },
    };

    this.processLogEntry(logEntry);
  }

  /**
   * Log user activity
   */
  public static logUserActivity(
    userId: string,
    activity: string,
    details: Record<string, any> = {},
    request?: RequestLike
  ): void {
    if (!this.config.enableAutoCapture) return;

    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      level: 'INFO',
      message: `User Activity: ${activity}`,
      component: 'user',
      operation: 'user_activity',
      userId,
      requestId: request ? this.extractRequestId(request) : undefined,
      metadata: {
        activity,
        ip: request ? this.extractClientIP(request) : undefined,
        userAgent: request?.headers.get('user-agent'),
        ...details,
      },
    };

    this.processLogEntry(logEntry);
  }

  /**
   * Get integration statistics
   */
  public static getStatistics() {
    return {
      config: this.config,
      aggregatorStats: logAggregator.getStatistics(),
      managerConfig: logManager.getConfiguration(),
    };
  }
}

// Export convenience functions
export const withLogIntegration = LogIntegrationMiddleware.withLogIntegration;
export const createTimer = LogIntegrationMiddleware.createTimer;
export const logBusinessOperation = LogIntegrationMiddleware.logBusinessOperation;
export const logSecurityEvent = LogIntegrationMiddleware.logSecurityEvent;
export const logUserActivity = LogIntegrationMiddleware.logUserActivity;