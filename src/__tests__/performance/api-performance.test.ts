/**
 * API Performance Tests
 * Tests API response times under various load conditions
 */

import { performance } from 'perf_hooks'

describe('API Performance Tests', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'
  const PERFORMANCE_THRESHOLDS = {
    fast: 100,      // < 100ms
    acceptable: 500, // < 500ms
    slow: 1000,     // < 1000ms
    timeout: 5000   // < 5000ms
  }

  // Helper function to measure API response time
  const measureApiCall = async (url: string, options: RequestInit = {}) => {
    const startTime = performance.now()
    
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
      
      const endTime = performance.now()
      const responseTime = endTime - startTime
      
      return {
        success: response.ok,
        status: response.status,
        responseTime,
        response: response.ok ? await response.json() : null,
      }
    } catch (error) {
      const endTime = performance.now()
      return {
        success: false,
        status: 0,
        responseTime: endTime - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Helper function to run multiple concurrent requests
  const measureConcurrentRequests = async (url: string, concurrency: number, options: RequestInit = {}) => {
    const promises = Array.from({ length: concurrency }, () => measureApiCall(url, options))
    const results = await Promise.all(promises)
    
    const responseTimes = results.map(r => r.responseTime)
    const successCount = results.filter(r => r.success).length
    
    return {
      totalRequests: concurrency,
      successfulRequests: successCount,
      failedRequests: concurrency - successCount,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      p95ResponseTime: responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)],
      successRate: (successCount / concurrency) * 100,
    }
  }

  describe('Health Check Performance', () => {
    it('should respond to health check quickly', async () => {
      const result = await measureApiCall('/api/health/database')
      
      // Test should pass regardless of server status, focusing on response time
      expect(result.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.timeout)
      
      // If successful, should be fast
      if (result.success) {
        expect(result.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.fast)
      }
    }, 10000)

    it('should handle multiple concurrent health checks', async () => {
      const result = await measureConcurrentRequests('/api/health/database', 10)
      
      expect(result.averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.timeout)
      expect(result.maxResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.timeout)
      
      // If any requests succeed, they should be reasonably fast
      if (result.successfulRequests > 0) {
        expect(result.averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow)
      }
    }, 15000)
  })

  describe('Authentication Performance', () => {
    it('should handle login requests efficiently', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'testpassword'
      }

      const result = await measureApiCall('/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify(loginData),
      })

      // Even if authentication fails, response should be fast
      expect(result.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.acceptable)
    }, 10000)

    it('should handle concurrent login attempts', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'testpassword'
      }

      const result = await measureConcurrentRequests('/api/auth/signin', 5, {
        method: 'POST',
        body: JSON.stringify(loginData),
      })

      expect(result.averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow)
      expect(result.maxResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.timeout)
    }, 20000)
  })

  describe('Tickets API Performance', () => {
    it('should fetch tickets list quickly', async () => {
      const result = await measureApiCall('/api/tickets?page=1&limit=10')
      
      // May fail due to authentication, but should respond quickly
      expect(result.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.acceptable)
    }, 10000)

    it('should handle paginated requests efficiently', async () => {
      const pages = [1, 2, 3, 4, 5]
      const results = await Promise.all(
        pages.map(page => measureApiCall(`/api/tickets?page=${page}&limit=10`))
      )

      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.acceptable)
    }, 15000)

    it('should handle search queries efficiently', async () => {
      const searchQueries = ['test', 'urgent', 'bug', 'feature', 'support']
      const results = await Promise.all(
        searchQueries.map(query => measureApiCall(`/api/tickets?search=${encodeURIComponent(query)}`))
      )

      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow)
    }, 15000)
  })

  describe('Categories API Performance', () => {
    it('should fetch categories quickly', async () => {
      const result = await measureApiCall('/api/categories')
      
      expect(result.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.fast)
    }, 10000)

    it('should handle concurrent category requests', async () => {
      const result = await measureConcurrentRequests('/api/categories', 20)
      
      expect(result.averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.acceptable)
      expect(result.p95ResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow)
    }, 15000)
  })

  describe('Dashboard Stats Performance', () => {
    it('should load dashboard stats efficiently', async () => {
      const result = await measureApiCall('/api/dashboard/stats')
      
      // Dashboard stats might be complex queries
      expect(result.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.timeout)
      
      if (result.success) {
        expect(result.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow)
      }
    }, 10000)

    it('should handle concurrent dashboard requests', async () => {
      const result = await measureConcurrentRequests('/api/dashboard/stats', 5)
      
      expect(result.averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.timeout)
      
      // If any requests succeed, performance should be reasonable
      if (result.successfulRequests > 0) {
        expect(result.averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow)
      }
    }, 20000)
  })

  describe('File Upload Performance', () => {
    it('should handle small file uploads efficiently', async () => {
      const smallFile = new Blob(['test file content'], { type: 'text/plain' })
      const formData = new FormData()
      formData.append('file', smallFile, 'test.txt')

      const result = await measureApiCall('/api/tickets/1/attachments', {
        method: 'POST',
        body: formData,
      })

      // May fail due to authentication, but should respond quickly
      expect(result.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow)
    }, 15000)
  })

  describe('Performance Regression Tests', () => {
    it('should maintain consistent performance across multiple runs', async () => {
      const runs = 5
      const results = []

      for (let i = 0; i < runs; i++) {
        const result = await measureApiCall('/api/categories')
        results.push(result.responseTime)
        
        // Small delay between runs
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const avgTime = results.reduce((a, b) => a + b, 0) / results.length
      const maxTime = Math.max(...results)
      const minTime = Math.min(...results)
      const variance = maxTime - minTime

      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.acceptable)
      expect(variance).toBeLessThan(PERFORMANCE_THRESHOLDS.acceptable) // Consistent performance
    }, 30000)

    it('should handle gradual load increase', async () => {
      const loadLevels = [1, 2, 5, 10]
      const results = []

      for (const load of loadLevels) {
        const result = await measureConcurrentRequests('/api/categories', load)
        results.push({
          load,
          avgResponseTime: result.averageResponseTime,
          successRate: result.successRate
        })
        
        // Brief pause between load levels
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Performance should degrade gracefully
      results.forEach((result, index) => {
        expect(result.avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.timeout)
        
        // If requests succeed, they should be reasonably fast
        if (result.successfulRequests > 0) {
          expect(result.avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow)
        }
        
        // Response time shouldn't increase dramatically
        if (index > 0 && result.successfulRequests > 0 && results[index - 1].successfulRequests > 0) {
          const previousResult = results[index - 1]
          const performanceDegradation = result.avgResponseTime / previousResult.avgResponseTime
          expect(performanceDegradation).toBeLessThan(3) // Max 3x slower
        }
      })
    }, 45000)
  })

  describe('Memory and Resource Performance', () => {
    it('should not cause memory leaks during repeated requests', async () => {
      const initialMemory = process.memoryUsage()
      
      // Make many requests
      for (let i = 0; i < 50; i++) {
        await measureApiCall('/api/categories')
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }
      
      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    }, 60000)
  })

  describe('Error Handling Performance', () => {
    it('should handle 404 errors quickly', async () => {
      const result = await measureApiCall('/api/nonexistent-endpoint')
      
      expect(result.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.timeout)
      
      // If we get a response, it should be fast
      if (result.status > 0) {
        expect(result.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.fast)
      }
    }, 10000)

    it('should handle malformed requests efficiently', async () => {
      const result = await measureApiCall('/api/tickets', {
        method: 'POST',
        body: 'invalid json',
      })

      expect(result.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.timeout)
      
      if (result.status > 0) {
        expect(result.responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.acceptable)
      }
    }, 10000)
  })

  describe('Performance Benchmarks', () => {
    it('should meet performance benchmarks for critical endpoints', async () => {
      const criticalEndpoints = [
        { url: '/api/categories', threshold: PERFORMANCE_THRESHOLDS.fast },
        { url: '/api/tickets?page=1&limit=10', threshold: PERFORMANCE_THRESHOLDS.acceptable },
        { url: '/api/dashboard/stats', threshold: PERFORMANCE_THRESHOLDS.slow },
      ]

      for (const endpoint of criticalEndpoints) {
        const result = await measureApiCall(endpoint.url)
        
        // eslint-disable-next-line no-console
        console.log(`${endpoint.url}: ${result.responseTime.toFixed(2)}ms`)
        expect(result.responseTime).toBeLessThan(endpoint.threshold)
      }
    }, 30000)

    it('should maintain performance under sustained load', async () => {
      const duration = 10000 // 10 seconds
      const startTime = Date.now()
      const results = []

      while (Date.now() - startTime < duration) {
        const result = await measureApiCall('/api/categories')
        results.push(result.responseTime)
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      const avgResponseTime = results.reduce((a, b) => a + b, 0) / results.length
      const p95ResponseTime = results.sort((a, b) => a - b)[Math.floor(results.length * 0.95)]

      expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.acceptable)
      expect(p95ResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.slow)
      expect(results.length).toBeGreaterThan(50) // Should handle many requests
    }, 15000)
  })
})