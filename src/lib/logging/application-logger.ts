/**
 * Application-specific logging service
 * 
 * Provides domain-specific logging methods for common application operations
 * like API requests, database operations, authentication, etc.
 */

import { logger, LogContext } from './logger';

export class ApplicationLogger {
  /**
   * Log API request start
   */
  public static apiRequestStart(
    method: string,
    path: string,
    context: LogContext = {}
  ): void {
    logger.info(`API Request Started: ${method} ${path}`, {
      ...context,
      component: 'api',
      operation: 'request_start',
      metadata: {
        method,
        path,
      },
    });
  }

  /**
   * Log API request completion
   */
  public static apiRequestComplete(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context: LogContext = {}
  ): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    const message = `API Request Completed: ${method} ${path} - ${statusCode}`;
    
    const logContext = {
      ...context,
      component: 'api',
      operation: 'request_complete',
      metadata: {
        method,
        path,
        statusCode,
        duration,
      },
    };

    if (level === 'warn') {
      logger.warn(message, logContext);
    } else {
      logger.performance(message, duration, logContext);
    }
  }

  /**
   * Log API request error
   */
  public static apiRequestError(
    method: string,
    path: string,
    error: Error,
    context: LogContext = {}
  ): void {
    logger.error(`API Request Error: ${method} ${path}`, {
      ...context,
      component: 'api',
      operation: 'request_error',
      metadata: {
        method,
        path,
      },
    }, error);
  }

  /**
   * Log database operation start
   */
  public static databaseOperationStart(
    operation: string,
    table: string,
    context: LogContext = {}
  ): void {
    logger.debug(`Database Operation Started: ${operation} on ${table}`, {
      ...context,
      component: 'database',
      operation: 'db_operation_start',
      metadata: {
        dbOperation: operation,
        table,
      },
    });
  }

  /**
   * Log database operation completion
   */
  public static databaseOperationComplete(
    operation: string,
    table: string,
    duration: number,
    recordsAffected?: number,
    context: LogContext = {}
  ): void {
    logger.performance(`Database Operation Completed: ${operation} on ${table}`, duration, {
      ...context,
      component: 'database',
      operation: 'db_operation_complete',
      metadata: {
        dbOperation: operation,
        table,
        recordsAffected,
      },
    });
  }

  /**
   * Log database operation error
   */
  public static databaseOperationError(
    operation: string,
    table: string,
    error: Error,
    context: LogContext = {}
  ): void {
    logger.error(`Database Operation Error: ${operation} on ${table}`, {
      ...context,
      component: 'database',
      operation: 'db_operation_error',
      metadata: {
        dbOperation: operation,
        table,
      },
    }, error);
  }

  /**
   * Log authentication events
   */
  public static authenticationAttempt(
    email: string,
    success: boolean,
    context: LogContext = {}
  ): void {
    const message = `Authentication ${success ? 'Success' : 'Failed'}: ${email}`;
    const logContext = {
      ...context,
      component: 'auth',
      operation: 'authentication',
      metadata: {
        email,
        success,
      },
    };

    if (success) {
      logger.info(message, logContext);
    } else {
      logger.warn(message, logContext);
    }
  }

  /**
   * Log authorization events
   */
  public static authorizationCheck(
    userId: string,
    resource: string,
    action: string,
    allowed: boolean,
    context: LogContext = {}
  ): void {
    const message = `Authorization ${allowed ? 'Granted' : 'Denied'}: ${action} on ${resource}`;
    const logContext = {
      ...context,
      userId,
      component: 'auth',
      operation: 'authorization',
      metadata: {
        resource,
        action,
        allowed,
      },
    };

    if (allowed) {
      logger.debug(message, logContext);
    } else {
      logger.warn(message, logContext);
    }
  }

  /**
   * Log business logic operations
   */
  public static businessOperation(
    operation: string,
    entityType: string,
    entityId: string,
    context: LogContext = {}
  ): void {
    logger.info(`Business Operation: ${operation} on ${entityType}`, {
      ...context,
      component: 'business',
      operation: 'business_operation',
      metadata: {
        businessOperation: operation,
        entityType,
        entityId,
      },
    });
  }

  /**
   * Log cache operations
   */
  public static cacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete' | 'clear',
    key: string,
    context: LogContext = {}
  ): void {
    logger.debug(`Cache ${operation.toUpperCase()}: ${key}`, {
      ...context,
      component: 'cache',
      operation: 'cache_operation',
      metadata: {
        cacheOperation: operation,
        key,
      },
    });
  }

  /**
   * Log security events
   */
  public static securityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    context: LogContext = {}
  ): void {
    const message = `Security Event: ${event}`;
    const logContext = {
      ...context,
      component: 'security',
      operation: 'security_event',
      metadata: {
        event,
        severity,
        ...details,
      },
    };

    switch (severity) {
      case 'critical':
      case 'high':
        logger.error(message, logContext);
        break;
      case 'medium':
        logger.warn(message, logContext);
        break;
      case 'low':
      default:
        logger.info(message, logContext);
        break;
    }
  }

  /**
   * Log user activity
   */
  public static userActivity(
    userId: string,
    activity: string,
    details: Record<string, any> = {},
    context: LogContext = {}
  ): void {
    logger.info(`User Activity: ${activity}`, {
      ...context,
      userId,
      component: 'user',
      operation: 'user_activity',
      metadata: {
        activity,
        ...details,
      },
    });
  }

  /**
   * Log system health events
   */
  public static systemHealth(
    component: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    metrics: Record<string, any> = {},
    context: LogContext = {}
  ): void {
    const message = `System Health: ${component} is ${status}`;
    const logContext = {
      ...context,
      component: 'system',
      operation: 'health_check',
      metadata: {
        healthComponent: component,
        status,
        ...metrics,
      },
    };

    switch (status) {
      case 'unhealthy':
        logger.error(message, logContext);
        break;
      case 'degraded':
        logger.warn(message, logContext);
        break;
      case 'healthy':
      default:
        logger.info(message, logContext);
        break;
    }
  }

  /**
   * Log file operations
   */
  public static fileOperation(
    operation: 'upload' | 'download' | 'delete' | 'read' | 'write',
    filename: string,
    size?: number,
    context: LogContext = {}
  ): void {
    logger.info(`File Operation: ${operation} - ${filename}`, {
      ...context,
      component: 'file',
      operation: 'file_operation',
      metadata: {
        fileOperation: operation,
        filename,
        size,
      },
    });
  }

  /**
   * Log email operations
   */
  public static emailOperation(
    operation: 'send' | 'receive' | 'bounce' | 'delivery_failure',
    recipient: string,
    subject: string,
    context: LogContext = {}
  ): void {
    const message = `Email ${operation}: ${subject} to ${recipient}`;
    const logContext = {
      ...context,
      component: 'email',
      operation: 'email_operation',
      metadata: {
        emailOperation: operation,
        recipient,
        subject,
      },
    };

    if (operation === 'bounce' || operation === 'delivery_failure') {
      logger.warn(message, logContext);
    } else {
      logger.info(message, logContext);
    }
  }

  /**
   * Create a timer for measuring operation performance
   */
  public static timer(operation: string, context: LogContext = {}) {
    return logger.time(operation, context);
  }

  /**
   * Create a child logger with specific context
   */
  public static child(context: LogContext) {
    return logger.child(context);
  }
}

// Export convenience methods
export const logApiRequest = ApplicationLogger.apiRequestStart;
export const logApiComplete = ApplicationLogger.apiRequestComplete;
export const logApiError = ApplicationLogger.apiRequestError;
export const logDbOperation = ApplicationLogger.databaseOperationStart;
export const logDbComplete = ApplicationLogger.databaseOperationComplete;
export const logDbError = ApplicationLogger.databaseOperationError;
export const logAuth = ApplicationLogger.authenticationAttempt;
export const logAuthz = ApplicationLogger.authorizationCheck;
export const logBusiness = ApplicationLogger.businessOperation;
export const logCache = ApplicationLogger.cacheOperation;
export const logSecurity = ApplicationLogger.securityEvent;
export const logUser = ApplicationLogger.userActivity;
export const logHealth = ApplicationLogger.systemHealth;
export const logFile = ApplicationLogger.fileOperation;
export const logEmail = ApplicationLogger.emailOperation;