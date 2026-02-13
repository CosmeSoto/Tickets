/**
 * Error Tracker Tests
 * 
 * Tests for error tracking and alerting functionality
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

// Mock fetch for webhook tests
global.fetch = jest.fn()

import { ErrorTracker, ErrorType, ErrorSeverity } from '@/lib/monitoring/error-tracker'

describe('ErrorTracker', () => {
  beforeEach(() => {
    // Reset error tracker state
    ErrorTracker['errorStore'].clear()
    ErrorTracker['alertCooldown'].clear()
    
    // Enable error tracking for tests
    ErrorTracker.updateConfig({ enabled: true })
    
    jest.clearAllMocks()
  })

  describe('trackError', () => {
    it('should track a basic error', async () => {
      const error = new Error('Test error')
      const errorId = await ErrorTracker.trackError(error)
      
      expect(errorId).toBeTruthy()
      
      const stats = ErrorTracker.getErrorStats()
      expect(stats.totalErrors).toBe(1)
      expect(stats.errorsByType[ErrorType.JAVASCRIPT]).toBe(1)
    })

    it('should increment count for duplicate errors', async () => {
      const error = new Error('Duplicate error')
      
      await ErrorTracker.trackError(error)
      await ErrorTracker.trackError(error)
      
      const stats = ErrorTracker.getErrorStats()
      expect(stats.totalErrors).toBe(2) // Same error counted twice
      expect(stats.recentErrors).toHaveLength(1) // But only one unique error
      expect(stats.recentErrors[0].count).toBe(2)
    })

    it('should categorize errors by type', async () => {
      await ErrorTracker.trackError(new Error('JS Error'), {}, ErrorType.JAVASCRIPT)
      await ErrorTracker.trackError(new Error('API Error'), {}, ErrorType.API)
      await ErrorTracker.trackError(new Error('DB Error'), {}, ErrorType.DATABASE)
      
      const stats = ErrorTracker.getErrorStats()
      expect(stats.errorsByType[ErrorType.JAVASCRIPT]).toBe(1)
      expect(stats.errorsByType[ErrorType.API]).toBe(1)
      expect(stats.errorsByType[ErrorType.DATABASE]).toBe(1)
    })

    it('should categorize errors by severity', async () => {
      await ErrorTracker.trackError(new Error('Low'), {}, ErrorType.JAVASCRIPT, ErrorSeverity.LOW)
      await ErrorTracker.trackError(new Error('High'), {}, ErrorType.JAVASCRIPT, ErrorSeverity.HIGH)
      await ErrorTracker.trackError(new Error('Critical'), {}, ErrorType.JAVASCRIPT, ErrorSeverity.CRITICAL)
      
      const stats = ErrorTracker.getErrorStats()
      expect(stats.errorsBySeverity[ErrorSeverity.LOW]).toBe(1)
      expect(stats.errorsBySeverity[ErrorSeverity.HIGH]).toBe(1)
      expect(stats.errorsBySeverity[ErrorSeverity.CRITICAL]).toBe(1)
    })

    it('should ignore filtered errors', async () => {
      // Update config to ignore certain errors
      ErrorTracker.updateConfig({
        filtering: {
          ignoreErrors: ['Network Error'],
          ignorePaths: ['/favicon.ico'],
          ignoreUserAgents: ['bot']
        }
      })

      // These should be ignored
      await ErrorTracker.trackError(new Error('Network Error'))
      await ErrorTracker.trackError(new Error('Test'), { url: '/favicon.ico' })
      await ErrorTracker.trackError(new Error('Test'), { userAgent: 'Googlebot' })
      
      const stats = ErrorTracker.getErrorStats()
      expect(stats.totalErrors).toBe(0)
    })
  })

  describe('trackAPIError', () => {
    it('should track API errors with request context', async () => {
      const error = new Error('API Error')
      const request = {
        method: 'POST',
        url: '/api/test',
        headers: { 'user-agent': 'test-agent' }
      }
      const response = { status: 500, statusText: 'Internal Server Error' }
      
      const errorId = await ErrorTracker.trackAPIError(error, request, response, 'user123')
      
      expect(errorId).toBeTruthy()
      
      const stats = ErrorTracker.getErrorStats()
      expect(stats.errorsByType[ErrorType.API]).toBe(1)
      expect(stats.errorsBySeverity[ErrorSeverity.HIGH]).toBe(1) // 500 status = HIGH severity
    })

    it('should determine severity from HTTP status', async () => {
      const request = { method: 'GET', url: '/api/test' }
      
      // 4xx should be MEDIUM severity
      await ErrorTracker.trackAPIError(
        new Error('Bad Request'), 
        request, 
        { status: 400, statusText: 'Bad Request' }
      )
      
      // 5xx should be HIGH severity  
      await ErrorTracker.trackAPIError(
        new Error('Server Error'), 
        request, 
        { status: 500, statusText: 'Server Error' }
      )
      
      const stats = ErrorTracker.getErrorStats()
      expect(stats.errorsBySeverity[ErrorSeverity.MEDIUM]).toBe(1)
      expect(stats.errorsBySeverity[ErrorSeverity.HIGH]).toBe(1)
    })
  })

  describe('trackDatabaseError', () => {
    it('should track database errors with query context', async () => {
      const error = new Error('Connection timeout')
      const operation = 'SELECT'
      const query = 'SELECT * FROM users WHERE id = ?'
      const params = ['123']
      
      const errorId = await ErrorTracker.trackDatabaseError(error, operation, query, params)
      
      expect(errorId).toBeTruthy()
      
      const stats = ErrorTracker.getErrorStats()
      expect(stats.errorsByType[ErrorType.DATABASE]).toBe(1)
      expect(stats.errorsBySeverity[ErrorSeverity.HIGH]).toBe(1) // DB errors are HIGH by default
    })
  })

  describe('trackAuthError', () => {
    it('should track authentication errors', async () => {
      const error = new Error('Invalid token')
      const userId = 'user123'
      const operation = 'login'
      
      const errorId = await ErrorTracker.trackAuthError(error, userId, operation)
      
      expect(errorId).toBeTruthy()
      
      const stats = ErrorTracker.getErrorStats()
      expect(stats.errorsByType[ErrorType.AUTHENTICATION]).toBe(1)
      expect(stats.errorsBySeverity[ErrorSeverity.HIGH]).toBe(1)
    })
  })

  describe('resolveError', () => {
    it('should resolve an error', async () => {
      const error = new Error('Test error')
      await ErrorTracker.trackError(error)
      
      // Get the fingerprint from the stored error
      const stats = ErrorTracker.getErrorStats()
      const errorReport = stats.recentErrors[0]
      
      const resolved = ErrorTracker.resolveError(errorReport.fingerprint, 'admin')
      expect(resolved).toBe(true)
      
      const updatedStats = ErrorTracker.getErrorStats()
      expect(updatedStats.recentErrors[0].resolved).toBe(true)
      expect(updatedStats.recentErrors[0].tags).toContain('resolved-by:admin')
    })

    it('should return false for non-existent error', () => {
      const resolved = ErrorTracker.resolveError('non-existent', 'admin')
      expect(resolved).toBe(false)
    })
  })

  describe('clearOldErrors', () => {
    it('should clear old resolved errors', async () => {
      // Create an old error
      const error = new Error('Old error')
      await ErrorTracker.trackError(error)
      
      // Get the error and resolve it
      const stats = ErrorTracker.getErrorStats()
      const errorReport = stats.recentErrors[0]
      ErrorTracker.resolveError(errorReport.fingerprint, 'system')
      
      // Manually set old date
      errorReport.lastSeen = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) // 31 days ago
      
      const clearedCount = ErrorTracker.clearOldErrors(30)
      expect(clearedCount).toBe(1)
      
      const finalStats = ErrorTracker.getErrorStats()
      expect(finalStats.totalErrors).toBe(0)
    })

    it('should not clear unresolved errors', async () => {
      const error = new Error('Unresolved error')
      await ErrorTracker.trackError(error)
      
      // Get the error but don't resolve it
      const stats = ErrorTracker.getErrorStats()
      const errorReport = stats.recentErrors[0]
      
      // Manually set old date but don't resolve
      errorReport.lastSeen = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
      
      const clearedCount = ErrorTracker.clearOldErrors(30)
      expect(clearedCount).toBe(0)
      
      const finalStats = ErrorTracker.getErrorStats()
      expect(finalStats.totalErrors).toBe(1)
    })
  })

  describe('getErrorStats', () => {
    it('should return comprehensive error statistics', async () => {
      // Create various errors
      await ErrorTracker.trackError(new Error('Error 1'), {}, ErrorType.JAVASCRIPT, ErrorSeverity.LOW)
      await ErrorTracker.trackError(new Error('Error 2'), {}, ErrorType.API, ErrorSeverity.HIGH)
      await ErrorTracker.trackError(new Error('Error 1'), {}, ErrorType.JAVASCRIPT, ErrorSeverity.LOW) // Duplicate
      
      const stats = ErrorTracker.getErrorStats()
      
      expect(stats.totalErrors).toBe(3)
      expect(stats.errorsByType[ErrorType.JAVASCRIPT]).toBe(2)
      expect(stats.errorsByType[ErrorType.API]).toBe(1)
      expect(stats.errorsBySeverity[ErrorSeverity.LOW]).toBe(2)
      expect(stats.errorsBySeverity[ErrorSeverity.HIGH]).toBe(1)
      expect(stats.recentErrors).toHaveLength(2) // 2 unique errors
      expect(stats.topErrors).toHaveLength(2)
    })
  })

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        enabled: false,
        sampleRate: 0.5
      }
      
      ErrorTracker.updateConfig(newConfig)
      
      const config = ErrorTracker.getConfig()
      expect(config.enabled).toBe(false)
      expect(config.sampleRate).toBe(0.5)
    })

    it('should not track errors when disabled', async () => {
      ErrorTracker.updateConfig({ enabled: false })
      
      const errorId = await ErrorTracker.trackError(new Error('Test'))
      expect(errorId).toBe('')
      
      const stats = ErrorTracker.getErrorStats()
      expect(stats.totalErrors).toBe(0)
    })
  })

  describe('alerting', () => {
    beforeEach(() => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200
      })
    })

    it('should send alerts for critical errors', async () => {
      ErrorTracker.updateConfig({
        alerting: {
          enabled: true,
          teamsWebhook: 'https://teams.webhook.url'
        }
      })

      await ErrorTracker.trackError(
        new Error('Critical error'),
        {},
        ErrorType.SYSTEM,
        ErrorSeverity.CRITICAL
      )

      // Wait for async alert sending
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(fetch).toHaveBeenCalledWith(
        'https://teams.webhook.url',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      )
    })

    it('should respect cooldown periods', async () => {
      ErrorTracker.updateConfig({
        alerting: {
          enabled: true,
          teamsWebhook: 'https://teams.webhook.url'
        }
      })

      // Send two critical errors quickly
      await ErrorTracker.trackError(
        new Error('Critical error'),
        {},
        ErrorType.SYSTEM,
        ErrorSeverity.CRITICAL
      )
      
      await ErrorTracker.trackError(
        new Error('Critical error'),
        {},
        ErrorType.SYSTEM,
        ErrorSeverity.CRITICAL
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should only send one alert due to cooldown
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })
})