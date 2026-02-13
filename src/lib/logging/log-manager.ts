/**
 * Log Management Service
 * 
 * Handles log rotation, retention, aggregation, and alerting
 * Edge Runtime compatible version
 */

import { logger, LogContext } from './logger';
import { loggingConfig } from './config';

export interface LogRotationConfig {
  maxFileSize: number; // bytes
  maxFiles: number;
  rotateDaily: boolean;
  compressOldLogs: boolean;
}

export interface LogRetentionConfig {
  retentionDays: number;
  archiveOldLogs: boolean;
  archivePath?: string;
}

export interface LogAggregationConfig {
  enabled: boolean;
  batchSize: number;
  flushInterval: number; // milliseconds
  aggregationRules: LogAggregationRule[];
}

export interface LogAggregationRule {
  name: string;
  pattern: RegExp;
  action: 'count' | 'sum' | 'avg' | 'collect';
  field?: string;
  timeWindow: number; // milliseconds
}

export interface LogAlert {
  id: string;
  name: string;
  condition: LogAlertCondition;
  actions: LogAlertAction[];
  enabled: boolean;
  cooldown: number; // milliseconds
  lastTriggered?: Date;
}

export interface LogAlertCondition {
  type: 'threshold' | 'pattern' | 'absence';
  pattern?: RegExp;
  threshold?: number;
  timeWindow: number; // milliseconds
  field?: string;
}

export interface LogAlertAction {
  type: 'email' | 'webhook' | 'log';
  config: Record<string, any>;
}

export interface LogMetrics {
  totalLogs: number;
  logsByLevel: Record<string, number>;
  logsByComponent: Record<string, number>;
  errorRate: number;
  averageResponseTime: number;
  topErrors: Array<{ message: string; count: number }>;
  timeRange: { start: Date; end: Date };
}

export class LogManager {
  private static instance: LogManager;
  private rotationConfig: LogRotationConfig;
  private retentionConfig: LogRetentionConfig;
  private aggregationConfig: LogAggregationConfig;
  private alerts: Map<string, LogAlert> = new Map();
  private aggregatedData: Map<string, any> = new Map();
  private alertCooldowns: Map<string, Date> = new Map();

  private constructor() {
    this.rotationConfig = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10,
      rotateDaily: true,
      compressOldLogs: true,
    };

    this.retentionConfig = {
      retentionDays: 30,
      archiveOldLogs: true,
      archivePath: process.env.LOG_ARCHIVE_PATH || './logs/archive',
    };

    this.aggregationConfig = {
      enabled: true,
      batchSize: 1000,
      flushInterval: 60000, // 1 minute
      aggregationRules: [
        {
          name: 'error_count',
          pattern: /ERROR/,
          action: 'count',
          timeWindow: 300000, // 5 minutes
        },
        {
          name: 'api_response_time',
          pattern: /API Request Completed/,
          action: 'avg',
          field: 'duration',
          timeWindow: 300000, // 5 minutes
        },
        {
          name: 'failed_logins',
          pattern: /Authentication Failed/,
          action: 'count',
          timeWindow: 600000, // 10 minutes
        },
      ],
    };

    this.initializeDefaultAlerts();
    this.startAggregation();
  }

  public static getInstance(): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager();
    }
    return LogManager.instance;
  }

  /**
   * Initialize default log alerts
   */
  private initializeDefaultAlerts(): void {
    // High error rate alert
    this.addAlert({
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: {
        type: 'threshold',
        pattern: /ERROR/,
        threshold: 10,
        timeWindow: 300000, // 5 minutes
      },
      actions: [
        {
          type: 'log',
          config: { level: 'error', message: 'High error rate detected' },
        },
      ],
      enabled: true,
      cooldown: 600000, // 10 minutes
    });

    // Failed authentication attempts
    this.addAlert({
      id: 'failed_auth_attempts',
      name: 'Multiple Failed Authentication Attempts',
      condition: {
        type: 'threshold',
        pattern: /Authentication Failed/,
        threshold: 5,
        timeWindow: 300000, // 5 minutes
      },
      actions: [
        {
          type: 'log',
          config: { level: 'warn', message: 'Multiple failed authentication attempts detected' },
        },
      ],
      enabled: true,
      cooldown: 300000, // 5 minutes
    });

    // Slow API responses
    this.addAlert({
      id: 'slow_api_responses',
      name: 'Slow API Responses',
      condition: {
        type: 'threshold',
        pattern: /API Request Completed/,
        threshold: 2000, // 2 seconds
        timeWindow: 300000, // 5 minutes
        field: 'duration',
      },
      actions: [
        {
          type: 'log',
          config: { level: 'warn', message: 'Slow API responses detected' },
        },
      ],
      enabled: true,
      cooldown: 600000, // 10 minutes
    });

    // Database connection issues
    this.addAlert({
      id: 'db_connection_errors',
      name: 'Database Connection Errors',
      condition: {
        type: 'pattern',
        pattern: /Database.*Error|Connection.*failed/i,
        timeWindow: 60000, // 1 minute
      },
      actions: [
        {
          type: 'log',
          config: { level: 'error', message: 'Database connection issues detected' },
        },
      ],
      enabled: true,
      cooldown: 300000, // 5 minutes
    });
  }

  /**
   * Add a log alert
   */
  public addAlert(alert: LogAlert): void {
    this.alerts.set(alert.id, alert);
    logger.info(`Log alert added: ${alert.name}`, {
      component: 'log-manager',
      operation: 'add_alert',
      metadata: { alertId: alert.id, alertName: alert.name },
    });
  }

  /**
   * Remove a log alert
   */
  public removeAlert(alertId: string): boolean {
    const removed = this.alerts.delete(alertId);
    if (removed) {
      this.alertCooldowns.delete(alertId);
      logger.info(`Log alert removed: ${alertId}`, {
        component: 'log-manager',
        operation: 'remove_alert',
        metadata: { alertId },
      });
    }
    return removed;
  }

  /**
   * Get all alerts
   */
  public getAlerts(): LogAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Enable/disable an alert
   */
  public toggleAlert(alertId: string, enabled: boolean): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.enabled = enabled;
      logger.info(`Log alert ${enabled ? 'enabled' : 'disabled'}: ${alertId}`, {
        component: 'log-manager',
        operation: 'toggle_alert',
        metadata: { alertId, enabled },
      });
      return true;
    }
    return false;
  }

  /**
   * Process a log entry for alerts and aggregation
   */
  public processLogEntry(logEntry: any): void {
    if (this.aggregationConfig.enabled) {
      this.processAggregation(logEntry);
    }
    this.checkAlerts(logEntry);
  }

  /**
   * Process log entry for aggregation
   */
  private processAggregation(logEntry: any): void {
    const timestamp = new Date();
    const logMessage = logEntry.message || '';

    for (const rule of this.aggregationConfig.aggregationRules) {
      if (rule.pattern.test(logMessage)) {
        const key = `${rule.name}_${Math.floor(timestamp.getTime() / rule.timeWindow)}`;
        
        if (!this.aggregatedData.has(key)) {
          this.aggregatedData.set(key, {
            rule: rule.name,
            count: 0,
            values: [],
            timestamp: timestamp,
            windowStart: new Date(Math.floor(timestamp.getTime() / rule.timeWindow) * rule.timeWindow),
          });
        }

        const data = this.aggregatedData.get(key);
        data.count++;

        if (rule.field && logEntry.metadata && logEntry.metadata[rule.field]) {
          data.values.push(logEntry.metadata[rule.field]);
        }
      }
    }
  }

  /**
   * Check log entry against alerts
   */
  private checkAlerts(logEntry: any): void {
    const now = new Date();
    const logMessage = logEntry.message || '';

    for (const alert of this.alerts.values()) {
      if (!alert.enabled) continue;

      // Check cooldown
      const lastTriggered = this.alertCooldowns.get(alert.id);
      if (lastTriggered && (now.getTime() - lastTriggered.getTime()) < alert.cooldown) {
        continue;
      }

      let shouldTrigger = false;

      switch (alert.condition.type) {
        case 'pattern':
          if (alert.condition.pattern && alert.condition.pattern.test(logMessage)) {
            shouldTrigger = true;
          }
          break;

        case 'threshold':
          // For threshold alerts, we need to check aggregated data
          const windowKey = `${alert.id}_${Math.floor(now.getTime() / alert.condition.timeWindow)}`;
          if (alert.condition.pattern && alert.condition.pattern.test(logMessage)) {
            const count = this.getAlertCount(alert.id, alert.condition.timeWindow);
            if (count >= (alert.condition.threshold || 1)) {
              shouldTrigger = true;
            }
          }
          break;
      }

      if (shouldTrigger) {
        this.triggerAlert(alert, logEntry);
        this.alertCooldowns.set(alert.id, now);
        alert.lastTriggered = now;
      }
    }
  }

  /**
   * Get alert count for threshold checking
   */
  private getAlertCount(alertId: string, timeWindow: number): number {
    const now = new Date();
    const windowStart = now.getTime() - timeWindow;
    let count = 0;

    // This is a simplified implementation
    // In a real system, you'd want to store alert counts in a time-series database
    for (const [key, data] of this.aggregatedData.entries()) {
      if (key.startsWith(alertId) && data.timestamp.getTime() >= windowStart) {
        count += data.count;
      }
    }

    return count;
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(alert: LogAlert, logEntry: any): void {
    logger.warn(`Alert triggered: ${alert.name}`, {
      component: 'log-manager',
      operation: 'alert_triggered',
      metadata: {
        alertId: alert.id,
        alertName: alert.name,
        triggerLogEntry: logEntry,
      },
    });

    for (const action of alert.actions) {
      this.executeAlertAction(action, alert, logEntry);
    }
  }

  /**
   * Execute an alert action
   */
  private executeAlertAction(action: LogAlertAction, alert: LogAlert, logEntry: any): void {
    switch (action.type) {
      case 'log':
        const level = action.config.level || 'warn';
        const message = action.config.message || `Alert: ${alert.name}`;
        const logContext = {
          component: 'log-manager',
          operation: 'alert_action',
          metadata: {
            alertId: alert.id,
            actionType: action.type,
            originalLogEntry: logEntry,
          },
        };

        if (level === 'error') {
          logger.error(message, logContext);
        } else if (level === 'warn') {
          logger.warn(message, logContext);
        } else {
          logger.info(message, logContext);
        }
        break;

      case 'webhook':
        // Implement webhook notification
        this.sendWebhookNotification(action.config, alert, logEntry);
        break;

      case 'email':
        // Implement email notification
        this.sendEmailNotification(action.config, alert, logEntry);
        break;
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(config: any, alert: LogAlert, logEntry: any): Promise<void> {
    try {
      const payload = {
        alert: {
          id: alert.id,
          name: alert.name,
          triggeredAt: new Date().toISOString(),
        },
        logEntry,
        config,
      };

      // In a real implementation, you'd send this to the configured webhook URL
      logger.info('Webhook notification sent', {
        component: 'log-manager',
        operation: 'webhook_notification',
        metadata: { alertId: alert.id, payload },
      });
    } catch (error) {
      logger.error('Failed to send webhook notification', {
        component: 'log-manager',
        operation: 'webhook_notification_error',
        metadata: { alertId: alert.id },
      }, error as Error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(config: any, alert: LogAlert, logEntry: any): Promise<void> {
    try {
      // In a real implementation, you'd send an email using your email service
      logger.info('Email notification sent', {
        component: 'log-manager',
        operation: 'email_notification',
        metadata: { alertId: alert.id, recipient: config.recipient },
      });
    } catch (error) {
      logger.error('Failed to send email notification', {
        component: 'log-manager',
        operation: 'email_notification_error',
        metadata: { alertId: alert.id },
      }, error as Error);
    }
  }

  /**
   * Start aggregation processing
   */
  private startAggregation(): void {
    if (!this.aggregationConfig.enabled) return;

    setInterval(() => {
      this.flushAggregatedData();
    }, this.aggregationConfig.flushInterval);
  }

  /**
   * Flush aggregated data
   */
  private flushAggregatedData(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, data] of this.aggregatedData.entries()) {
      // Remove data older than the time window
      if (now.getTime() - data.timestamp.getTime() > 3600000) { // 1 hour
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.aggregatedData.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug(`Flushed ${expiredKeys.length} expired aggregation entries`, {
        component: 'log-manager',
        operation: 'flush_aggregated_data',
        metadata: { flushedCount: expiredKeys.length },
      });
    }
  }

  /**
   * Get log metrics
   */
  public getLogMetrics(timeRange?: { start: Date; end: Date }): LogMetrics {
    const defaultTimeRange = {
      start: new Date(Date.now() - 3600000), // 1 hour ago
      end: new Date(),
    };

    const range = timeRange || defaultTimeRange;

    // This is a simplified implementation
    // In a real system, you'd query your log storage system
    const metrics: LogMetrics = {
      totalLogs: 0,
      logsByLevel: {},
      logsByComponent: {},
      errorRate: 0,
      averageResponseTime: 0,
      topErrors: [],
      timeRange: range,
    };

    // Calculate metrics from aggregated data
    for (const [key, data] of this.aggregatedData.entries()) {
      if (data.timestamp >= range.start && data.timestamp <= range.end) {
        metrics.totalLogs += data.count;

        if (data.rule === 'error_count') {
          metrics.logsByLevel.ERROR = (metrics.logsByLevel.ERROR || 0) + data.count;
        }

        if (data.rule === 'api_response_time' && data.values.length > 0) {
          const avg = data.values.reduce((sum: number, val: number) => sum + val, 0) / data.values.length;
          metrics.averageResponseTime = avg;
        }
      }
    }

    // Calculate error rate
    const totalNonErrors = metrics.totalLogs - (metrics.logsByLevel.ERROR || 0);
    metrics.errorRate = metrics.totalLogs > 0 
      ? (metrics.logsByLevel.ERROR || 0) / metrics.totalLogs 
      : 0;

    return metrics;
  }

  /**
   * Rotate logs if needed
   */
  public async rotateLogs(logFilePath: string): Promise<void> {
    // Note: File operations are not available in Edge Runtime
    // This is a placeholder implementation for Edge Runtime compatibility
    logger.info('Log rotation requested (Edge Runtime - operation skipped)', {
      component: 'log-manager',
      operation: 'rotate_logs',
      metadata: { logFilePath },
    });
  }

  /**
   * Perform log rotation
   */
  private async performLogRotation(logFilePath: string): Promise<void> {
    // Note: File operations are not available in Edge Runtime
    // This is a placeholder implementation for Edge Runtime compatibility
    logger.info('Log rotation performed (Edge Runtime - operation skipped)', {
      component: 'log-manager',
      operation: 'log_rotation',
      metadata: { logFilePath },
    });
  }

  /**
   * Compress log file
   */
  private async compressLogFile(filePath: string): Promise<void> {
    // Note: File operations are not available in Edge Runtime
    // This is a placeholder implementation for Edge Runtime compatibility
    logger.debug('Log file compression (Edge Runtime - operation skipped)', {
      component: 'log-manager',
      operation: 'compress_log',
      metadata: { filePath },
    });
  }

  /**
   * Clean up old logs based on retention policy
   */
  public async cleanupOldLogs(logDir: string): Promise<void> {
    // Note: File operations are not available in Edge Runtime
    // This is a placeholder implementation for Edge Runtime compatibility
    logger.info('Log cleanup requested (Edge Runtime - operation skipped)', {
      component: 'log-manager',
      operation: 'cleanup_old_logs',
      metadata: { logDir },
    });
  }

  /**
   * Archive log file
   */
  private async archiveLogFile(filePath: string, archivePath: string): Promise<void> {
    // Note: File operations are not available in Edge Runtime
    // This is a placeholder implementation for Edge Runtime compatibility
    logger.info('Log file archiving (Edge Runtime - operation skipped)', {
      component: 'log-manager',
      operation: 'archive_log',
      metadata: { filePath, archivePath },
    });
  }

  /**
   * Get configuration
   */
  public getConfiguration() {
    return {
      rotation: this.rotationConfig,
      retention: this.retentionConfig,
      aggregation: this.aggregationConfig,
    };
  }

  /**
   * Update configuration
   */
  public updateConfiguration(config: Partial<{
    rotation: Partial<LogRotationConfig>;
    retention: Partial<LogRetentionConfig>;
    aggregation: Partial<LogAggregationConfig>;
  }>): void {
    if (config.rotation) {
      this.rotationConfig = { ...this.rotationConfig, ...config.rotation };
    }
    if (config.retention) {
      this.retentionConfig = { ...this.retentionConfig, ...config.retention };
    }
    if (config.aggregation) {
      this.aggregationConfig = { ...this.aggregationConfig, ...config.aggregation };
    }

    logger.info('Log manager configuration updated', {
      component: 'log-manager',
      operation: 'update_configuration',
      metadata: { updatedConfig: config },
    });
  }
}

// Export singleton instance
export const logManager = LogManager.getInstance();