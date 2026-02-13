/**
 * Logging System - Main Export
 * 
 * Centralized export for all logging functionality
 */

// Core logger
export { logger, ChildLogger, PerformanceTimer } from './logger';
export type { LogLevel, LogContext, LogEntry } from './logger';

// Application-specific logging
export { 
  ApplicationLogger,
  logApiRequest,
  logApiComplete,
  logApiError,
  logDbOperation,
  logDbComplete,
  logDbError,
  logAuth,
  logAuthz,
  logBusiness,
  logCache,
  logSecurity,
  logUser,
  logHealth,
  logFile,
  logEmail
} from './application-logger';

// API middleware
export { 
  ApiLoggingMiddleware,
  withApiLogging,
  logged
} from './api-logging-middleware';
export type { ApiLoggingConfig } from './api-logging-middleware';

// Configuration
export { 
  getLoggingConfig,
  validateLoggingConfig,
  loggingConfig
} from './config';
export type { LoggingConfig } from './config';

// Log Management
export { logManager } from './log-manager';
export type { 
  LogRotationConfig, 
  LogRetentionConfig, 
  LogAggregationConfig, 
  LogAlert,
  LogAlertCondition,
  LogAlertAction,
  LogMetrics
} from './log-manager';

// Log Aggregation
export { logAggregator } from './log-aggregator';
export type { 
  LogEntry as AggregatorLogEntry,
  LogSearchQuery,
  LogSearchResult,
  LogPattern,
  LogAnalysis
} from './log-aggregator';

// Convenience re-exports for common usage
import { logger } from './logger';
import { ApplicationLogger } from './application-logger';

// Default logger instance
export default logger;

// Convenience methods for quick access
export const log = {
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  info: logger.info.bind(logger),
  debug: logger.debug.bind(logger),
  trace: logger.trace.bind(logger),
  performance: logger.performance.bind(logger),
  timer: logger.time.bind(logger),
  child: logger.child.bind(logger),
};

// Application-specific convenience methods
export const appLog = {
  apiStart: ApplicationLogger.apiRequestStart,
  apiComplete: ApplicationLogger.apiRequestComplete,
  apiError: ApplicationLogger.apiRequestError,
  dbStart: ApplicationLogger.databaseOperationStart,
  dbComplete: ApplicationLogger.databaseOperationComplete,
  dbError: ApplicationLogger.databaseOperationError,
  auth: ApplicationLogger.authenticationAttempt,
  authz: ApplicationLogger.authorizationCheck,
  business: ApplicationLogger.businessOperation,
  cache: ApplicationLogger.cacheOperation,
  security: ApplicationLogger.securityEvent,
  user: ApplicationLogger.userActivity,
  health: ApplicationLogger.systemHealth,
  file: ApplicationLogger.fileOperation,
  email: ApplicationLogger.emailOperation,
  timer: ApplicationLogger.timer,
  child: ApplicationLogger.child,
};