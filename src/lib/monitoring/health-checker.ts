/**
 * Health Check System
 * 
 * Comprehensive health monitoring for all system components
 */

import { ApplicationLogger } from '@/lib/logging'
import { PerformanceMonitor, MetricType, MetricUnit } from './performance-monitor'
import { ErrorTracker, ErrorType, ErrorSeverity } from './error-tracker'

export interface HealthCheck {
  name: string
  component: string
  status: HealthStatus
  responseTime: number
  timestamp: Date
  message?: string
  metadata?: Record<string, any>
  dependencies?: string[]
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

export interface HealthCheckConfig {
  enabled: boolean
  checkInterval: number // seconds
  timeout: number // milliseconds
  retryAttempts: number
  retryDelay: number // milliseconds
  enableDependencyChecks: boolean
  enablePerformanceTracking: boolean
  alertOnFailure: boolean
  checks: {
    database: boolean
    redis: boolean
    externalServices: boolean
    filesystem: boolean
    memory: boolean
    disk: boolean
  }
}

export interface SystemHealth {
  overall: HealthStatus
  components: Record<string, HealthCheck>
  summary: {
    healthy: number
    degraded: number
    unhealthy: number
    unknown: number
    total: number
  }
  lastCheck: Date
  uptime: number
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  enabled: true,
  checkInterval: 30, // 30 seconds
  timeout: 5000, // 5 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  enableDependencyChecks: true,
  enablePerformanceTracking: true,
  alertOnFailure: true,
  checks: {
    database: true,
    redis: true,
    externalServices: true,
    filesystem: true,
    memory: true,
    disk: true
  }
}

export class HealthChecker {
  private static config: HealthCheckConfig = DEFAULT_CONFIG
  private static healthChecks = new Map<string, HealthCheck>()
  private static checkInterval?: NodeJS.Timeout
  private static startTime = Date.now()
  private static customChecks = new Map<string, () => Promise<HealthCheck>>()

  /**
   * Initialize health checking system
   */
  static initialize(config?: Partial<HealthCheckConfig>): void {
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    if (this.config.enabled) {
      this.startHealthChecks()
      
      ApplicationLogger.businessOperation('initialize_health_checker', 'health-checker', 'system', {
        metadata: { 
          checkInterval: this.config.checkInterval,
          enabledChecks: Object.entries(this.config.checks)
            .filter(([_, enabled]) => enabled)
            .map(([check]) => check)
        }
      })
    }
  }

  /**
   * Register a custom health check
   */
  static registerCheck(
    name: string,
    component: string,
    checkFunction: () => Promise<HealthCheck>
  ): void {
    this.customChecks.set(`${component}_${name}`, checkFunction)
    
    ApplicationLogger.businessOperation('register_health_check', 'health-checker', 'config', {
      metadata: { name, component }
    })
  }

  /**
   * Perform all health checks
   */
  static async performHealthChecks(): Promise<SystemHealth> {
    const timer = ApplicationLogger.timer('perform_health_checks', {
      component: 'health-checker'
    })

    try {
      const checks: HealthCheck[] = []

      // Built-in health checks
      if (this.config.checks.database) {
        checks.push(await this.checkDatabase())
      }

      if (this.config.checks.redis) {
        checks.push(await this.checkRedis())
      }

      if (this.config.checks.filesystem) {
        checks.push(await this.checkFilesystem())
      }

      if (this.config.checks.memory) {
        checks.push(await this.checkMemory())
      }

      if (this.config.checks.disk) {
        checks.push(await this.checkDisk())
      }

      if (this.config.checks.externalServices) {
        const externalChecks = await this.checkExternalServices()
        checks.push(...externalChecks)
      }

      // Custom health checks
      for (const [key, checkFunction] of this.customChecks.entries()) {
        try {
          const customCheck = await this.executeWithTimeout(checkFunction)
          checks.push(customCheck)
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error))
          checks.push({
            name: key,
            component: 'custom',
            status: HealthStatus.UNHEALTHY,
            responseTime: 0,
            timestamp: new Date(),
            message: `Custom check failed: ${err.message}`
          })
        }
      }

      // Update health check storage
      for (const check of checks) {
        this.healthChecks.set(`${check.component}_${check.name}`, check)
        
        // Track performance if enabled
        if (this.config.enablePerformanceTracking) {
          PerformanceMonitor.recordMetric({
            name: `health_check_${check.component}_${check.name}`,
            type: MetricType.RESPONSE_TIME,
            value: check.responseTime,
            unit: MetricUnit.MILLISECONDS,
            context: {
              component: 'health-checker',
              operation: 'health_check',
              metadata: {
                status: check.status,
                checkName: check.name,
                checkComponent: check.component
              }
            }
          })
        }
      }

      const systemHealth = this.calculateSystemHealth(checks)
      
      // Alert on failures if enabled
      if (this.config.alertOnFailure) {
        await this.handleHealthAlerts(checks)
      }

      timer.end('Health checks completed successfully')
      return systemHealth

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      ApplicationLogger.systemHealth('health-checker', 'unhealthy', {
        error: err.message,
        operation: 'perform_health_checks'
      })
      timer.end('Health checks failed')
      throw error
    }
  }
  /**
   * Get current system health
   */
  static getSystemHealth(): SystemHealth {
    const checks = Array.from(this.healthChecks.values())
    return this.calculateSystemHealth(checks)
  }

  /**
   * Get health check for specific component
   */
  static getComponentHealth(component: string): HealthCheck[] {
    return Array.from(this.healthChecks.values())
      .filter(check => check.component === component)
  }

  /**
   * Check database connectivity and performance
   */
  private static async checkDatabase(): Promise<HealthCheck> {
    const startTime = performance.now()

    try {
      // Usar el singleton centralizado en lugar de crear una instancia nueva
      const { db } = await import('@/lib/server')

      await db.$queryRaw`SELECT 1`

      const connectionInfo = await db.$queryRaw`
        SELECT
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      ` as any[]

      const responseTime = performance.now() - startTime

      return {
        name: 'connectivity',
        component: 'database',
        status: responseTime < 1000 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        responseTime,
        timestamp: new Date(),
        message: 'Database connection successful',
        metadata: {
          totalConnections: connectionInfo[0]?.total_connections || 0,
          activeConnections: connectionInfo[0]?.active_connections || 0,
        },
      }
    } catch (error) {
      const responseTime = performance.now() - startTime
      const err = error instanceof Error ? error : new Error(String(error))

      return {
        name: 'connectivity',
        component: 'database',
        status: HealthStatus.UNHEALTHY,
        responseTime,
        timestamp: new Date(),
        message: `Database check failed: ${err.message}`,
      }
    }
  }

  /**
   * Check Redis connectivity and performance
   */
  private static async checkRedis(): Promise<HealthCheck> {
    const startTime = performance.now()
    
    try {
      // Import Redis client dynamically
      const { createClient } = await import('redis')
      const client = createClient({
        url: process.env.REDIS_URL
      })
      
      await client.connect()
      
      // Test basic operations
      const testKey = `health_check_${Date.now()}`
      await client.set(testKey, 'test_value', { EX: 10 })
      const value = await client.get(testKey)
      await client.del(testKey)
      
      // Get Redis info
      const info = await client.info('memory')
      const memoryMatch = info.match(/used_memory:(\d+)/)
      const usedMemory = memoryMatch ? parseInt(memoryMatch[1]) : 0
      
      await client.disconnect()
      
      const responseTime = performance.now() - startTime
      
      return {
        name: 'connectivity',
        component: 'redis',
        status: responseTime < 500 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        responseTime,
        timestamp: new Date(),
        message: 'Redis connection successful',
        metadata: {
          usedMemory,
          testResult: value === 'test_value'
        }
      }

    } catch (error) {
      const responseTime = performance.now() - startTime
      const err = error instanceof Error ? error : new Error(String(error))
      
      return {
        name: 'connectivity',
        component: 'redis',
        status: HealthStatus.UNHEALTHY,
        responseTime,
        timestamp: new Date(),
        message: `Redis check failed: ${err.message}`
      }
    }
  }

  /**
   * Check filesystem health
   */
  private static async checkFilesystem(): Promise<HealthCheck> {
    const startTime = performance.now()
    
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      
      // Test write/read/delete operations
      const testDir = path.join(process.cwd(), 'temp')
      const testFile = path.join(testDir, `health_check_${Date.now()}.txt`)
      const testContent = 'health check test'
      
      // Ensure temp directory exists
      try {
        await fs.mkdir(testDir, { recursive: true })
      } catch (error) {
        // Directory might already exist
      }
      
      // Write test file
      await fs.writeFile(testFile, testContent)
      
      // Read test file
      const readContent = await fs.readFile(testFile, 'utf-8')
      
      // Delete test file
      await fs.unlink(testFile)
      
      const responseTime = performance.now() - startTime
      
      return {
        name: 'operations',
        component: 'filesystem',
        status: HealthStatus.HEALTHY,
        responseTime,
        timestamp: new Date(),
        message: 'Filesystem operations successful',
        metadata: {
          testPassed: readContent === testContent,
          testDir,
          operationsCount: 3
        }
      }

    } catch (error) {
      const responseTime = performance.now() - startTime
      const err = error instanceof Error ? error : new Error(String(error))
      
      return {
        name: 'operations',
        component: 'filesystem',
        status: HealthStatus.UNHEALTHY,
        responseTime,
        timestamp: new Date(),
        message: `Filesystem check failed: ${err.message}`
      }
    }
  }

  /**
   * Check memory usage
   */
  private static async checkMemory(): Promise<HealthCheck> {
    const startTime = performance.now()
    
    try {
      const memUsage = process.memoryUsage()
      const totalMemory = memUsage.heapTotal
      const usedMemory = memUsage.heapUsed
      const memoryUsagePercent = (usedMemory / totalMemory) * 100
      
      let status = HealthStatus.HEALTHY
      if (memoryUsagePercent > 90) {
        status = HealthStatus.UNHEALTHY
      } else if (memoryUsagePercent > 75) {
        status = HealthStatus.DEGRADED
      }
      
      const responseTime = performance.now() - startTime
      
      return {
        name: 'usage',
        component: 'memory',
        status,
        responseTime,
        timestamp: new Date(),
        message: `Memory usage: ${memoryUsagePercent.toFixed(2)}%`,
        metadata: {
          heapUsed: usedMemory,
          heapTotal: totalMemory,
          external: memUsage.external,
          rss: memUsage.rss,
          usagePercent: memoryUsagePercent
        }
      }

    } catch (error) {
      const responseTime = performance.now() - startTime
      const err = error instanceof Error ? error : new Error(String(error))
      
      return {
        name: 'usage',
        component: 'memory',
        status: HealthStatus.UNHEALTHY,
        responseTime,
        timestamp: new Date(),
        message: `Memory check failed: ${err.message}`
      }
    }
  }

  /**
   * Check disk usage
   */
  private static async checkDisk(): Promise<HealthCheck> {
    const startTime = performance.now()
    
    try {
      const fs = await import('fs/promises')
      const path = process.cwd()
      
      // Get disk stats
      const stats = await fs.stat(path)
      
      // For a more comprehensive disk check, we'd use statvfs on Unix systems
      // For now, we'll do a basic check
      const responseTime = performance.now() - startTime
      
      return {
        name: 'usage',
        component: 'disk',
        status: HealthStatus.HEALTHY,
        responseTime,
        timestamp: new Date(),
        message: 'Disk access successful',
        metadata: {
          path,
          accessible: true,
          lastModified: stats.mtime
        }
      }

    } catch (error) {
      const responseTime = performance.now() - startTime
      const err = error instanceof Error ? error : new Error(String(error))
      
      return {
        name: 'usage',
        component: 'disk',
        status: HealthStatus.UNHEALTHY,
        responseTime,
        timestamp: new Date(),
        message: `Disk check failed: ${err.message}`
      }
    }
  }
  /**
   * Check external services
   */
  private static async checkExternalServices(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = []
    
    // Define external services to check
    const services = [
      { name: 'google_dns', url: 'https://8.8.8.8', timeout: 3000 },
      { name: 'cloudflare_dns', url: 'https://1.1.1.1', timeout: 3000 }
    ]

    for (const service of services) {
      const startTime = performance.now()
      
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), service.timeout)
        
        const response = await fetch(service.url, {
          signal: controller.signal,
          method: 'HEAD'
        })
        
        clearTimeout(timeoutId)
        const responseTime = performance.now() - startTime
        
        checks.push({
          name: service.name,
          component: 'external_service',
          status: response.ok ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
          responseTime,
          timestamp: new Date(),
          message: `External service ${service.name}: ${response.status}`,
          metadata: {
            url: service.url,
            status: response.status,
            statusText: response.statusText
          }
        })

      } catch (error) {
        const responseTime = performance.now() - startTime
        const err = error instanceof Error ? error : new Error(String(error))
        
        checks.push({
          name: service.name,
          component: 'external_service',
          status: HealthStatus.UNHEALTHY,
          responseTime,
          timestamp: new Date(),
          message: `External service ${service.name} failed: ${err.message}`,
          metadata: {
            url: service.url,
            error: err.message
          }
        })
      }
    }

    return checks
  }

  /**
   * Calculate overall system health
   */
  private static calculateSystemHealth(checks: HealthCheck[]): SystemHealth {
    const summary = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      unknown: 0,
      total: checks.length
    }

    const components: Record<string, HealthCheck> = {}

    for (const check of checks) {
      components[`${check.component}_${check.name}`] = check
      
      switch (check.status) {
        case HealthStatus.HEALTHY:
          summary.healthy++
          break
        case HealthStatus.DEGRADED:
          summary.degraded++
          break
        case HealthStatus.UNHEALTHY:
          summary.unhealthy++
          break
        default:
          summary.unknown++
      }
    }

    // Determine overall status
    let overall = HealthStatus.HEALTHY
    if (summary.unhealthy > 0) {
      overall = HealthStatus.UNHEALTHY
    } else if (summary.degraded > 0) {
      overall = HealthStatus.DEGRADED
    } else if (summary.unknown > 0) {
      overall = HealthStatus.UNKNOWN
    }

    return {
      overall,
      components,
      summary,
      lastCheck: new Date(),
      uptime: Date.now() - this.startTime
    }
  }

  /**
   * Handle health check alerts
   */
  private static async handleHealthAlerts(checks: HealthCheck[]): Promise<void> {
    for (const check of checks) {
      if (check.status === HealthStatus.UNHEALTHY) {
        await ErrorTracker.trackError(
          new Error(`Health check failed: ${check.component}.${check.name}`),
          {
            component: 'health-checker',
            operation: 'health_check',
            metadata: {
              checkName: check.name,
              checkComponent: check.component,
              responseTime: check.responseTime,
              message: check.message,
              ...check.metadata
            }
          },
          ErrorType.SYSTEM,
          ErrorSeverity.HIGH
        )
      } else if (check.status === HealthStatus.DEGRADED) {
        ApplicationLogger.systemHealth('health-checker', 'degraded', {
          component: check.component,
          check: check.name,
          responseTime: check.responseTime,
          message: check.message
        })
      }
    }
  }

  /**
   * Execute health check with timeout
   */
  private static async executeWithTimeout<T>(
    checkFunction: () => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Health check timed out after ${this.config.timeout}ms`))
      }, this.config.timeout)

      checkFunction()
        .then(result => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }

  /**
   * Start periodic health checks
   */
  private static startHealthChecks(): void {
    // Perform initial check
    this.performHealthChecks().catch(error => {
      ApplicationLogger.systemHealth('health-checker', 'unhealthy', {
        error: error instanceof Error ? error.message : String(error),
        operation: 'initial_health_check'
      })
    })

    // Schedule periodic checks
    this.checkInterval = setInterval(async () => {
      try {
        await this.performHealthChecks()
      } catch (error) {
        ApplicationLogger.systemHealth('health-checker', 'unhealthy', {
          error: error instanceof Error ? error.message : String(error),
          operation: 'periodic_health_check'
        })
      }
    }, this.config.checkInterval * 1000)
  }

  /**
   * Stop health checks
   */
  static stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = undefined
    }
    
    ApplicationLogger.businessOperation('stop_health_checker', 'health-checker', 'system', {
      metadata: { uptime: Date.now() - this.startTime }
    })
  }

  /**
   * Get current configuration
   */
  static getConfig(): HealthCheckConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  static updateConfig(newConfig: Partial<HealthCheckConfig>): void {
    const oldConfig = { ...this.config }
    this.config = { ...this.config, ...newConfig }
    
    // Restart health checks if interval changed
    if (newConfig.checkInterval && newConfig.checkInterval !== oldConfig.checkInterval) {
      this.stop()
      if (this.config.enabled) {
        this.startHealthChecks()
      }
    }
    
    ApplicationLogger.businessOperation('config_updated', 'health-checker', 'config', {
      metadata: { updatedFields: Object.keys(newConfig) }
    })
  }

  /**
   * Get system uptime
   */
  static getUptime(): number {
    return Date.now() - this.startTime
  }

  /**
   * Get health check history
   */
  static getHealthHistory(): HealthCheck[] {
    return Array.from(this.healthChecks.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }
}