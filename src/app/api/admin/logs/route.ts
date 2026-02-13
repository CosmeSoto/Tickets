/**
 * Admin Log Management API
 * 
 * Provides endpoints for log management, metrics, and alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logManager } from '@/lib/logging/log-manager';
import { ApplicationLogger } from '@/lib/logging';
import { ApiResponseBuilder } from '@/lib/api/response-builder';
import { z } from 'zod';

// Validation schemas
const LogMetricsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const AlertConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  condition: z.object({
    type: z.enum(['threshold', 'pattern', 'absence']),
    pattern: z.string().optional(),
    threshold: z.number().optional(),
    timeWindow: z.number(),
    field: z.string().optional(),
  }),
  actions: z.array(z.object({
    type: z.enum(['email', 'webhook', 'log']),
    config: z.record(z.any()),
  })),
  enabled: z.boolean(),
  cooldown: z.number(),
});

const LogManagerConfigSchema = z.object({
  rotation: z.object({
    maxFileSize: z.number().optional(),
    maxFiles: z.number().optional(),
    rotateDaily: z.boolean().optional(),
    compressOldLogs: z.boolean().optional(),
  }).optional(),
  retention: z.object({
    retentionDays: z.number().optional(),
    archiveOldLogs: z.boolean().optional(),
    archivePath: z.string().optional(),
  }).optional(),
  aggregation: z.object({
    enabled: z.boolean().optional(),
    batchSize: z.number().optional(),
    flushInterval: z.number().optional(),
  }).optional(),
});

/**
 * GET /api/admin/logs - Get log metrics and status
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/logs', 401, Date.now() - startTime);
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    if (session.user.role !== 'ADMIN') {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/logs', 403, Date.now() - startTime);
      return ApiResponseBuilder.forbidden('Admin access required');
    }

    ApplicationLogger.apiRequestStart('GET', '/api/admin/logs', {
      userId: session.user.id,
    });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = LogMetricsQuerySchema.safeParse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
    });

    if (!queryResult.success) {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/logs', 400, Date.now() - startTime);
      return ApiResponseBuilder.validationError(queryResult.error);
    }

    const { startDate, endDate } = queryResult.data;
    
    // Build time range
    const timeRange = {
      start: startDate ? new Date(startDate) : new Date(Date.now() - 3600000), // 1 hour ago
      end: endDate ? new Date(endDate) : new Date(),
    };

    // Get log metrics
    const metrics = logManager.getLogMetrics(timeRange);
    
    // Get alerts
    const alerts = logManager.getAlerts();
    
    // Get configuration
    const configuration = logManager.getConfiguration();

    const response = {
      metrics,
      alerts: alerts.map(alert => ({
        ...alert,
        condition: {
          ...alert.condition,
          pattern: alert.condition.pattern?.source,
        },
      })),
      configuration,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };

    ApplicationLogger.apiRequestComplete('GET', '/api/admin/logs', 200, Date.now() - startTime);
    return ApiResponseBuilder.success(response);

  } catch (error) {
    ApplicationLogger.apiRequestError('GET', '/api/admin/logs', error as Error);
    return ApiResponseBuilder.internalError('Failed to get log metrics');
  }
}

/**
 * POST /api/admin/logs - Update log configuration or manage alerts
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 401, Date.now() - startTime);
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    if (session.user.role !== 'ADMIN') {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 403, Date.now() - startTime);
      return ApiResponseBuilder.forbidden('Admin access required');
    }

    ApplicationLogger.apiRequestStart('POST', '/api/admin/logs', {
      userId: session.user.id,
    });

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'update_config':
        return await handleUpdateConfig(body.config, startTime);
      
      case 'add_alert':
        return await handleAddAlert(body.alert, startTime);
      
      case 'remove_alert':
        return await handleRemoveAlert(body.alertId, startTime);
      
      case 'toggle_alert':
        return await handleToggleAlert(body.alertId, body.enabled, startTime);
      
      case 'rotate_logs':
        return await handleRotateLogs(body.logPath, startTime);
      
      case 'cleanup_logs':
        return await handleCleanupLogs(body.logDir, startTime);
      
      default:
        ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 400, Date.now() - startTime);
        return ApiResponseBuilder.error('INVALID_INPUT', 'Invalid action', 400);
    }

  } catch (error) {
    ApplicationLogger.apiRequestError('POST', '/api/admin/logs', error as Error);
    return ApiResponseBuilder.internalError('Failed to process log management request');
  }
}

/**
 * Handle configuration update
 */
async function handleUpdateConfig(config: any, startTime: number) {
  const configResult = LogManagerConfigSchema.safeParse(config);
  
  if (!configResult.success) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 400, Date.now() - startTime);
    return ApiResponseBuilder.validationError(configResult.error);
  }

  logManager.updateConfiguration(configResult.data);
  
  ApplicationLogger.businessOperation('update_log_config', 'log_manager', 'system', {
    userId: 'admin',
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({ message: 'Configuration updated successfully' });
}

/**
 * Handle add alert
 */
async function handleAddAlert(alert: any, startTime: number) {
  const alertResult = AlertConfigSchema.safeParse(alert);
  
  if (!alertResult.success) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 400, Date.now() - startTime);
    return ApiResponseBuilder.validationError(alertResult.error);
  }

  const alertConfig = {
    ...alertResult.data,
    condition: {
      ...alertResult.data.condition,
      pattern: alertResult.data.condition.pattern 
        ? new RegExp(alertResult.data.condition.pattern) 
        : undefined,
    },
  };

  logManager.addAlert(alertConfig);
  
  ApplicationLogger.businessOperation('add_log_alert', 'log_alert', alertConfig.id, {
    userId: 'admin',
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 201, Date.now() - startTime);
  return ApiResponseBuilder.success({ message: 'Alert added successfully', alertId: alertConfig.id }, 201);
}

/**
 * Handle remove alert
 */
async function handleRemoveAlert(alertId: string, startTime: number) {
  if (!alertId || typeof alertId !== 'string') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('INVALID_INPUT', 'Alert ID is required', 400);
  }

  const removed = logManager.removeAlert(alertId);
  
  if (!removed) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 404, Date.now() - startTime);
    return ApiResponseBuilder.notFound('Alert not found');
  }

  ApplicationLogger.businessOperation('remove_log_alert', 'log_alert', alertId, {
    userId: 'admin',
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({ message: 'Alert removed successfully' });
}

/**
 * Handle toggle alert
 */
async function handleToggleAlert(alertId: string, enabled: boolean, startTime: number) {
  if (!alertId || typeof alertId !== 'string' || typeof enabled !== 'boolean') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('INVALID_INPUT', 'Alert ID and enabled status are required', 400);
  }

  const toggled = logManager.toggleAlert(alertId, enabled);
  
  if (!toggled) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 404, Date.now() - startTime);
    return ApiResponseBuilder.notFound('Alert not found');
  }

  ApplicationLogger.businessOperation('toggle_log_alert', 'log_alert', alertId, {
    userId: 'admin',
    metadata: { enabled },
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({ message: `Alert ${enabled ? 'enabled' : 'disabled'} successfully` });
}

/**
 * Handle log rotation
 */
async function handleRotateLogs(logPath: string, startTime: number) {
  if (!logPath || typeof logPath !== 'string') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('INVALID_INPUT', 'Log path is required', 400);
  }

  try {
    await logManager.rotateLogs(logPath);
    
    ApplicationLogger.businessOperation('rotate_logs', 'log_file', logPath, {
      userId: 'admin',
    });

    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 200, Date.now() - startTime);
    return ApiResponseBuilder.success({ message: 'Log rotation completed successfully' });
  } catch (error) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 500, Date.now() - startTime);
    return ApiResponseBuilder.internalError('Failed to rotate logs');
  }
}

/**
 * Handle log cleanup
 */
async function handleCleanupLogs(logDir: string, startTime: number) {
  if (!logDir || typeof logDir !== 'string') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('INVALID_INPUT', 'Log directory is required', 400);
  }

  try {
    await logManager.cleanupOldLogs(logDir);
    
    ApplicationLogger.businessOperation('cleanup_logs', 'log_directory', logDir, {
      userId: 'admin',
    });

    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 200, Date.now() - startTime);
    return ApiResponseBuilder.success({ message: 'Log cleanup completed successfully' });
  } catch (error) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs', 500, Date.now() - startTime);
    return ApiResponseBuilder.internalError('Failed to cleanup logs');
  }
}