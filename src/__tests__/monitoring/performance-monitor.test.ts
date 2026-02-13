/**
 * Performance Monitor Tests
 * 
 * Tests for performance monitoring functionality
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

// Mock ErrorTracker
jest.mock('@/lib/monitoring/error-tracker', () => ({
  ErrorTracker: {
    trackError: jest.fn()
  }
}))

import { PerformanceMonitor, MetricType, MetricUnit } from '@/lib/monitoring/performance-monitor'

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    // Reset performance monitor state
    PerformanceMonitor['metrics'].clear()
    PerformanceMonitor['aggregatedMetrics'].clear()
    PerformanceMonitor['timers'].clear()
    
    // Enable performance monitoring for tests
    PerformanceMonitor.updateConfig({ enabled: true })
    
    jest.clearAllMocks()
  })

  describe('recordMetric', () => {
    it('should record a basic metric', () => {
      PerformanceMonitor.recordMetric({
        name: 'test_metric',
        type: MetricType.RESPONSE_TIME,
        value: 100,
        unit: MetricUnit.MILLISECONDS,
        context: { component: 'test' }
      })

      const stats = PerformanceMonitor.getPerformanceStats()
      expect(Object.keys(stats.metrics)).toHaveLength(1)
      expect(stats.summary['response_time_test_metric']).toBeDefined()
      expect(stats.summary['response_time_test_metric'].avg).toBe(100)
    })

    it('should aggregate multiple metrics of the same type', () => {
      PerformanceMonitor.recordMetric({
        name: 'api_call',
        type: MetricType.RESPONSE_TIME,
        value: 100,
        unit: MetricUnit.MILLISECONDS,
        context: { component: 'api' }
      })

      PerformanceMonitor.recordMetric({
        name: 'api_call',
        type: MetricType.RESPONSE_TIME,
        value: 200,
        unit: MetricUnit.MILLISECONDS,
        context: { component: 'api' }
      })

      const stats = PerformanceMonitor.getPerformanceStats()
      const summary = stats.summary['response_time_api_call']
      
      expect(summary.count).toBe(2)
      expect(summary.avg).toBe(150)
      expect(summary.min).toBe(100)
      expect(summary.max).toBe(200)
    })
  })

  describe('timer functionality', () => {
    it('should start and end timers correctly', () => {
      const timerId = PerformanceMonitor.startTimer('test_operation', {
        component: 'test'
      })

      expect(timerId).toBeTruthy()

      // Simulate some work
      const duration = PerformanceMonitor.endTimer(timerId, MetricType.RESPONSE_TIME)
      
      expect(duration).toBeGreaterThan(0)
      
      const stats = PerformanceMonitor.getPerformanceStats()
      expect(Object.keys(stats.metrics)).toHaveLength(1)
    })

    it('should handle invalid timer IDs gracefully', () => {
      const duration = PerformanceMonitor.endTimer('invalid_timer_id')
      expect(duration).toBe(0)
    })
  })

  describe('trackAPIPerformance', () => {
    it('should track API performance metrics', () => {
      PerformanceMonitor.trackAPIPerformance(
        '/api/users',
        'GET',
        150,
        200,
        { userId: 'user123' }
      )

      const stats = PerformanceMonitor.getPerformanceStats()
      expect(stats.summary['response_time_GET_/api/users']).toBeDefined()
      expect(stats.summary['response_time_GET_/api/users'].avg).toBe(150)
    })

    it('should track error rates for failed requests', () => {
      PerformanceMonitor.trackAPIPerformance(
        '/api/users',
        'POST',
        500,
        500,
        { userId: 'user123' }
      )

      const stats = PerformanceMonitor.getPerformanceStats()
      expect(stats.summary['response_time_POST_/api/users']).toBeDefined()
      expect(stats.summary['error_rate_POST_/api/users_errors']).toBeDefined()
    })
  })

  describe('trackDatabasePerformance', () => {
    it('should track database query performance', () => {
      PerformanceMonitor.trackDatabasePerformance(
        'SELECT',
        250,
        'SELECT * FROM users',
        { userId: 'user123' }
      )

      const stats = PerformanceMonitor.getPerformanceStats()
      expect(stats.summary['database_query_db_SELECT']).toBeDefined()
      expect(stats.summary['database_query_db_SELECT'].avg).toBe(250)
    })
  })

  describe('trackCachePerformance', () => {
    it('should track cache hits and misses', () => {
      PerformanceMonitor.trackCachePerformance('hit', 'user:123')
      PerformanceMonitor.trackCachePerformance('miss', 'user:456')
      PerformanceMonitor.trackCachePerformance('hit', 'user:789')

      const stats = PerformanceMonitor.getPerformanceStats()
      
      // Should have metrics for both hits and misses
      expect(stats.summary['cache_hit_rate_cache_hit']).toBeDefined()
      expect(stats.summary['cache_hit_rate_cache_miss']).toBeDefined()
      
      // Hits should have value 1, misses should have value 0
      expect(stats.summary['cache_hit_rate_cache_hit'].avg).toBe(1)
      expect(stats.summary['cache_hit_rate_cache_miss'].avg).toBe(0)
    })

    it('should track cache operation duration when provided', () => {
      PerformanceMonitor.trackCachePerformance('set', 'user:123', 50)

      const stats = PerformanceMonitor.getPerformanceStats()
      expect(stats.summary['response_time_cache_set_duration']).toBeDefined()
      expect(stats.summary['response_time_cache_set_duration'].avg).toBe(50)
    })
  })

  describe('trackUserInteraction', () => {
    it('should track user interaction performance', () => {
      PerformanceMonitor.trackUserInteraction(
        'button_click',
        75,
        { userId: 'user123', sessionId: 'session456' }
      )

      const stats = PerformanceMonitor.getPerformanceStats()
      expect(stats.summary['user_interaction_user_button_click']).toBeDefined()
      expect(stats.summary['user_interaction_user_button_click'].avg).toBe(75)
    })
  })

  describe('getPerformanceStats', () => {
    it('should return comprehensive performance statistics', () => {
      // Add various metrics
      PerformanceMonitor.recordMetric({
        name: 'metric1',
        type: MetricType.RESPONSE_TIME,
        value: 100,
        unit: MetricUnit.MILLISECONDS,
        context: {}
      })

      PerformanceMonitor.recordMetric({
        name: 'metric2',
        type: MetricType.DATABASE_QUERY,
        value: 200,
        unit: MetricUnit.MILLISECONDS,
        context: {}
      })

      const stats = PerformanceMonitor.getPerformanceStats()
      
      expect(stats.summary).toBeDefined()
      expect(stats.metrics).toBeDefined()
      expect(stats.aggregated).toBeDefined()
      expect(stats.alerts).toBeDefined()
      
      expect(Object.keys(stats.summary)).toHaveLength(2)
    })

    it('should filter metrics by time range', () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

      // Add metric from 2 hours ago (should be filtered out)
      PerformanceMonitor.recordMetric({
        name: 'old_metric',
        type: MetricType.RESPONSE_TIME,
        value: 100,
        unit: MetricUnit.MILLISECONDS,
        context: {}
      })

      // Manually set old timestamp
      const metrics = PerformanceMonitor['metrics'].get('response_time_old_metric')
      if (metrics && metrics.length > 0) {
        metrics[0].timestamp = twoHoursAgo
      }

      // Add recent metric
      PerformanceMonitor.recordMetric({
        name: 'recent_metric',
        type: MetricType.RESPONSE_TIME,
        value: 200,
        unit: MetricUnit.MILLISECONDS,
        context: {}
      })

      const stats = PerformanceMonitor.getPerformanceStats({
        start: oneHourAgo,
        end: now
      })

      // Should only include recent metric
      expect(stats.summary['response_time_recent_metric']).toBeDefined()
      expect(stats.summary['response_time_old_metric']).toBeUndefined()
    })

    it('should calculate percentiles correctly', () => {
      // Add multiple metrics to test percentile calculation
      for (let i = 1; i <= 100; i++) {
        PerformanceMonitor.recordMetric({
          name: 'percentile_test',
          type: MetricType.RESPONSE_TIME,
          value: i,
          unit: MetricUnit.MILLISECONDS,
          context: {}
        })
      }

      const stats = PerformanceMonitor.getPerformanceStats()
      const summary = stats.summary['response_time_percentile_test']
      
      expect(summary.p95).toBeGreaterThan(90)
      expect(summary.p99).toBeGreaterThan(95)
      expect(summary.min).toBe(1)
      expect(summary.max).toBe(100)
    })
  })

  describe('clearOldMetrics', () => {
    it('should clear metrics older than specified days', () => {
      // Add a metric
      PerformanceMonitor.recordMetric({
        name: 'old_metric',
        type: MetricType.RESPONSE_TIME,
        value: 100,
        unit: MetricUnit.MILLISECONDS,
        context: {}
      })

      // Manually set old timestamp
      const metrics = PerformanceMonitor['metrics'].get('response_time_old_metric')
      if (metrics && metrics.length > 0) {
        metrics[0].timestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) // 31 days ago
      }

      const clearedCount = PerformanceMonitor.clearOldMetrics(30)
      expect(clearedCount).toBe(1)

      const stats = PerformanceMonitor.getPerformanceStats()
      expect(Object.keys(stats.metrics)).toHaveLength(0)
    })
  })

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        enabled: false,
        sampleRate: 0.5
      }
      
      PerformanceMonitor.updateConfig(newConfig)
      
      const config = PerformanceMonitor.getConfig()
      expect(config.enabled).toBe(false)
      expect(config.sampleRate).toBe(0.5)
    })

    it('should not record metrics when disabled', () => {
      PerformanceMonitor.updateConfig({ enabled: false })
      
      PerformanceMonitor.recordMetric({
        name: 'disabled_metric',
        type: MetricType.RESPONSE_TIME,
        value: 100,
        unit: MetricUnit.MILLISECONDS,
        context: {}
      })

      const stats = PerformanceMonitor.getPerformanceStats()
      expect(Object.keys(stats.metrics)).toHaveLength(0)
    })

    it('should respect sample rate', () => {
      PerformanceMonitor.updateConfig({ sampleRate: 0 }) // Never sample
      
      const timerId = PerformanceMonitor.startTimer('sampled_test')
      expect(timerId).toBe('') // Should return empty string when not sampled
    })
  })

  describe('threshold checking', () => {
    it('should detect threshold violations', () => {
      // Configure low thresholds for testing
      PerformanceMonitor.updateConfig({
        thresholds: {
          [MetricType.RESPONSE_TIME]: { warning: 50, critical: 100 },
          [MetricType.DATABASE_QUERY]: { warning: 100, critical: 200 },
          [MetricType.CACHE_HIT_RATE]: { warning: 80, critical: 60 },
          [MetricType.MEMORY_USAGE]: { warning: 80, critical: 95 },
          [MetricType.ERROR_RATE]: { warning: 5, critical: 10 }
        }
      })

      // Record metric that exceeds critical threshold
      PerformanceMonitor.recordMetric({
        name: 'slow_operation',
        type: MetricType.RESPONSE_TIME,
        value: 150, // Exceeds critical threshold of 100
        unit: MetricUnit.MILLISECONDS,
        context: { component: 'test' }
      })

      const stats = PerformanceMonitor.getPerformanceStats()
      expect(stats.alerts).toHaveLength(1)
      expect(stats.alerts[0].type).toBe('critical')
      expect(stats.alerts[0].value).toBe(150)
    })
  })
})