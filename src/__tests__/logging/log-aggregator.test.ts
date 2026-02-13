/**
 * Log Aggregator Tests
 */

import { LogAggregator, LogEntry, LogSearchQuery, LogPattern } from '@/lib/logging/log-aggregator';

// Mock logger to avoid actual logging during tests
jest.mock('@/lib/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('LogAggregator', () => {
  let logAggregator: LogAggregator;

  beforeEach(() => {
    logAggregator = LogAggregator.getInstance();
  });

  describe('Log Entry Management', () => {
    it('should add and store log entries', () => {
      const logEntry: LogEntry = {
        id: 'test_log_1',
        timestamp: new Date(),
        level: 'INFO',
        message: 'Test log message',
        component: 'test',
        operation: 'test_operation',
        userId: 'user123',
        requestId: 'req123',
        metadata: { duration: 100 },
      };

      expect(() => {
        logAggregator.addLogEntry(logEntry);
      }).not.toThrow();

      // Verify entry can be found in search
      const searchResult = logAggregator.searchLogs({
        searchText: 'Test log message',
        limit: 10,
      });

      expect(searchResult.entries.length).toBeGreaterThan(0);
      expect(searchResult.entries[0].message).toBe('Test log message');
    });

    it('should handle log entries with errors', () => {
      const logEntry: LogEntry = {
        id: 'error_log_1',
        timestamp: new Date(),
        level: 'ERROR',
        message: 'An error occurred',
        component: 'api',
        error: {
          name: 'ValidationError',
          message: 'Invalid input data',
          stack: 'Error stack trace...',
        },
      };

      expect(() => {
        logAggregator.addLogEntry(logEntry);
      }).not.toThrow();
    });
  });

  describe('Log Search', () => {
    beforeEach(() => {
      // Add test log entries
      const testEntries: LogEntry[] = [
        {
          id: 'log_1',
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
          level: 'INFO',
          message: 'User login successful',
          component: 'auth',
          operation: 'login',
          userId: 'user123',
        },
        {
          id: 'log_2',
          timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
          level: 'ERROR',
          message: 'Database connection failed',
          component: 'database',
          operation: 'connect',
        },
        {
          id: 'log_3',
          timestamp: new Date(Date.now() - 900000), // 15 minutes ago
          level: 'WARN',
          message: 'API rate limit exceeded',
          component: 'api',
          operation: 'rate_limit',
          userId: 'user456',
        },
      ];

      for (const entry of testEntries) {
        logAggregator.addLogEntry(entry);
      }
    });

    it('should search logs by level', () => {
      const searchResult = logAggregator.searchLogs({
        levels: ['ERROR'],
        limit: 10,
      });

      expect(searchResult.entries.length).toBeGreaterThan(0);
      for (const entry of searchResult.entries) {
        expect(entry.level).toBe('ERROR');
      }
    });

    it('should search logs by component', () => {
      const searchResult = logAggregator.searchLogs({
        components: ['auth'],
        limit: 10,
      });

      expect(searchResult.entries.length).toBeGreaterThan(0);
      for (const entry of searchResult.entries) {
        expect(entry.component).toBe('auth');
      }
    });

    it('should search logs by text', () => {
      const searchResult = logAggregator.searchLogs({
        searchText: 'login',
        limit: 10,
      });

      expect(searchResult.entries.length).toBeGreaterThan(0);
      expect(searchResult.entries[0].message).toContain('login');
    });

    it('should search logs by user ID', () => {
      const searchResult = logAggregator.searchLogs({
        userId: 'user123',
        limit: 10,
      });

      expect(searchResult.entries.length).toBeGreaterThan(0);
      for (const entry of searchResult.entries) {
        expect(entry.userId).toBe('user123');
      }
    });

    it('should search logs by time range', () => {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 2700000); // 45 minutes ago

      const searchResult = logAggregator.searchLogs({
        startDate: startTime,
        endDate: endTime,
        limit: 10,
      });

      for (const entry of searchResult.entries) {
        expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
        expect(entry.timestamp.getTime()).toBeLessThanOrEqual(endTime.getTime());
      }
    });

    it('should sort search results', () => {
      const searchResult = logAggregator.searchLogs({
        sortBy: 'timestamp',
        sortOrder: 'asc',
        limit: 10,
      });

      if (searchResult.entries.length > 1) {
        for (let i = 1; i < searchResult.entries.length; i++) {
          expect(searchResult.entries[i].timestamp.getTime())
            .toBeGreaterThanOrEqual(searchResult.entries[i - 1].timestamp.getTime());
        }
      }
    });

    it('should paginate search results', () => {
      const firstPage = logAggregator.searchLogs({
        limit: 2,
        offset: 0,
      });

      const secondPage = logAggregator.searchLogs({
        limit: 2,
        offset: 2,
      });

      expect(firstPage.entries.length).toBeLessThanOrEqual(2);
      expect(secondPage.entries.length).toBeLessThanOrEqual(2);

      // Entries should be different
      if (firstPage.entries.length > 0 && secondPage.entries.length > 0) {
        expect(firstPage.entries[0].id).not.toBe(secondPage.entries[0].id);
      }
    });

    it('should provide aggregations in search results', () => {
      const searchResult = logAggregator.searchLogs({
        limit: 10,
      });

      expect(searchResult.aggregations).toBeDefined();
      expect(searchResult.aggregations.byLevel).toBeDefined();
      expect(searchResult.aggregations.byComponent).toBeDefined();
      expect(searchResult.aggregations.byOperation).toBeDefined();
      expect(searchResult.aggregations.timeDistribution).toBeDefined();
      expect(Array.isArray(searchResult.aggregations.timeDistribution)).toBe(true);
    });
  });

  describe('Pattern Management', () => {
    it('should add custom patterns', () => {
      const pattern: Omit<LogPattern, 'matches' | 'lastMatch'> = {
        id: 'custom_pattern',
        name: 'Custom Pattern',
        pattern: /CUSTOM_ERROR/,
        description: 'Custom error pattern for testing',
        severity: 'medium',
        enabled: true,
      };

      logAggregator.addPattern(pattern);
      const patterns = logAggregator.getPatterns();
      
      const addedPattern = patterns.find(p => p.id === 'custom_pattern');
      expect(addedPattern).toBeDefined();
      expect(addedPattern?.name).toBe('Custom Pattern');
      expect(addedPattern?.enabled).toBe(true);
      expect(addedPattern?.matches).toBe(0);
    });

    it('should remove patterns', () => {
      const pattern: Omit<LogPattern, 'matches' | 'lastMatch'> = {
        id: 'removable_pattern',
        name: 'Removable Pattern',
        pattern: /REMOVABLE/,
        description: 'Pattern to be removed',
        severity: 'low',
        enabled: true,
      };

      logAggregator.addPattern(pattern);
      expect(logAggregator.getPatterns().find(p => p.id === 'removable_pattern')).toBeDefined();

      const removed = logAggregator.removePattern('removable_pattern');
      expect(removed).toBe(true);
      expect(logAggregator.getPatterns().find(p => p.id === 'removable_pattern')).toBeUndefined();

      // Try to remove non-existent pattern
      const notRemoved = logAggregator.removePattern('non_existent');
      expect(notRemoved).toBe(false);
    });

    it('should toggle pattern enabled state', () => {
      const pattern: Omit<LogPattern, 'matches' | 'lastMatch'> = {
        id: 'toggleable_pattern',
        name: 'Toggleable Pattern',
        pattern: /TOGGLEABLE/,
        description: 'Pattern to be toggled',
        severity: 'medium',
        enabled: true,
      };

      logAggregator.addPattern(pattern);
      
      // Disable pattern
      const disabled = logAggregator.togglePattern('toggleable_pattern', false);
      expect(disabled).toBe(true);
      
      const disabledPattern = logAggregator.getPatterns().find(p => p.id === 'toggleable_pattern');
      expect(disabledPattern?.enabled).toBe(false);

      // Enable pattern
      const enabled = logAggregator.togglePattern('toggleable_pattern', true);
      expect(enabled).toBe(true);
      
      const enabledPattern = logAggregator.getPatterns().find(p => p.id === 'toggleable_pattern');
      expect(enabledPattern?.enabled).toBe(true);
    });

    it('should match patterns in log entries', () => {
      const pattern: Omit<LogPattern, 'matches' | 'lastMatch'> = {
        id: 'match_test_pattern_unique',
        name: 'Match Test Pattern',
        pattern: /match_test_unique/i, // Case insensitive
        description: 'Pattern for testing matches',
        severity: 'high',
        enabled: true,
      };

      logAggregator.addPattern(pattern);

      const logEntry: LogEntry = {
        id: 'match_test_log',
        timestamp: new Date(),
        level: 'ERROR',
        message: 'MATCH_TEST_UNIQUE error occurred',
        component: 'test',
      };

      logAggregator.addLogEntry(logEntry);

      // Check that pattern was matched
      const patterns = logAggregator.getPatterns();
      const matchedPattern = patterns.find(p => p.id === 'match_test_pattern_unique');
      expect(matchedPattern?.matches).toBeGreaterThan(0);
      expect(matchedPattern?.lastMatch).toBeDefined();
      
      // Cleanup
      logAggregator.removePattern('match_test_pattern_unique');
    });
  });

  describe('Log Analysis', () => {
    beforeEach(() => {
      // Add test data for analysis
      const testEntries: LogEntry[] = [
        {
          id: 'analysis_log_1',
          timestamp: new Date(Date.now() - 3600000),
          level: 'INFO',
          message: 'API Request Completed: GET /api/users - 200',
          component: 'api',
          operation: 'api_request',
          metadata: { duration: 150 },
        },
        {
          id: 'analysis_log_2',
          timestamp: new Date(Date.now() - 3000000),
          level: 'ERROR',
          message: 'Authentication Failed: invalid credentials',
          component: 'auth',
          operation: 'authentication',
        },
        {
          id: 'analysis_log_3',
          timestamp: new Date(Date.now() - 2400000),
          level: 'WARN',
          message: 'API Request Completed: POST /api/tickets - 500',
          component: 'api',
          operation: 'api_request',
          metadata: { duration: 2500 },
        },
        {
          id: 'analysis_log_4',
          timestamp: new Date(Date.now() - 1800000),
          level: 'ERROR',
          message: 'Database connection error',
          component: 'database',
          operation: 'connect',
        },
      ];

      for (const entry of testEntries) {
        logAggregator.addLogEntry(entry);
      }
    });

    it('should analyze logs and provide insights', () => {
      const analysis = logAggregator.analyzeLogs();

      expect(analysis).toBeDefined();
      expect(analysis.totalEntries).toBeGreaterThan(0);
      expect(analysis.timeRange).toBeDefined();
      expect(analysis.levelDistribution).toBeDefined();
      expect(analysis.componentDistribution).toBeDefined();
      expect(analysis.errorPatterns).toBeDefined();
      expect(analysis.performanceMetrics).toBeDefined();
      expect(analysis.securityEvents).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
      expect(Array.isArray(analysis.recommendations)).toBe(true);
    });

    it('should analyze logs for specific time range', () => {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 3600000); // 1 hour ago

      const analysis = logAggregator.analyzeLogs({ start: startTime, end: endTime });

      expect(analysis.timeRange.start).toEqual(startTime);
      expect(analysis.timeRange.end).toEqual(endTime);
    });

    it('should provide performance metrics', () => {
      const analysis = logAggregator.analyzeLogs();

      expect(analysis.performanceMetrics.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(analysis.performanceMetrics.slowestOperations)).toBe(true);
    });

    it('should provide security event counts', () => {
      const analysis = logAggregator.analyzeLogs();

      expect(typeof analysis.securityEvents.failedLogins).toBe('number');
      expect(typeof analysis.securityEvents.suspiciousActivity).toBe('number');
      expect(typeof analysis.securityEvents.securityAlerts).toBe('number');
    });

    it('should generate recommendations', () => {
      const analysis = logAggregator.analyzeLogs();

      expect(Array.isArray(analysis.recommendations)).toBe(true);
      // Should have recommendations based on the test data
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should provide aggregator statistics', () => {
      const stats = logAggregator.getStatistics();

      expect(stats).toBeDefined();
      expect(typeof stats.totalEntries).toBe('number');
      expect(typeof stats.totalPatterns).toBe('number');
      expect(typeof stats.activePatterns).toBe('number');
      expect(typeof stats.patternMatches).toBe('number');
      expect(stats.totalEntries).toBeGreaterThanOrEqual(0);
      expect(stats.totalPatterns).toBeGreaterThan(0); // Should have default patterns
    });
  });

  describe('Default Patterns', () => {
    it('should have default patterns configured', () => {
      const patterns = logAggregator.getPatterns();

      expect(patterns.length).toBeGreaterThan(0);

      // Check for specific default patterns
      const patternIds = patterns.map(p => p.id);
      expect(patternIds).toContain('sql_injection_attempt');
      expect(patternIds).toContain('authentication_failure');
      expect(patternIds).toContain('database_connection_error');
    });

    it('should have properly configured default patterns', () => {
      const patterns = logAggregator.getPatterns();

      for (const pattern of patterns) {
        expect(pattern.id).toBeDefined();
        expect(pattern.name).toBeDefined();
        expect(pattern.pattern).toBeInstanceOf(RegExp);
        expect(pattern.description).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(pattern.severity);
        expect(typeof pattern.enabled).toBe('boolean');
        expect(typeof pattern.matches).toBe('number');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid log entries gracefully', () => {
      expect(() => {
        logAggregator.addLogEntry({
          id: 'invalid_log',
          timestamp: new Date(),
          level: 'INFO',
          message: '', // Empty message
        });
      }).not.toThrow();
    });

    it('should handle empty search queries', () => {
      const searchResult = logAggregator.searchLogs({});
      
      expect(searchResult).toBeDefined();
      expect(searchResult.entries).toBeDefined();
      expect(searchResult.total).toBeGreaterThanOrEqual(0);
      expect(searchResult.aggregations).toBeDefined();
    });

    it('should handle invalid search parameters', () => {
      expect(() => {
        logAggregator.searchLogs({
          limit: -1, // Invalid limit
          offset: -1, // Invalid offset
        });
      }).not.toThrow();
    });
  });
});