/**
 * Monitoring System - Main Export
 * 
 * Centralized exports for error tracking, performance monitoring, and system observability
 */

// Internal imports for initialization
import { ErrorTracker } from './error-tracker'
import { PerformanceMonitor } from './performance-monitor'
import { HealthChecker } from './health-checker'
import { ErrorMiddleware } from './error-middleware'
import { PerformanceMiddleware } from './performance-middleware'

// Error tracking
export { ErrorTracker, ErrorType, ErrorSeverity } from './error-tracker'
export type { ErrorContext, ErrorReport, ErrorTrackingConfig } from './error-tracker'

// Error middleware
export { ErrorMiddleware, withErrorTracking, trackErrors, captureError, createErrorTrackingMiddleware } from './error-middleware'
export type { ErrorMiddlewareConfig } from './error-middleware'

// Performance monitoring
export { PerformanceMonitor, MetricType, MetricUnit } from './performance-monitor'
export type { PerformanceMetric, PerformanceContext, PerformanceConfig, PerformanceThresholds } from './performance-monitor'

// Performance middleware
export { PerformanceMiddleware, withPerformanceTracking, trackPerformance, createPerformanceMiddleware } from './performance-middleware'
export type { PerformanceMiddlewareConfig } from './performance-middleware'

// Health checking
export { HealthChecker, HealthStatus } from './health-checker'
export type { HealthCheck, HealthCheckConfig, SystemHealth } from './health-checker'

/**
 * Initialize complete monitoring system
 */
export function initializeMonitoring(config?: {
  errorTracking?: Partial<import('./error-tracker').ErrorTrackingConfig>
  errorMiddleware?: Partial<import('./error-middleware').ErrorMiddlewareConfig>
  performanceMonitoring?: Partial<import('./performance-monitor').PerformanceConfig>
  performanceMiddleware?: Partial<import('./performance-middleware').PerformanceMiddlewareConfig>
  healthChecking?: Partial<import('./health-checker').HealthCheckConfig>
}) {
  // Initialize error tracking
  ErrorTracker.initialize(config?.errorTracking)
  
  // Initialize performance monitoring
  PerformanceMonitor.initialize(config?.performanceMonitoring)
  
  // Initialize health checking
  HealthChecker.initialize(config?.healthChecking)
  
  // Setup global error handlers
  ErrorMiddleware.setupGlobalErrorHandler()
  
  return {
    errorTracker: ErrorTracker,
    errorMiddleware: ErrorMiddleware,
    performanceMonitor: PerformanceMonitor,
    performanceMiddleware: PerformanceMiddleware,
    healthChecker: HealthChecker
  }
}

/**
 * Get monitoring system status
 */
export function getMonitoringStatus() {
  const errorConfig = ErrorTracker.getConfig()
  const errorStats = ErrorTracker.getErrorStats()
  const performanceConfig = PerformanceMonitor.getConfig()
  const performanceStats = PerformanceMonitor.getPerformanceStats()
  const healthConfig = HealthChecker.getConfig()
  const healthStatus = HealthChecker.getSystemHealth()
  
  return {
    errorTracking: {
      enabled: errorConfig.enabled,
      environment: errorConfig.environment,
      version: errorConfig.version,
      alertingEnabled: errorConfig.alerting.enabled,
      totalErrors: errorStats.totalErrors,
      recentErrorsCount: errorStats.recentErrors.length
    },
    performanceMonitoring: {
      enabled: performanceConfig.enabled,
      sampleRate: performanceConfig.sampleRate,
      realTimeEnabled: performanceConfig.enableRealTimeMonitoring,
      aggregationEnabled: performanceConfig.enableAggregation,
      alertingEnabled: performanceConfig.alerting.enabled,
      metricsCount: Object.keys(performanceStats.metrics).length,
      alertsCount: performanceStats.alerts.length
    },
    healthChecking: {
      enabled: healthConfig.enabled,
      checkInterval: healthConfig.checkInterval,
      overallStatus: healthStatus.overall,
      healthyComponents: healthStatus.summary.healthy,
      degradedComponents: healthStatus.summary.degraded,
      unhealthyComponents: healthStatus.summary.unhealthy,
      totalComponents: healthStatus.summary.total,
      uptime: healthStatus.uptime
    },
    lastUpdated: new Date().toISOString()
  }
}