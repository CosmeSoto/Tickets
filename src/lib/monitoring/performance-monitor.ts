/**
 * Performance Monitoring System
 * 
 * Comprehensive performance tracking for APIs, database queries, and user interactions
 */

import { ApplicationLogger } from '@/lib/logging'
import { ErrorTracker, ErrorType, ErrorSeverity } from './error-tracker'

export interface PerformanceMetric {
  id: string
  name: string
  type: MetricType
  value: number
  unit: MetricUnit
  timestamp: Date
  context: PerformanceContext
  tags: string[]
}

export interface PerformanceContext {
  component?: string
  operation?: string
  userId?: string
  sessionId?: string
  endpoint?: string
  method?: string
  statusCode?: number
  userAgent?: string
  ip?: string
  metadata?: Record<string, any>
}

export enum MetricType {
  RESPONSE_TIME = 'response_time',
  DATABASE_QUERY = 'database_query',
  CACHE_HIT_RATE = 'cache_hit_rate',
  MEMORY_USAGE = 'memory_usage',
  CPU_USAGE = 'cpu_usage',
  THROUGHPUT = 'throughput',
  ERROR_RATE = 'error_rate',
  USER_INTERACTION = 'user_interaction',
  EXTERNAL_SERVICE = 'external_service',
  CUSTOM = 'custom'
}

export enum MetricUnit {
  MILLISECONDS = 'ms',
  SECONDS = 's',
  PERCENTAGE = '%',
  BYTES = 'bytes',
  MEGABYTES = 'mb',
  COUNT = 'count',
  REQUESTS_PER_SECOND = 'rps'
}

export interface PerformanceThresholds {
  [MetricType.RESPONSE_TIME]: { warning: number; critical: number }
  [MetricType.DATABASE_QUERY]: { warning: number; critical: number }
  [MetricType.CACHE_HIT_RATE]: { warning: number; critical: number }
  [MetricType.MEMORY_USAGE]: { warning: number; critical: number }
  [MetricType.ERROR_RATE]: { warning: number; critical: number }
}
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  [MetricType.RESPONSE_TIME]: { warning: 1000, critical: 3000 }, // ms
  [MetricType.DATABASE_QUERY]: { warning: 500, critical: 2000 }, // ms
  [MetricType.CACHE_HIT_RATE]: { warning: 80, critical: 60 }, // %
  [MetricType.MEMORY_USAGE]: { warning: 80, critical: 95 }, // %
  [MetricType.ERROR_RATE]: { warning: 5, critical: 10 } // %
}

export interface PerformanceConfig {
  enabled: boolean
  sampleRate: number
  enableRealTimeMonitoring: boolean
  enableAggregation: boolean
  aggregationInterval: number // minutes
  retentionPeriod: number // days
  thresholds: PerformanceThresholds
  alerting: {
    enabled: boolean
    webhookUrl?: string
    emailRecipients?: string[]
  }
}

const DEFAULT_CONFIG: PerformanceConfig = {
  enabled: process.env.PERFORMANCE_MONITORING_ENABLED !== 'false',
  sampleRate: parseFloat(process.env.PERFORMANCE_SAMPLE_RATE || '1.0'),
  enableRealTimeMonitoring: true,
  enableAggregation: true,
  aggregationInterval: 5, // 5 minutes
  retentionPeriod: 30, // 30 days
  thresholds: DEFAULT_THRESHOLDS,
  alerting: {
    enabled: process.env.PERFORMANCE_ALERTING_ENABLED === 'true',
    webhookUrl: process.env.PERFORMANCE_WEBHOOK_URL,
    emailRecipients: process.env.PERFORMANCE_EMAIL_RECIPIENTS?.split(',')
  }
}

export class PerformanceMonitor {
  private static config: PerformanceConfig = DEFAULT_CONFIG
  private static metrics = new Map<string, PerformanceMetric[]>()
  private static aggregatedMetrics = new Map<string, any>()
  private static timers = new Map<string, { start: number; context: PerformanceContext }>()

  /**
   * Initialize performance monitoring
   */
  static initialize(config?: Partial<PerformanceConfig>): void {
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    if (this.config.enabled) {
      this.setupPerformanceObservers()
      this.startAggregationTimer()
      
      ApplicationLogger.businessOperation('initialize_performance_monitoring', 'performance-monitor', 'system', {
        metadata: { 
          sampleRate: this.config.sampleRate,
          realTimeEnabled: this.config.enableRealTimeMonitoring,
          aggregationEnabled: this.config.enableAggregation
        }
      })
    }
  }
  /**
   * Start a performance timer
   */
  static startTimer(name: string, context: PerformanceContext = {}): string {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      return ''
    }

    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    this.timers.set(timerId, {
      start: performance.now(),
      context
    })

    return timerId
  }

  /**
   * End a performance timer and record metric
   */
  static endTimer(timerId: string, type: MetricType = MetricType.RESPONSE_TIME): number {
    if (!timerId || !this.timers.has(timerId)) {
      return 0
    }

    const timer = this.timers.get(timerId)!
    const duration = performance.now() - timer.start
    this.timers.delete(timerId)

    // Record the metric
    this.recordMetric({
      name: timerId.split('_')[0],
      type,
      value: duration,
      unit: MetricUnit.MILLISECONDS,
      context: timer.context
    })

    return duration
  }

  /**
   * Record a performance metric
   */
  static recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp' | 'tags'>): void {
    if (!this.config.enabled) return

    const fullMetric: PerformanceMetric = {
      id: this.generateMetricId(),
      timestamp: new Date(),
      tags: this.generateTags(metric),
      ...metric
    }

    // Store metric
    const key = `${metric.type}_${metric.name}`
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    this.metrics.get(key)!.push(fullMetric)

    // Check thresholds and alert if needed
    this.checkThresholds(fullMetric)

    // Log metric
    ApplicationLogger.businessOperation('record_performance_metric', 'performance-monitor', 'metric', {
      metadata: {
        name: metric.name,
        type: metric.type,
        value: metric.value,
        unit: metric.unit,
        component: metric.context.component
      }
    })
  }

  /**
   * Track API endpoint performance
   */
  static trackAPIPerformance(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number,
    context: PerformanceContext = {}
  ): void {
    this.recordMetric({
      name: `${method}_${endpoint}`,
      type: MetricType.RESPONSE_TIME,
      value: duration,
      unit: MetricUnit.MILLISECONDS,
      context: {
        ...context,
        endpoint,
        method,
        statusCode,
        component: 'api'
      }
    })

    // Track error rate if status indicates error
    if (statusCode >= 400) {
      this.recordMetric({
        name: `${method}_${endpoint}_errors`,
        type: MetricType.ERROR_RATE,
        value: 1,
        unit: MetricUnit.COUNT,
        context: { ...context, endpoint, method, statusCode }
      })
    }
  }
  /**
   * Track database query performance
   */
  static trackDatabasePerformance(
    operation: string,
    duration: number,
    query?: string,
    context: PerformanceContext = {}
  ): void {
    this.recordMetric({
      name: `db_${operation}`,
      type: MetricType.DATABASE_QUERY,
      value: duration,
      unit: MetricUnit.MILLISECONDS,
      context: {
        ...context,
        operation,
        component: 'database',
        metadata: {
          query: query?.substring(0, 200), // Limit query length
          ...context.metadata
        }
      }
    })
  }

  /**
   * Track cache performance
   */
  static trackCachePerformance(
    operation: 'hit' | 'miss' | 'set' | 'delete',
    key: string,
    duration?: number,
    context: PerformanceContext = {}
  ): void {
    // Track cache hit rate
    this.recordMetric({
      name: `cache_${operation}`,
      type: MetricType.CACHE_HIT_RATE,
      value: operation === 'hit' ? 1 : 0,
      unit: MetricUnit.COUNT,
      context: {
        ...context,
        operation,
        component: 'cache',
        metadata: { key: key.substring(0, 50), ...context.metadata }
      }
    })

    // Track cache operation duration if provided
    if (duration !== undefined) {
      this.recordMetric({
        name: `cache_${operation}_duration`,
        type: MetricType.RESPONSE_TIME,
        value: duration,
        unit: MetricUnit.MILLISECONDS,
        context: { ...context, operation, component: 'cache' }
      })
    }
  }

  /**
   * Track system resource usage
   */
  static trackSystemResources(): void {
    if (typeof process !== 'undefined') {
      const memUsage = process.memoryUsage()
      const cpuUsage = process.cpuUsage()

      // Memory usage
      this.recordMetric({
        name: 'system_memory',
        type: MetricType.MEMORY_USAGE,
        value: memUsage.heapUsed,
        unit: MetricUnit.BYTES,
        context: {
          component: 'system',
          metadata: {
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external,
            rss: memUsage.rss
          }
        }
      })

      // CPU usage (simplified)
      this.recordMetric({
        name: 'system_cpu',
        type: MetricType.CPU_USAGE,
        value: cpuUsage.user + cpuUsage.system,
        unit: MetricUnit.COUNT,
        context: {
          component: 'system',
          metadata: { user: cpuUsage.user, system: cpuUsage.system }
        }
      })
    }
  }

  /**
   * Track user interaction performance
   */
  static trackUserInteraction(
    action: string,
    duration: number,
    context: PerformanceContext = {}
  ): void {
    this.recordMetric({
      name: `user_${action}`,
      type: MetricType.USER_INTERACTION,
      value: duration,
      unit: MetricUnit.MILLISECONDS,
      context: {
        ...context,
        operation: action,
        component: 'frontend'
      }
    })
  }
  /**
   * Get performance statistics
   */
  static getPerformanceStats(timeRange?: { start: Date; end: Date }): {
    summary: Record<string, any>
    metrics: Record<string, PerformanceMetric[]>
    aggregated: Record<string, any>
    alerts: any[]
  } {
    const now = new Date()
    const start = timeRange?.start || new Date(now.getTime() - 24 * 60 * 60 * 1000) // Last 24h
    const end = timeRange?.end || now

    const filteredMetrics: Record<string, PerformanceMetric[]> = {}
    const summary: Record<string, any> = {}
    const alerts: any[] = []

    // Filter metrics by time range
    for (const [key, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => 
        m.timestamp >= start && m.timestamp <= end
      )
      
      if (filtered.length > 0) {
        filteredMetrics[key] = filtered
        
        // Calculate summary statistics
        const values = filtered.map(m => m.value)
        summary[key] = {
          count: values.length,
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          p95: this.calculatePercentile(values, 95),
          p99: this.calculatePercentile(values, 99)
        }

        // Check for threshold violations
        const latestMetric = filtered[filtered.length - 1]
        const threshold = this.getThresholdForMetric(latestMetric.type)
        if (threshold && latestMetric.value > threshold.critical) {
          alerts.push({
            type: 'critical',
            metric: key,
            value: latestMetric.value,
            threshold: threshold.critical,
            timestamp: latestMetric.timestamp
          })
        }
      }
    }

    return {
      summary,
      metrics: filteredMetrics,
      aggregated: Object.fromEntries(this.aggregatedMetrics),
      alerts
    }
  }

  /**
   * Clear old metrics
   */
  static clearOldMetrics(olderThanDays: number = 30): number {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
    let clearedCount = 0

    for (const [key, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoffDate)
      const removedCount = metrics.length - filtered.length
      
      if (removedCount > 0) {
        this.metrics.set(key, filtered)
        clearedCount += removedCount
      }
    }

    ApplicationLogger.businessOperation('clear_old_metrics', 'performance-monitor', 'maintenance', {
      metadata: { clearedCount, olderThanDays }
    })

    return clearedCount
  }

  // Private helper methods
  private static setupPerformanceObservers(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // Observe navigation timing
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming
            this.recordMetric({
              name: 'page_load',
              type: MetricType.RESPONSE_TIME,
              value: navEntry.loadEventEnd - navEntry.fetchStart,
              unit: MetricUnit.MILLISECONDS,
              context: { component: 'navigation' }
            })
          }
        }
      })
      navObserver.observe({ entryTypes: ['navigation'] })

      // Observe resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming
            this.recordMetric({
              name: 'resource_load',
              type: MetricType.RESPONSE_TIME,
              value: resourceEntry.responseEnd - resourceEntry.requestStart,
              unit: MetricUnit.MILLISECONDS,
              context: {
                component: 'resource',
                metadata: {
                  name: resourceEntry.name,
                  type: resourceEntry.initiatorType
                }
              }
            })
          }
        }
      })
      resourceObserver.observe({ entryTypes: ['resource'] })
    }
  }
  private static startAggregationTimer(): void {
    if (!this.config.enableAggregation) return

    setInterval(() => {
      this.aggregateMetrics()
    }, this.config.aggregationInterval * 60 * 1000)
  }

  private static aggregateMetrics(): void {
    const now = new Date()
    const intervalStart = new Date(now.getTime() - this.config.aggregationInterval * 60 * 1000)

    for (const [key, metrics] of this.metrics.entries()) {
      const recentMetrics = metrics.filter(m => m.timestamp >= intervalStart)
      
      if (recentMetrics.length > 0) {
        const values = recentMetrics.map(m => m.value)
        const aggregated = {
          timestamp: now,
          count: values.length,
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          sum: values.reduce((a, b) => a + b, 0)
        }

        const aggKey = `${key}_${Math.floor(now.getTime() / (this.config.aggregationInterval * 60 * 1000))}`
        this.aggregatedMetrics.set(aggKey, aggregated)
      }
    }
  }

  private static checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.getThresholdForMetric(metric.type)
    if (!threshold) return

    let alertLevel: 'warning' | 'critical' | null = null
    
    if (metric.value > threshold.critical) {
      alertLevel = 'critical'
    } else if (metric.value > threshold.warning) {
      alertLevel = 'warning'
    }

    if (alertLevel) {
      this.sendPerformanceAlert(metric, alertLevel, threshold)
    }
  }

  private static async sendPerformanceAlert(
    metric: PerformanceMetric,
    level: 'warning' | 'critical',
    threshold: { warning: number; critical: number }
  ): Promise<void> {
    if (!this.config.alerting.enabled) return

    // Track as error for critical performance issues
    if (level === 'critical') {
      await ErrorTracker.trackError(
        new Error(`Performance threshold exceeded: ${metric.name}`),
        {
          component: 'performance-monitor',
          operation: metric.name,
          metadata: {
            metricType: metric.type,
            value: metric.value,
            threshold: threshold.critical,
            unit: metric.unit
          }
        },
        ErrorType.SYSTEM,
        ErrorSeverity.HIGH
      )
    }

    ApplicationLogger.systemHealth('performance-monitor', level === 'critical' ? 'unhealthy' : 'degraded', {
      metric: metric.name,
      type: metric.type,
      value: metric.value,
      threshold: level === 'critical' ? threshold.critical : threshold.warning,
      level
    })
  }

  private static getThresholdForMetric(type: MetricType): { warning: number; critical: number } | null {
    return this.config.thresholds[type as keyof PerformanceThresholds] || null
  }

  private static calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }

  private static generateMetricId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  }

  private static generateTags(metric: Omit<PerformanceMetric, 'id' | 'timestamp' | 'tags'>): string[] {
    const tags: string[] = [
      `type:${metric.type}`,
      `unit:${metric.unit}`
    ]

    if (metric.context.component) {
      tags.push(`component:${metric.context.component}`)
    }

    if (metric.context.operation) {
      tags.push(`operation:${metric.context.operation}`)
    }

    if (metric.context.endpoint) {
      tags.push(`endpoint:${metric.context.endpoint}`)
    }

    return tags
  }

  /**
   * Get current configuration
   */
  static getConfig(): PerformanceConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  static updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    ApplicationLogger.businessOperation('config_updated', 'performance-monitor', 'config', {
      metadata: { updatedFields: Object.keys(newConfig) }
    })
  }
}