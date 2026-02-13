/**
 * Log Manager Tests
 */

import { LogManager, LogAlert, LogAlertCondition, LogAlertAction } from '@/lib/logging/log-manager';

// Mock logger to avoid actual logging during tests
jest.mock('@/lib/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('LogManager', () => {
  let logManager: LogManager;

  beforeEach(() => {
    // Get fresh instance for each test
    logManager = LogManager.getInstance();
  });

  describe('Alert Management', () => {
    it('should add and retrieve alerts', () => {
      const initialAlertsCount = logManager.getAlerts().length;
      
      const alert: LogAlert = {
        id: 'test_alert',
        name: 'Test Alert',
        condition: {
          type: 'threshold',
          pattern: /ERROR/,
          threshold: 5,
          timeWindow: 300000,
        },
        actions: [
          {
            type: 'log',
            config: { level: 'error', message: 'Test alert triggered' },
          },
        ],
        enabled: true,
        cooldown: 600000,
      };

      logManager.addAlert(alert);
      const alerts = logManager.getAlerts();
      
      expect(alerts).toHaveLength(initialAlertsCount + 1);
      const addedAlert = alerts.find(a => a.id === 'test_alert');
      expect(addedAlert).toBeDefined();
      expect(addedAlert?.name).toBe('Test Alert');
      expect(addedAlert?.enabled).toBe(true);
    });

    it('should remove alerts', () => {
      const alert: LogAlert = {
        id: 'test_alert_remove',
        name: 'Test Alert',
        condition: {
          type: 'pattern',
          pattern: /ERROR/,
          timeWindow: 300000,
        },
        actions: [],
        enabled: true,
        cooldown: 600000,
      };

      const initialCount = logManager.getAlerts().length;
      logManager.addAlert(alert);
      expect(logManager.getAlerts()).toHaveLength(initialCount + 1);

      const removed = logManager.removeAlert('test_alert_remove');
      expect(removed).toBe(true);
      expect(logManager.getAlerts()).toHaveLength(initialCount);

      // Try to remove non-existent alert
      const notRemoved = logManager.removeAlert('non_existent');
      expect(notRemoved).toBe(false);
    });

    it('should toggle alert enabled state', () => {
      const alert: LogAlert = {
        id: 'test_alert_toggle',
        name: 'Test Alert',
        condition: {
          type: 'pattern',
          pattern: /ERROR/,
          timeWindow: 300000,
        },
        actions: [],
        enabled: true,
        cooldown: 600000,
      };

      logManager.addAlert(alert);
      
      // Disable alert
      const disabled = logManager.toggleAlert('test_alert_toggle', false);
      expect(disabled).toBe(true);
      const disabledAlert = logManager.getAlerts().find(a => a.id === 'test_alert_toggle');
      expect(disabledAlert?.enabled).toBe(false);

      // Enable alert
      const enabled = logManager.toggleAlert('test_alert_toggle', true);
      expect(enabled).toBe(true);
      const enabledAlert = logManager.getAlerts().find(a => a.id === 'test_alert_toggle');
      expect(enabledAlert?.enabled).toBe(true);

      // Try to toggle non-existent alert
      const notToggled = logManager.toggleAlert('non_existent', false);
      expect(notToggled).toBe(false);
      
      // Cleanup
      logManager.removeAlert('test_alert_toggle');
    });
  });

  describe('Log Processing', () => {
    it('should process log entries for aggregation', () => {
      const logEntry = {
        id: 'test_log_1',
        timestamp: new Date(),
        level: 'ERROR',
        message: 'Test error message',
        component: 'test',
        operation: 'test_operation',
        metadata: { duration: 150 },
      };

      // This should not throw
      expect(() => {
        logManager.processLogEntry(logEntry);
      }).not.toThrow();
    });

    it('should trigger pattern-based alerts', () => {
      const alert: LogAlert = {
        id: 'pattern_alert_test',
        name: 'Pattern Alert',
        condition: {
          type: 'pattern',
          pattern: /Database.*Error/i,
          timeWindow: 300000,
        },
        actions: [
          {
            type: 'log',
            config: { level: 'error', message: 'Database error detected' },
          },
        ],
        enabled: true,
        cooldown: 60000,
      };

      logManager.addAlert(alert);

      const logEntry = {
        id: 'test_log_1',
        timestamp: new Date(),
        level: 'ERROR',
        message: 'Database connection error occurred',
        component: 'database',
        operation: 'connect',
      };

      // Process log entry - should trigger alert
      logManager.processLogEntry(logEntry);

      // Check that alert was triggered (lastTriggered should be set)
      const alerts = logManager.getAlerts();
      const triggeredAlert = alerts.find(a => a.id === 'pattern_alert_test');
      expect(triggeredAlert?.lastTriggered).toBeDefined();
      
      // Cleanup
      logManager.removeAlert('pattern_alert_test');
    });
  });

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = logManager.getConfiguration();
      
      expect(config).toHaveProperty('rotation');
      expect(config).toHaveProperty('retention');
      expect(config).toHaveProperty('aggregation');
      
      expect(config.rotation).toHaveProperty('maxFileSize');
      expect(config.rotation).toHaveProperty('maxFiles');
      expect(config.retention).toHaveProperty('retentionDays');
      expect(config.aggregation).toHaveProperty('enabled');
    });

    it('should update configuration', () => {
      const newConfig = {
        rotation: {
          maxFileSize: 200 * 1024 * 1024, // 200MB
          maxFiles: 15,
        },
        retention: {
          retentionDays: 60,
        },
        aggregation: {
          enabled: false,
        },
      };

      logManager.updateConfiguration(newConfig);
      const config = logManager.getConfiguration();

      expect(config.rotation.maxFileSize).toBe(200 * 1024 * 1024);
      expect(config.rotation.maxFiles).toBe(15);
      expect(config.retention.retentionDays).toBe(60);
      expect(config.aggregation.enabled).toBe(false);
    });
  });

  describe('Log Metrics', () => {
    it('should generate log metrics', () => {
      const timeRange = {
        start: new Date(Date.now() - 3600000), // 1 hour ago
        end: new Date(),
      };

      const metrics = logManager.getLogMetrics(timeRange);

      expect(metrics).toHaveProperty('totalLogs');
      expect(metrics).toHaveProperty('logsByLevel');
      expect(metrics).toHaveProperty('logsByComponent');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('topErrors');
      expect(metrics).toHaveProperty('timeRange');

      expect(metrics.timeRange.start).toEqual(timeRange.start);
      expect(metrics.timeRange.end).toEqual(timeRange.end);
      expect(typeof metrics.totalLogs).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
      expect(Array.isArray(metrics.topErrors)).toBe(true);
    });

    it('should use default time range when none provided', () => {
      const metrics = logManager.getLogMetrics();
      
      expect(metrics.timeRange).toBeDefined();
      expect(metrics.timeRange.start).toBeInstanceOf(Date);
      expect(metrics.timeRange.end).toBeInstanceOf(Date);
      expect(metrics.timeRange.end.getTime() - metrics.timeRange.start.getTime()).toBe(3600000); // 1 hour
    });
  });

  describe('Default Alerts', () => {
    it('should have default alerts configured', () => {
      // Create a new instance to get default alerts
      const freshLogManager = LogManager.getInstance();
      const alerts = freshLogManager.getAlerts();

      // Should have some default alerts
      expect(alerts.length).toBeGreaterThan(0);

      // Check for specific default alerts
      const alertIds = alerts.map(alert => alert.id);
      expect(alertIds).toContain('high_error_rate');
      expect(alertIds).toContain('failed_auth_attempts');
      expect(alertIds).toContain('slow_api_responses');
      expect(alertIds).toContain('db_connection_errors');
    });

    it('should have properly configured default alerts', () => {
      const alerts = logManager.getAlerts();
      
      for (const alert of alerts) {
        expect(alert.id).toBeDefined();
        expect(alert.name).toBeDefined();
        expect(alert.condition).toBeDefined();
        expect(alert.actions).toBeDefined();
        expect(Array.isArray(alert.actions)).toBe(true);
        expect(typeof alert.enabled).toBe('boolean');
        expect(typeof alert.cooldown).toBe('number');
        expect(alert.cooldown).toBeGreaterThan(0);
      }
    });
  });

  describe('Alert Actions', () => {
    it('should execute log actions', () => {
      const alert: LogAlert = {
        id: 'log_action_alert',
        name: 'Log Action Alert',
        condition: {
          type: 'pattern',
          pattern: /TEST_TRIGGER/,
          timeWindow: 300000,
        },
        actions: [
          {
            type: 'log',
            config: { level: 'warn', message: 'Test alert action executed' },
          },
        ],
        enabled: true,
        cooldown: 1000, // Short cooldown for testing
      };

      logManager.addAlert(alert);

      const logEntry = {
        id: 'test_log_1',
        timestamp: new Date(),
        level: 'INFO',
        message: 'TEST_TRIGGER message',
        component: 'test',
      };

      // Process log entry - should trigger alert and execute action
      logManager.processLogEntry(logEntry);

      // Verify alert was triggered
      const alerts = logManager.getAlerts();
      const triggeredAlert = alerts.find(a => a.id === 'log_action_alert');
      expect(triggeredAlert?.lastTriggered).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid alert configurations gracefully', () => {
      // This should not throw even with invalid data
      expect(() => {
        logManager.processLogEntry({
          id: 'invalid_log',
          timestamp: new Date(),
          level: 'ERROR',
          message: null as any, // Invalid message
        });
      }).not.toThrow();
    });

    it('should handle missing log entry properties', () => {
      expect(() => {
        logManager.processLogEntry({
          id: 'minimal_log',
          timestamp: new Date(),
          level: 'INFO',
          message: 'Minimal log entry',
          // Missing optional properties
        });
      }).not.toThrow();
    });
  });
});