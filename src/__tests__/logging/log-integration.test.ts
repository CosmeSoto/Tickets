/**
 * Log Integration Tests
 */

import { LogIntegrationMiddleware, createTimer, logBusinessOperation, logSecurityEvent, logUserActivity } from '@/lib/logging/log-integration-middleware';

// Mock dependencies
jest.mock('@/lib/logging/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock('@/lib/logging/log-manager', () => ({
  logManager: {
    processLogEntry: jest.fn(),
    getConfiguration: jest.fn(() => ({
      rotation: { maxFileSize: 100000000, maxFiles: 10 },
      retention: { retentionDays: 30 },
      aggregation: { enabled: true },
    })),
  },
}));

jest.mock('@/lib/logging/log-aggregator', () => ({
  logAggregator: {
    addLogEntry: jest.fn(),
    getStatistics: jest.fn(() => ({
      totalEntries: 100,
      totalPatterns: 5,
      activePatterns: 4,
      patternMatches: 10,
    })),
  },
}));

describe('LogIntegrationMiddleware', () => {
  const mockLogManager = require('@/lib/logging/log-manager').logManager;
  const mockLogAggregator = require('@/lib/logging/log-aggregator').logAggregator;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Ensure auto capture is enabled for tests
    LogIntegrationMiddleware.configure({
      enableAutoCapture: true,
      captureApiRequests: true,
      captureErrors: true,
      capturePerformance: true,
    });
  });

  describe('Configuration', () => {
    it('should configure middleware settings', () => {
      const config = {
        enableAutoCapture: false,
        captureApiRequests: false,
        maxLogEntrySize: 5000,
      };

      LogIntegrationMiddleware.configure(config);
      const currentConfig = LogIntegrationMiddleware.getConfiguration();

      expect(currentConfig.enableAutoCapture).toBe(false);
      expect(currentConfig.captureApiRequests).toBe(false);
      expect(currentConfig.maxLogEntrySize).toBe(5000);
    });

    it('should get current configuration', () => {
      const config = LogIntegrationMiddleware.getConfiguration();

      expect(config).toHaveProperty('enableAutoCapture');
      expect(config).toHaveProperty('captureApiRequests');
      expect(config).toHaveProperty('captureErrors');
      expect(config).toHaveProperty('capturePerformance');
      expect(config).toHaveProperty('excludePaths');
      expect(config).toHaveProperty('maxLogEntrySize');
    });
  });

  describe('Performance Timer', () => {
    it('should create and use performance timer', () => {
      const timer = LogIntegrationMiddleware.createTimer('test_operation', 'test_component');
      
      // Simulate some work
      setTimeout(() => {
        const duration = timer.end({ testData: 'value' });
        expect(typeof duration).toBe('number');
        expect(duration).toBeGreaterThanOrEqual(0);
      }, 10);
    });
  });

  describe('Business Operation Logging', () => {
    it('should log business operations', () => {
      LogIntegrationMiddleware.logBusinessOperation('create_ticket', 'ticket', 'ticket123', 'user456', {
        priority: 'high',
        category: 'technical',
      });

      expect(mockLogAggregator.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'INFO',
          message: 'Business Operation: create_ticket on ticket',
          component: 'business',
          operation: 'business_operation',
          userId: 'user456',
          metadata: expect.objectContaining({
            businessOperation: 'create_ticket',
            entityType: 'ticket',
            entityId: 'ticket123',
            priority: 'high',
            category: 'technical',
          }),
        })
      );

      expect(mockLogManager.processLogEntry).toHaveBeenCalled();
    });
  });

  describe('Security Event Logging', () => {
    it('should log security events', () => {
      LogIntegrationMiddleware.logSecurityEvent('failed_login', 'high', {
        ip: '192.168.1.100',
        attempts: 3,
      }, 'user123');

      expect(mockLogAggregator.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'ERROR',
          message: 'Security Event: failed_login',
          component: 'security',
          operation: 'security_event',
          userId: 'user123',
          metadata: expect.objectContaining({
            event: 'failed_login',
            severity: 'high',
            ip: '192.168.1.100',
            attempts: 3,
          }),
        })
      );

      expect(mockLogManager.processLogEntry).toHaveBeenCalled();
    });

    it('should use appropriate log level based on severity', () => {
      // Test low severity
      LogIntegrationMiddleware.logSecurityEvent('low_event', 'low', {});
      expect(mockLogAggregator.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'INFO' })
      );

      // Test medium severity
      LogIntegrationMiddleware.logSecurityEvent('medium_event', 'medium', {});
      expect(mockLogAggregator.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'WARN' })
      );

      // Test high severity
      LogIntegrationMiddleware.logSecurityEvent('high_event', 'high', {});
      expect(mockLogAggregator.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'ERROR' })
      );

      // Test critical severity
      LogIntegrationMiddleware.logSecurityEvent('critical_event', 'critical', {});
      expect(mockLogAggregator.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'ERROR' })
      );
    });
  });

  describe('User Activity Logging', () => {
    it('should log user activities', () => {
      LogIntegrationMiddleware.logUserActivity('user789', 'login', {
        loginMethod: 'credentials',
        success: true,
      });

      expect(mockLogAggregator.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'INFO',
          message: 'User Activity: login',
          component: 'user',
          operation: 'user_activity',
          userId: 'user789',
          metadata: expect.objectContaining({
            activity: 'login',
            loginMethod: 'credentials',
            success: true,
          }),
        })
      );

      expect(mockLogManager.processLogEntry).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should get integration statistics', () => {
      const stats = LogIntegrationMiddleware.getStatistics();

      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('aggregatorStats');
      expect(stats).toHaveProperty('managerConfig');

      expect(stats.config).toHaveProperty('enableAutoCapture');
      expect(stats.aggregatorStats).toHaveProperty('totalEntries');
    });
  });

  describe('Error Handling', () => {
    it('should handle processing errors gracefully', () => {
      // Mock aggregator to throw error
      mockLogAggregator.addLogEntry.mockImplementationOnce(() => {
        throw new Error('Processing failed');
      });

      // Should not throw
      expect(() => {
        LogIntegrationMiddleware.logBusinessOperation('test_op', 'test_entity', 'test_id');
      }).not.toThrow();

      // Should have attempted to log the error
      expect(require('@/lib/logging/logger').logger.error).toHaveBeenCalled();
    });

    it('should handle disabled auto capture', () => {
      LogIntegrationMiddleware.configure({ enableAutoCapture: false });

      LogIntegrationMiddleware.logBusinessOperation('test_op', 'test_entity', 'test_id');
      LogIntegrationMiddleware.logSecurityEvent('test_event', 'low', {});
      LogIntegrationMiddleware.logUserActivity('user123', 'test_activity');

      // Should not have processed any entries
      expect(mockLogAggregator.addLogEntry).not.toHaveBeenCalled();
      expect(mockLogManager.processLogEntry).not.toHaveBeenCalled();

      // Reset configuration
      LogIntegrationMiddleware.configure({ enableAutoCapture: true });
    });
  });

  describe('Log Entry Size Limits', () => {
    it('should handle large log entries', () => {
      // Configure small max size for testing
      LogIntegrationMiddleware.configure({ maxLogEntrySize: 100 });

      const largeMetadata = {
        largeData: 'x'.repeat(1000), // Large string
      };

      LogIntegrationMiddleware.logBusinessOperation('test_op', 'test_entity', 'test_id', 'user123', largeMetadata);

      // Should have been called with truncated data
      expect(mockLogAggregator.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            truncated: true,
          }),
        })
      );

      // Reset configuration
      LogIntegrationMiddleware.configure({ maxLogEntrySize: 10000 });
    });
  });
});