/**
 * Tests for the structured logging system
 */

import { logger, LogLevel } from '@/lib/logging/logger'
import { ApplicationLogger } from '@/lib/logging/application-logger'

// Mock console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
}

const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}

describe('Structured Logger', () => {
  beforeEach(() => {
    // Mock console methods
    console.log = mockConsole.log
    console.error = mockConsole.error
    console.warn = mockConsole.warn
    console.debug = mockConsole.debug
    
    // Clear mocks
    Object.values(mockConsole).forEach(mock => mock.mockClear())
    
    // Set environment to development for readable logs
    process.env.NODE_ENV = 'development'
  })

  afterAll(() => {
    // Restore console methods
    console.log = originalConsole.log
    console.error = originalConsole.error
    console.warn = originalConsole.warn
    console.debug = originalConsole.debug
    
    // Restore environment
    process.env.NODE_ENV = 'test'
  })

  describe('Basic Logging', () => {
    test('should log info messages', () => {
      logger.info('Test info message', { userId: 'test123' })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      
      // Parse JSON log entry
      const logEntry = JSON.parse(logCall)
      expect(logEntry.level).toBe('INFO')
      expect(logEntry.message).toBe('Test info message')
      expect(logEntry.context.userId).toBe('test123')
      expect(logEntry.service).toBe('sistema-tickets-nextjs')
    })

    test('should log error messages with error objects', () => {
      const testError = new Error('Test error')
      logger.error('Test error message', { userId: 'test123' }, testError)
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      
      // Parse JSON log entry
      const logEntry = JSON.parse(logCall)
      expect(logEntry.level).toBe('ERROR')
      expect(logEntry.message).toBe('Test error message')
      expect(logEntry.context.userId).toBe('test123')
      expect(logEntry.error.name).toBe('Error')
      expect(logEntry.error.message).toBe('Test error')
    })

    test('should log warning messages', () => {
      logger.warn('Test warning message', { component: 'test' })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      
      // Parse JSON log entry
      const logEntry = JSON.parse(logCall)
      expect(logEntry.level).toBe('WARN')
      expect(logEntry.message).toBe('Test warning message')
      expect(logEntry.context.component).toBe('test')
    })

    test('should not log debug messages in test environment', () => {
      logger.debug('Test debug message', { operation: 'test_op' })
      
      // Debug messages should not be logged in test environment (WARN level)
      expect(mockConsole.log).not.toHaveBeenCalled()
      expect(mockConsole.debug).not.toHaveBeenCalled()
    })
  })

  describe('Performance Logging', () => {
    test('should log performance metrics', () => {
      logger.performance('Test operation completed', 150, { 
        component: 'test',
        operation: 'test_operation' 
      })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      expect(logCall).toContain('Test operation completed')
      expect(logCall).toContain('test')
    })

    test('should measure operation time with timer', () => {
      const timer = logger.time('test_operation', { component: 'test' })
      
      // Simulate some work
      setTimeout(() => {
        timer.end('Operation completed')
      }, 10)
      
      // Timer should be created
      expect(timer).toBeDefined()
      expect(typeof timer.end).toBe('function')
    })
  })

  describe('Child Loggers', () => {
    test('should create child logger with inherited context', () => {
      const childLogger = logger.child({ 
        userId: 'test123',
        component: 'test-component' 
      })
      
      childLogger.info('Child logger message', { operation: 'test' })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      expect(logCall).toContain('Child logger message')
      expect(logCall).toContain('test123')
      expect(logCall).toContain('test-component')
      expect(logCall).toContain('test')
    })

    test('should allow nested child loggers', () => {
      const parentChild = logger.child({ userId: 'test123' })
      const nestedChild = parentChild.child({ operation: 'nested_op' })
      
      nestedChild.info('Nested child message')
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      expect(logCall).toContain('test123')
      expect(logCall).toContain('nested_op')
    })
  })

  describe('Context and Metadata', () => {
    test('should include request ID in context', () => {
      logger.info('Test message', { 
        requestId: 'req_123',
        metadata: { key: 'value' }
      })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      expect(logCall).toContain('req_123')
      expect(logCall).toContain('value')
    })

    test('should handle complex metadata objects', () => {
      const complexMetadata = {
        user: { id: '123', name: 'Test User' },
        request: { method: 'POST', path: '/api/test' },
        performance: { duration: 150, memory: 1024 }
      }
      
      logger.info('Complex metadata test', { metadata: complexMetadata })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      expect(logCall).toContain('Test User')
      expect(logCall).toContain('POST')
      expect(logCall).toContain('/api/test')
    })
  })
})

describe('Application Logger', () => {
  beforeEach(() => {
    // Mock console methods
    console.log = mockConsole.log
    console.error = mockConsole.error
    console.warn = mockConsole.warn
    console.debug = mockConsole.debug
    
    // Clear mocks
    Object.values(mockConsole).forEach(mock => mock.mockClear())
    
    // Set environment to development for readable logs
    process.env.NODE_ENV = 'development'
    process.env.LOG_LEVEL = 'DEBUG'
  })

  afterAll(() => {
    // Restore environment
    process.env.NODE_ENV = 'test'
    delete process.env.LOG_LEVEL
  })

  describe('API Logging', () => {
    test('should log API request start', () => {
      ApplicationLogger.apiRequestStart('POST', '/api/tickets', {
        requestId: 'req_123',
        userId: 'user123'
      })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      const logEntry = JSON.parse(logCall)
      expect(logEntry.message).toContain('API Request Started: POST /api/tickets')
      expect(logEntry.context.requestId).toBe('req_123')
      expect(logEntry.context.userId).toBe('user123')
    })

    test('should log API request completion', () => {
      ApplicationLogger.apiRequestComplete('POST', '/api/tickets', 201, 150, {
        requestId: 'req_123',
        userId: 'user123'
      })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      const logEntry = JSON.parse(logCall)
      expect(logEntry.message).toContain('API Request Completed: POST /api/tickets - 201')
      expect(logEntry.context.requestId).toBe('req_123')
      expect(logEntry.performance.duration).toBe(150)
    })

    test('should log API request errors', () => {
      const testError = new Error('API Error')
      ApplicationLogger.apiRequestError('POST', '/api/tickets', testError, {
        requestId: 'req_123'
      })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      const logEntry = JSON.parse(logCall)
      expect(logEntry.level).toBe('ERROR')
      expect(logEntry.message).toContain('API Request Error: POST /api/tickets')
      expect(logEntry.context.requestId).toBe('req_123')
      expect(logEntry.error.message).toBe('API Error')
    })
  })

  describe('Database Logging', () => {
    test('should not log database operation start in test environment', () => {
      ApplicationLogger.databaseOperationStart('create', 'tickets', {
        requestId: 'req_123'
      })
      
      // Debug messages should not be logged in test environment (WARN level)
      expect(mockConsole.log).not.toHaveBeenCalled()
      expect(mockConsole.debug).not.toHaveBeenCalled()
    })

    test('should log database operation completion', () => {
      ApplicationLogger.databaseOperationComplete('create', 'tickets', 45, 1, {
        requestId: 'req_123'
      })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      const logEntry = JSON.parse(logCall)
      expect(logEntry.message).toContain('Database Operation Completed: create on tickets')
      expect(logEntry.performance.duration).toBe(45)
    })

    test('should log database operation errors', () => {
      const dbError = new Error('Database connection failed')
      ApplicationLogger.databaseOperationError('create', 'tickets', dbError, {
        requestId: 'req_123'
      })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      const logEntry = JSON.parse(logCall)
      expect(logEntry.level).toBe('ERROR')
      expect(logEntry.message).toContain('Database Operation Error: create on tickets')
      expect(logEntry.error.message).toBe('Database connection failed')
    })
  })

  describe('Authentication Logging', () => {
    test('should log successful authentication', () => {
      ApplicationLogger.authenticationAttempt('user@example.com', true, {
        requestId: 'req_123'
      })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      const logEntry = JSON.parse(logCall)
      expect(logEntry.message).toContain('Authentication Success: user@example.com')
    })

    test('should log failed authentication', () => {
      ApplicationLogger.authenticationAttempt('user@example.com', false, {
        requestId: 'req_123'
      })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      const logEntry = JSON.parse(logCall)
      expect(logEntry.level).toBe('WARN')
      expect(logEntry.message).toContain('Authentication Failed: user@example.com')
    })

    test('should log authorization checks', () => {
      ApplicationLogger.authorizationCheck('user123', '/admin', 'access', false, {
        requestId: 'req_123'
      })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      const logEntry = JSON.parse(logCall)
      expect(logEntry.level).toBe('WARN')
      expect(logEntry.message).toContain('Authorization Denied: access on /admin')
    })
  })

  describe('Security Logging', () => {
    test('should log security events with appropriate severity', () => {
      ApplicationLogger.securityEvent('rate_limit_exceeded', 'high', {
        ip: '192.168.1.1',
        endpoint: '/api/tickets'
      }, { requestId: 'req_123' })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      const logEntry = JSON.parse(logCall)
      expect(logEntry.level).toBe('ERROR')
      expect(logEntry.message).toContain('Security Event: rate_limit_exceeded')
      expect(logEntry.context.metadata.ip).toBe('192.168.1.1')
    })

    test('should log low severity security events as info', () => {
      ApplicationLogger.securityEvent('login_attempt', 'low', {
        ip: '192.168.1.1'
      })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      const logEntry = JSON.parse(logCall)
      expect(logEntry.level).toBe('INFO')
      expect(logEntry.message).toContain('Security Event: login_attempt')
    })
  })

  describe('Business Operations', () => {
    test('should log business operations', () => {
      ApplicationLogger.businessOperation('create_ticket', 'ticket', 'ticket123', {
        userId: 'user123'
      })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      expect(logCall).toContain('Business Operation: create_ticket on ticket')
      expect(logCall).toContain('ticket123')
      expect(logCall).toContain('user123')
    })
  })

  describe('User Activity', () => {
    test('should log user activities', () => {
      ApplicationLogger.userActivity('user123', 'ticket_created', {
        ticketId: 'ticket456'
      })
      
      expect(mockConsole.log).toHaveBeenCalled()
      const logCall = mockConsole.log.mock.calls[0][0]
      expect(logCall).toContain('User Activity: ticket_created')
      expect(logCall).toContain('user123')
      expect(logCall).toContain('ticket456')
    })
  })
})