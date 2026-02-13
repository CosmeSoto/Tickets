/**
 * Health Checker Tests
 * 
 * Tests for health checking functionality
 */

// Mock the ApplicationLogger to avoid dependencies
jest.mock('@/lib/logging', () => ({
  ApplicationLogger: {
    timer: jest.fn(() => ({
      end: jest.fn(() => 100)
    })),
    businessOperation: jest.fn(),
    systemHealth: jest.fn()
  }
}))

// Mock ErrorTracker and PerformanceMonitor
jest.mock('@/lib/monitoring/error-tracker', () => ({
  ErrorTracker: {
    trackError: jest.fn()
  },
  ErrorType: {
    SYSTEM: 'system',
    APPLICATION: 'application',
    VALIDATION: 'validation',
    AUTHENTICATION: 'authentication',
    AUTHORIZATION: 'authorization',
    EXTERNAL_SERVICE: 'external_service',
    DATABASE: 'database',
    NETWORK: 'network',
    UNKNOWN: 'unknown'
  },
  ErrorSeverity: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  }
}))

jest.mock('@/lib/monitoring/performance-monitor', () => ({
  PerformanceMonitor: {
    recordMetric: jest.fn()
  },
  MetricType: {
    RESPONSE_TIME: 'response_time',
    DATABASE_QUERY: 'database_query',
    CACHE_HIT_RATE: 'cache_hit_rate',
    MEMORY_USAGE: 'memory_usage',
    CPU_USAGE: 'cpu_usage',
    THROUGHPUT: 'throughput',
    ERROR_RATE: 'error_rate',
    USER_INTERACTION: 'user_interaction',
    EXTERNAL_SERVICE: 'external_service',
    CUSTOM: 'custom'
  },
  MetricUnit: {
    MILLISECONDS: 'ms',
    SECONDS: 's',
    PERCENTAGE: '%',
    BYTES: 'bytes',
    MEGABYTES: 'mb',
    COUNT: 'count',
    REQUESTS_PER_SECOND: 'rps'
  }
}))

// Mock external dependencies
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ total_connections: 5, active_connections: 2 }]),
    $disconnect: jest.fn().mockResolvedValue(undefined)
  }
  
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrisma)
  }
})

jest.mock('redis', () => {
  const mockClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('test_value'),
    del: jest.fn().mockResolvedValue(1),
    info: jest.fn().mockResolvedValue('used_memory:1024000'),
    disconnect: jest.fn().mockResolvedValue(undefined)
  }
  
  return {
    createClient: jest.fn().mockReturnValue(mockClient)
  }
})

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('health check test'),
  unlink: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({
    mtime: new Date()
  })
}))

// Mock fetch for external service checks
global.fetch = jest.fn()

import { HealthChecker, HealthStatus } from '@/lib/monitoring/health-checker'

describe('HealthChecker', () => {
  beforeEach(() => {
    // Reset health checker state
    HealthChecker['healthChecks'].clear()
    HealthChecker['customChecks'].clear()
    
    // Enable health checking for tests
    HealthChecker.updateConfig({ 
      enabled: true,
      checkInterval: 1, // 1 second for faster tests
      timeout: 1000 // 1 second timeout
    })
    
    jest.clearAllMocks()
    
    // Mock fetch responses
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK'
    })
  })

  afterEach(() => {
    // Stop health checker to prevent interference between tests
    HealthChecker.stop()
  })

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      HealthChecker.initialize()
      
      const config = HealthChecker.getConfig()
      expect(config.enabled).toBe(true)
      expect(config.checks.database).toBe(true)
      expect(config.checks.redis).toBe(true)
    })

    it('should initialize with custom configuration', () => {
      HealthChecker.initialize({
        enabled: true,
        checkInterval: 60,
        checks: {
          database: true,
          redis: false,
          externalServices: false,
          filesystem: true,
          memory: true,
          disk: true
        }
      })
      
      const config = HealthChecker.getConfig()
      expect(config.checkInterval).toBe(60)
      expect(config.checks.redis).toBe(false)
      expect(config.checks.externalServices).toBe(false)
    })
  })

  describe('performHealthChecks', () => {
    it('should perform all enabled health checks', async () => {
      HealthChecker.updateConfig({
        checks: {
          database: true,
          redis: true,
          externalServices: true,
          filesystem: true,
          memory: true,
          disk: true
        }
      })

      const systemHealth = await HealthChecker.performHealthChecks()
      
      expect(systemHealth.overall).toBeDefined()
      expect(systemHealth.components).toBeDefined()
      expect(systemHealth.summary).toBeDefined()
      expect(systemHealth.lastCheck).toBeInstanceOf(Date)
      expect(systemHealth.uptime).toBeGreaterThan(0)
      
      // Should have multiple components checked
      expect(Object.keys(systemHealth.components).length).toBeGreaterThan(0)
    })

    it('should handle database check success', async () => {
      HealthChecker.updateConfig({
        checks: {
          database: true,
          redis: false,
          externalServices: false,
          filesystem: false,
          memory: false,
          disk: false
        }
      })

      const systemHealth = await HealthChecker.performHealthChecks()
      
      expect(systemHealth.components['database_connectivity']).toBeDefined()
      expect(systemHealth.components['database_connectivity'].status).toBe(HealthStatus.HEALTHY)
      expect(systemHealth.components['database_connectivity'].responseTime).toBeGreaterThan(0)
    })

    it('should handle redis check success', async () => {
      HealthChecker.updateConfig({
        checks: {
          database: false,
          redis: true,
          externalServices: false,
          filesystem: false,
          memory: false,
          disk: false
        }
      })

      const systemHealth = await HealthChecker.performHealthChecks()
      
      expect(systemHealth.components['redis_connectivity']).toBeDefined()
      expect(systemHealth.components['redis_connectivity'].status).toBe(HealthStatus.HEALTHY)
      expect(systemHealth.components['redis_connectivity'].metadata?.testResult).toBe(true)
    })

    it('should handle filesystem check success', async () => {
      HealthChecker.updateConfig({
        checks: {
          database: false,
          redis: false,
          externalServices: false,
          filesystem: true,
          memory: false,
          disk: false
        }
      })

      const systemHealth = await HealthChecker.performHealthChecks()
      
      expect(systemHealth.components['filesystem_operations']).toBeDefined()
      expect(systemHealth.components['filesystem_operations'].status).toBe(HealthStatus.HEALTHY)
      expect(systemHealth.components['filesystem_operations'].metadata?.testPassed).toBe(true)
    })

    it('should handle memory check', async () => {
      HealthChecker.updateConfig({
        checks: {
          database: false,
          redis: false,
          externalServices: false,
          filesystem: false,
          memory: true,
          disk: false
        }
      })

      const systemHealth = await HealthChecker.performHealthChecks()
      
      expect(systemHealth.components['memory_usage']).toBeDefined()
      expect(systemHealth.components['memory_usage'].metadata?.usagePercent).toBeDefined()
      expect(systemHealth.components['memory_usage'].metadata?.heapUsed).toBeGreaterThan(0)
    })

    it('should handle external service checks', async () => {
      HealthChecker.updateConfig({
        checks: {
          database: false,
          redis: false,
          externalServices: true,
          filesystem: false,
          memory: false,
          disk: false
        }
      })

      const systemHealth = await HealthChecker.performHealthChecks()
      
      // Should have external service checks
      const externalServices = Object.keys(systemHealth.components)
        .filter(key => key.startsWith('external_service_'))
      
      expect(externalServices.length).toBeGreaterThan(0)
    })
  })

  describe('custom health checks', () => {
    it('should register and execute custom health checks', async () => {
      const customCheck = jest.fn().mockResolvedValue({
        name: 'custom_test',
        component: 'custom',
        status: HealthStatus.HEALTHY,
        responseTime: 50,
        timestamp: new Date(),
        message: 'Custom check passed'
      })

      HealthChecker.registerCheck('custom_test', 'custom', customCheck)
      
      const systemHealth = await HealthChecker.performHealthChecks()
      
      expect(customCheck).toHaveBeenCalled()
      expect(systemHealth.components['custom_custom_test']).toBeDefined()
      expect(systemHealth.components['custom_custom_test'].status).toBe(HealthStatus.HEALTHY)
    })

    it('should handle custom check failures', async () => {
      const customCheck = jest.fn().mockRejectedValue(new Error('Custom check failed'))

      HealthChecker.registerCheck('failing_test', 'custom', customCheck)
      
      const systemHealth = await HealthChecker.performHealthChecks()
      
      expect(systemHealth.components['custom_custom_failing_test']).toBeDefined()
      expect(systemHealth.components['custom_custom_failing_test'].status).toBe(HealthStatus.UNHEALTHY)
      expect(systemHealth.components['custom_custom_failing_test'].message).toContain('Custom check failed')
    })
  })

  describe('system health calculation', () => {
    it('should calculate overall healthy status', async () => {
      // Mock process.memoryUsage to return low memory usage
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50 * 1024 * 1024, // 50MB used
        heapTotal: 200 * 1024 * 1024, // 200MB total (25% usage - healthy)
        external: 10 * 1024 * 1024,
        rss: 100 * 1024 * 1024
      })

      // Mock all checks to return healthy
      HealthChecker.updateConfig({
        checks: {
          database: false,
          redis: false,
          externalServices: false,
          filesystem: false,
          memory: true, // Only memory check
          disk: false
        }
      })

      const systemHealth = await HealthChecker.performHealthChecks()
      
      expect(systemHealth.overall).toBe(HealthStatus.HEALTHY)
      expect(systemHealth.summary.healthy).toBe(1)
      expect(systemHealth.summary.unhealthy).toBe(0)

      // Restore original memoryUsage
      process.memoryUsage = originalMemoryUsage
    })

    it('should calculate overall unhealthy status when components fail', async () => {
      // Mock database to fail by overriding the mock for this test
      const { PrismaClient } = require('@prisma/client')
      const mockPrismaInstance = new PrismaClient()
      mockPrismaInstance.$queryRaw.mockRejectedValueOnce(new Error('Database connection failed'))

      HealthChecker.updateConfig({
        checks: {
          database: true,
          redis: false,
          externalServices: false,
          filesystem: false,
          memory: false,
          disk: false
        }
      })

      const systemHealth = await HealthChecker.performHealthChecks()
      
      expect(systemHealth.overall).toBe(HealthStatus.UNHEALTHY)
      expect(systemHealth.summary.unhealthy).toBeGreaterThan(0)
    })
  })

  describe('component health retrieval', () => {
    it('should get health for specific component', async () => {
      await HealthChecker.performHealthChecks()
      
      const databaseHealth = HealthChecker.getComponentHealth('database')
      expect(Array.isArray(databaseHealth)).toBe(true)
    })

    it('should return empty array for non-existent component', () => {
      const nonExistentHealth = HealthChecker.getComponentHealth('non-existent')
      expect(nonExistentHealth).toEqual([])
    })
  })

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig = {
        enabled: false,
        checkInterval: 120,
        timeout: 10000
      }
      
      HealthChecker.updateConfig(newConfig)
      
      const config = HealthChecker.getConfig()
      expect(config.enabled).toBe(false)
      expect(config.checkInterval).toBe(120)
      expect(config.timeout).toBe(10000)
    })

    it('should restart checks when interval changes', () => {
      const stopSpy = jest.spyOn(HealthChecker, 'stop')
      
      HealthChecker.updateConfig({ checkInterval: 60 })
      
      expect(stopSpy).toHaveBeenCalled()
    })
  })

  describe('uptime tracking', () => {
    it('should track system uptime', () => {
      const uptime = HealthChecker.getUptime()
      expect(uptime).toBeGreaterThan(0)
      expect(typeof uptime).toBe('number')
    })
  })

  describe('health history', () => {
    it('should maintain health check history', async () => {
      await HealthChecker.performHealthChecks()
      
      const history = HealthChecker.getHealthHistory()
      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBeGreaterThan(0)
      
      // History should be sorted by timestamp (newest first)
      if (history.length > 1) {
        expect(history[0].timestamp.getTime()).toBeGreaterThanOrEqual(
          history[1].timestamp.getTime()
        )
      }
    })
  })

  describe('error handling', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database to fail by overriding the mock for this test
      const { PrismaClient } = require('@prisma/client')
      const mockPrismaInstance = new PrismaClient()
      mockPrismaInstance.$queryRaw.mockRejectedValueOnce(new Error('Connection timeout'))

      HealthChecker.updateConfig({
        checks: {
          database: true,
          redis: false,
          externalServices: false,
          filesystem: false,
          memory: false,
          disk: false
        }
      })

      const systemHealth = await HealthChecker.performHealthChecks()
      
      expect(systemHealth.components['database_connectivity'].status).toBe(HealthStatus.UNHEALTHY)
      expect(systemHealth.components['database_connectivity'].message).toContain('Connection timeout')
    })

    it('should handle redis connection failures gracefully', async () => {
      // Mock redis to fail by overriding the mock for this test
      const { createClient } = require('redis')
      const mockClient = createClient()
      mockClient.connect.mockRejectedValueOnce(new Error('Redis connection failed'))

      HealthChecker.updateConfig({
        checks: {
          database: false,
          redis: true,
          externalServices: false,
          filesystem: false,
          memory: false,
          disk: false
        }
      })

      const systemHealth = await HealthChecker.performHealthChecks()
      
      expect(systemHealth.components['redis_connectivity'].status).toBe(HealthStatus.UNHEALTHY)
      expect(systemHealth.components['redis_connectivity'].message).toContain('Redis connection failed')
    })

    it('should handle external service failures gracefully', async () => {
      // Mock fetch to fail
      ;(fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      HealthChecker.updateConfig({
        checks: {
          database: false,
          redis: false,
          externalServices: true,
          filesystem: false,
          memory: false,
          disk: false
        }
      })

      const systemHealth = await HealthChecker.performHealthChecks()
      
      // Should have external service checks that failed
      const externalServices = Object.keys(systemHealth.components)
        .filter(key => key.startsWith('external_service_'))
      
      expect(externalServices.length).toBeGreaterThan(0)
      
      // At least one should be unhealthy
      const hasUnhealthyService = externalServices.some(key => 
        systemHealth.components[key].status === HealthStatus.UNHEALTHY
      )
      expect(hasUnhealthyService).toBe(true)
    })
  })
})