/**
 * Log Aggregation Service
 * 
 * Handles log aggregation, search, and analysis
 */

import { logger, LogContext } from './logger';
import { loggingConfig } from './config';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: string;
  message: string;
  component?: string;
  operation?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LogSearchQuery {
  startDate?: Date;
  endDate?: Date;
  levels?: string[];
  components?: string[];
  operations?: string[];
  userId?: string;
  requestId?: string;
  searchText?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'level' | 'component';
  sortOrder?: 'asc' | 'desc';
}

export interface LogSearchResult {
  entries: LogEntry[];
  total: number;
  hasMore: boolean;
  aggregations: {
    byLevel: Record<string, number>;
    byComponent: Record<string, number>;
    byOperation: Record<string, number>;
    timeDistribution: Array<{ timestamp: Date; count: number }>;
  };
}

export interface LogPattern {
  id: string;
  name: string;
  pattern: RegExp;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  matches: number;
  lastMatch?: Date;
}

export interface LogAnalysis {
  totalEntries: number;
  timeRange: { start: Date; end: Date };
  levelDistribution: Record<string, number>;
  componentDistribution: Record<string, number>;
  errorPatterns: LogPattern[];
  performanceMetrics: {
    averageResponseTime: number;
    slowestOperations: Array<{
      operation: string;
      averageTime: number;
      count: number;
    }>;
  };
  securityEvents: {
    failedLogins: number;
    suspiciousActivity: number;
    securityAlerts: number;
  };
  recommendations: string[];
}

export class LogAggregator {
  private static instance: LogAggregator;
  private logEntries: Map<string, LogEntry> = new Map();
  private patterns: Map<string, LogPattern> = new Map();
  private maxEntries: number = 100000; // Keep last 100k entries in memory
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeDefaultPatterns();
    this.startCleanupProcess();
  }

  public static getInstance(): LogAggregator {
    if (!LogAggregator.instance) {
      LogAggregator.instance = new LogAggregator();
    }
    return LogAggregator.instance;
  }

  /**
   * Initialize default log patterns
   */
  private initializeDefaultPatterns(): void {
    const defaultPatterns: Omit<LogPattern, 'matches' | 'lastMatch'>[] = [
      {
        id: 'sql_injection_attempt',
        name: 'SQL Injection Attempt',
        pattern: /(union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+set)/i,
        description: 'Potential SQL injection attempt detected',
        severity: 'critical',
        enabled: true,
      },
      {
        id: 'authentication_failure',
        name: 'Authentication Failure',
        pattern: /authentication\s+(failed|error|denied)/i,
        description: 'Authentication failure detected',
        severity: 'medium',
        enabled: true,
      },
      {
        id: 'database_connection_error',
        name: 'Database Connection Error',
        pattern: /(database|connection).*(error|failed|timeout|refused)/i,
        description: 'Database connection issues detected',
        severity: 'high',
        enabled: true,
      },
      {
        id: 'memory_leak_warning',
        name: 'Memory Leak Warning',
        pattern: /(memory|heap).*(leak|exceeded|out of memory)/i,
        description: 'Potential memory leak or high memory usage',
        severity: 'high',
        enabled: true,
      },
      {
        id: 'slow_query',
        name: 'Slow Database Query',
        pattern: /query.*took.*(\d{3,})\s*ms/i,
        description: 'Slow database query detected (>100ms)',
        severity: 'medium',
        enabled: true,
      },
      {
        id: 'api_rate_limit',
        name: 'API Rate Limit Exceeded',
        pattern: /rate\s+limit.*(exceeded|reached|blocked)/i,
        description: 'API rate limit exceeded',
        severity: 'medium',
        enabled: true,
      },
      {
        id: 'file_upload_error',
        name: 'File Upload Error',
        pattern: /(file|upload).*(error|failed|rejected|too large)/i,
        description: 'File upload error detected',
        severity: 'low',
        enabled: true,
      },
      {
        id: 'csrf_token_mismatch',
        name: 'CSRF Token Mismatch',
        pattern: /csrf.*(token|mismatch|invalid|missing)/i,
        description: 'CSRF token validation failure',
        severity: 'high',
        enabled: true,
      },
    ];

    for (const patternData of defaultPatterns) {
      this.patterns.set(patternData.id, {
        ...patternData,
        matches: 0,
      });
    }
  }

  /**
   * Add a log entry for aggregation
   */
  public addLogEntry(entry: LogEntry): void {
    // Store the entry
    this.logEntries.set(entry.id, entry);

    // Check against patterns
    this.checkPatterns(entry);

    // Cleanup if we exceed max entries
    if (this.logEntries.size > this.maxEntries) {
      this.cleanupOldEntries();
    }
  }

  /**
   * Check log entry against patterns
   */
  private checkPatterns(entry: LogEntry): void {
    const message = entry.message.toLowerCase();
    const now = new Date();

    for (const pattern of this.patterns.values()) {
      if (pattern.enabled && pattern.pattern.test(message)) {
        pattern.matches++;
        pattern.lastMatch = now;

        // Log pattern match
        logger.warn(`Log pattern matched: ${pattern.name}`, {
          component: 'log-aggregator',
          operation: 'pattern_match',
          metadata: {
            patternId: pattern.id,
            patternName: pattern.name,
            severity: pattern.severity,
            originalEntry: entry,
          },
        });
      }
    }
  }

  /**
   * Search logs
   */
  public searchLogs(query: LogSearchQuery): LogSearchResult {
    const entries = Array.from(this.logEntries.values());
    let filteredEntries = entries;

    // Apply filters
    if (query.startDate) {
      filteredEntries = filteredEntries.filter(entry => entry.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      filteredEntries = filteredEntries.filter(entry => entry.timestamp <= query.endDate!);
    }

    if (query.levels && query.levels.length > 0) {
      filteredEntries = filteredEntries.filter(entry => query.levels!.includes(entry.level));
    }

    if (query.components && query.components.length > 0) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.component && query.components!.includes(entry.component)
      );
    }

    if (query.operations && query.operations.length > 0) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.operation && query.operations!.includes(entry.operation)
      );
    }

    if (query.userId) {
      filteredEntries = filteredEntries.filter(entry => entry.userId === query.userId);
    }

    if (query.requestId) {
      filteredEntries = filteredEntries.filter(entry => entry.requestId === query.requestId);
    }

    if (query.searchText) {
      const searchText = query.searchText.toLowerCase();
      filteredEntries = filteredEntries.filter(entry => 
        entry.message.toLowerCase().includes(searchText) ||
        (entry.component && entry.component.toLowerCase().includes(searchText)) ||
        (entry.operation && entry.operation.toLowerCase().includes(searchText))
      );
    }

    // Sort entries
    const sortBy = query.sortBy || 'timestamp';
    const sortOrder = query.sortOrder || 'desc';
    
    filteredEntries.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'timestamp':
          aValue = a.timestamp.getTime();
          bValue = b.timestamp.getTime();
          break;
        case 'level':
          aValue = a.level;
          bValue = b.level;
          break;
        case 'component':
          aValue = a.component || '';
          bValue = b.component || '';
          break;
        default:
          aValue = a.timestamp.getTime();
          bValue = b.timestamp.getTime();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Calculate aggregations
    const aggregations = this.calculateAggregations(filteredEntries);

    // Apply pagination
    const limit = query.limit || 100;
    const offset = query.offset || 0;
    const paginatedEntries = filteredEntries.slice(offset, offset + limit);

    return {
      entries: paginatedEntries,
      total: filteredEntries.length,
      hasMore: offset + limit < filteredEntries.length,
      aggregations,
    };
  }

  /**
   * Calculate aggregations for search results
   */
  private calculateAggregations(entries: LogEntry[]) {
    const byLevel: Record<string, number> = {};
    const byComponent: Record<string, number> = {};
    const byOperation: Record<string, number> = {};
    const timeDistribution: Array<{ timestamp: Date; count: number }> = [];

    // Group by hour for time distribution
    const hourlyGroups: Record<string, number> = {};

    for (const entry of entries) {
      // Level aggregation
      byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;

      // Component aggregation
      if (entry.component) {
        byComponent[entry.component] = (byComponent[entry.component] || 0) + 1;
      }

      // Operation aggregation
      if (entry.operation) {
        byOperation[entry.operation] = (byOperation[entry.operation] || 0) + 1;
      }

      // Time distribution (hourly)
      const hourKey = new Date(entry.timestamp.getFullYear(), 
        entry.timestamp.getMonth(), 
        entry.timestamp.getDate(), 
        entry.timestamp.getHours()).toISOString();
      hourlyGroups[hourKey] = (hourlyGroups[hourKey] || 0) + 1;
    }

    // Convert hourly groups to time distribution array
    for (const [hourKey, count] of Object.entries(hourlyGroups)) {
      timeDistribution.push({
        timestamp: new Date(hourKey),
        count,
      });
    }

    // Sort time distribution by timestamp
    timeDistribution.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      byLevel,
      byComponent,
      byOperation,
      timeDistribution,
    };
  }

  /**
   * Analyze logs for insights
   */
  public analyzeLogs(timeRange?: { start: Date; end: Date }): LogAnalysis {
    const defaultTimeRange = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      end: new Date(),
    };

    const range = timeRange || defaultTimeRange;
    const entries = Array.from(this.logEntries.values())
      .filter(entry => entry.timestamp >= range.start && entry.timestamp <= range.end);

    // Basic statistics
    const levelDistribution: Record<string, number> = {};
    const componentDistribution: Record<string, number> = {};
    const responseTimes: number[] = [];
    const operationTimes: Record<string, number[]> = {};

    let failedLogins = 0;
    let suspiciousActivity = 0;
    let securityAlerts = 0;

    for (const entry of entries) {
      // Level distribution
      levelDistribution[entry.level] = (levelDistribution[entry.level] || 0) + 1;

      // Component distribution
      if (entry.component) {
        componentDistribution[entry.component] = (componentDistribution[entry.component] || 0) + 1;
      }

      // Performance metrics
      if (entry.metadata?.duration) {
        responseTimes.push(entry.metadata.duration);
        
        if (entry.operation) {
          if (!operationTimes[entry.operation]) {
            operationTimes[entry.operation] = [];
          }
          operationTimes[entry.operation].push(entry.metadata.duration);
        }
      }

      // Security events
      const message = entry.message.toLowerCase();
      if (message.includes('authentication failed')) {
        failedLogins++;
      }
      if (message.includes('suspicious') || message.includes('blocked')) {
        suspiciousActivity++;
      }
      if (entry.level === 'ERROR' && entry.component === 'security') {
        securityAlerts++;
      }
    }

    // Calculate performance metrics
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    const slowestOperations = Object.entries(operationTimes)
      .map(([operation, times]) => ({
        operation,
        averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
        count: times.length,
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);

    // Get active error patterns
    const errorPatterns = Array.from(this.patterns.values())
      .filter(pattern => pattern.matches > 0)
      .sort((a, b) => b.matches - a.matches);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      levelDistribution,
      componentDistribution,
      averageResponseTime,
      slowestOperations,
      failedLogins,
      suspiciousActivity,
      securityAlerts,
      errorPatterns,
    });

    return {
      totalEntries: entries.length,
      timeRange: range,
      levelDistribution,
      componentDistribution,
      errorPatterns,
      performanceMetrics: {
        averageResponseTime,
        slowestOperations,
      },
      securityEvents: {
        failedLogins,
        suspiciousActivity,
        securityAlerts,
      },
      recommendations,
    };
  }

  /**
   * Generate recommendations based on log analysis
   */
  private generateRecommendations(analysis: any): string[] {
    const recommendations: string[] = [];

    // Error rate recommendations
    const errorRate = (analysis.levelDistribution.ERROR || 0) / 
      Object.values(analysis.levelDistribution).reduce((sum: number, count: unknown) => sum + (count as number), 0);
    
    if (errorRate > 0.05) { // More than 5% errors
      recommendations.push('High error rate detected. Consider investigating error patterns and implementing better error handling.');
    }

    // Performance recommendations
    if (analysis.averageResponseTime > 1000) { // More than 1 second
      recommendations.push('Average response time is high. Consider optimizing slow operations and implementing caching.');
    }

    if (analysis.slowestOperations.length > 0 && analysis.slowestOperations[0].averageTime > 2000) {
      recommendations.push(`Slowest operation "${analysis.slowestOperations[0].operation}" takes ${analysis.slowestOperations[0].averageTime}ms on average. Consider optimization.`);
    }

    // Security recommendations
    if (analysis.failedLogins > 10) {
      recommendations.push('High number of failed login attempts detected. Consider implementing account lockout or CAPTCHA.');
    }

    if (analysis.suspiciousActivity > 5) {
      recommendations.push('Suspicious activity detected. Review security logs and consider strengthening security measures.');
    }

    if (analysis.securityAlerts > 0) {
      recommendations.push('Security alerts detected. Immediate investigation recommended.');
    }

    // Pattern-based recommendations
    for (const pattern of analysis.errorPatterns) {
      if (pattern.severity === 'critical' && pattern.matches > 0) {
        recommendations.push(`Critical security pattern "${pattern.name}" detected ${pattern.matches} times. Immediate action required.`);
      }
    }

    return recommendations;
  }

  /**
   * Get log patterns
   */
  public getPatterns(): LogPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Add or update a log pattern
   */
  public addPattern(pattern: Omit<LogPattern, 'matches' | 'lastMatch'>): void {
    this.patterns.set(pattern.id, {
      ...pattern,
      matches: 0,
    });

    logger.info(`Log pattern added: ${pattern.name}`, {
      component: 'log-aggregator',
      operation: 'add_pattern',
      metadata: { patternId: pattern.id, patternName: pattern.name },
    });
  }

  /**
   * Remove a log pattern
   */
  public removePattern(patternId: string): boolean {
    const removed = this.patterns.delete(patternId);
    if (removed) {
      logger.info(`Log pattern removed: ${patternId}`, {
        component: 'log-aggregator',
        operation: 'remove_pattern',
        metadata: { patternId },
      });
    }
    return removed;
  }

  /**
   * Toggle pattern enabled state
   */
  public togglePattern(patternId: string, enabled: boolean): boolean {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.enabled = enabled;
      logger.info(`Log pattern ${enabled ? 'enabled' : 'disabled'}: ${patternId}`, {
        component: 'log-aggregator',
        operation: 'toggle_pattern',
        metadata: { patternId, enabled },
      });
      return true;
    }
    return false;
  }

  /**
   * Clean up old entries
   */
  private cleanupOldEntries(): void {
    const entries = Array.from(this.logEntries.entries());
    
    // Sort by timestamp (oldest first)
    entries.sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Remove oldest entries to get back to max size
    const toRemove = entries.length - this.maxEntries + 1000; // Remove extra 1000 to avoid frequent cleanup
    
    for (let i = 0; i < toRemove; i++) {
      this.logEntries.delete(entries[i][0]);
    }

    logger.debug(`Cleaned up ${toRemove} old log entries`, {
      component: 'log-aggregator',
      operation: 'cleanup_entries',
      metadata: { removedCount: toRemove, remainingCount: this.logEntries.size },
    });
  }

  /**
   * Start cleanup process
   */
  private startCleanupProcess(): void {
    // Clean up old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      let removedCount = 0;

      for (const [id, entry] of this.logEntries.entries()) {
        if (entry.timestamp < cutoffTime) {
          this.logEntries.delete(id);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        logger.debug(`Cleaned up ${removedCount} expired log entries`, {
          component: 'log-aggregator',
          operation: 'cleanup_expired',
          metadata: { removedCount, remainingCount: this.logEntries.size },
        });
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop cleanup process
   */
  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get statistics
   */
  public getStatistics() {
    return {
      totalEntries: this.logEntries.size,
      totalPatterns: this.patterns.size,
      activePatterns: Array.from(this.patterns.values()).filter(p => p.enabled).length,
      patternMatches: Array.from(this.patterns.values()).reduce((sum, p) => sum + p.matches, 0),
      oldestEntry: this.logEntries.size > 0 
        ? Math.min(...Array.from(this.logEntries.values()).map(e => e.timestamp.getTime()))
        : null,
      newestEntry: this.logEntries.size > 0 
        ? Math.max(...Array.from(this.logEntries.values()).map(e => e.timestamp.getTime()))
        : null,
    };
  }
}

// Export singleton instance
export const logAggregator = LogAggregator.getInstance();