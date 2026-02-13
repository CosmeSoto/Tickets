/**
 * Log Analysis API
 * 
 * Provides endpoints for log analysis and insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logAggregator } from '@/lib/logging/log-aggregator';
import { ApplicationLogger } from '@/lib/logging';
import { ApiResponseBuilder } from '@/lib/api/response-builder';
import { z } from 'zod';

// Validation schema for analysis query
const LogAnalysisQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  includeRecommendations: z.boolean().optional(),
  includePatterns: z.boolean().optional(),
});

const LogPatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  pattern: z.string(),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  enabled: z.boolean(),
});

/**
 * GET /api/admin/logs/analyze - Analyze logs for insights
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/logs/analyze', 401, Date.now() - startTime);
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    if (session.user.role !== 'ADMIN') {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/logs/analyze', 403, Date.now() - startTime);
      return ApiResponseBuilder.forbidden('Admin access required');
    }

    ApplicationLogger.apiRequestStart('GET', '/api/admin/logs/analyze', {
      userId: session.user.id,
    });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryData: any = {};

    if (searchParams.get('startDate')) queryData.startDate = searchParams.get('startDate');
    if (searchParams.get('endDate')) queryData.endDate = searchParams.get('endDate');
    if (searchParams.get('includeRecommendations')) queryData.includeRecommendations = searchParams.get('includeRecommendations') === 'true';
    if (searchParams.get('includePatterns')) queryData.includePatterns = searchParams.get('includePatterns') === 'true';

    // Validate query parameters
    const queryResult = LogAnalysisQuerySchema.safeParse(queryData);
    if (!queryResult.success) {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/logs/analyze', 400, Date.now() - startTime);
      return ApiResponseBuilder.validationError(queryResult.error);
    }

    const query = queryResult.data;

    // Build time range
    const timeRange = query.startDate && query.endDate ? {
      start: new Date(query.startDate),
      end: new Date(query.endDate),
    } : undefined;

    // Perform analysis
    const analysis = logAggregator.analyzeLogs(timeRange);

    // Get patterns if requested
    let patterns = undefined;
    if (query.includePatterns !== false) { // Default to true
      patterns = logAggregator.getPatterns().map(pattern => ({
        ...pattern,
        pattern: pattern.pattern.source, // Convert RegExp to string
      }));
    }

    // Get aggregator statistics
    const statistics = logAggregator.getStatistics();

    const response = {
      analysis,
      patterns,
      statistics,
      timestamp: new Date().toISOString(),
    };

    ApplicationLogger.businessOperation('analyze_logs', 'log_analysis', 'system', {
      userId: session.user.id,
      metadata: {
        timeRange,
        totalEntries: analysis.totalEntries,
        recommendationsCount: analysis.recommendations.length,
      },
    });

    ApplicationLogger.apiRequestComplete('GET', '/api/admin/logs/analyze', 200, Date.now() - startTime);
    return ApiResponseBuilder.success(response);

  } catch (error) {
    ApplicationLogger.apiRequestError('GET', '/api/admin/logs/analyze', error as Error);
    return ApiResponseBuilder.internalError('Failed to analyze logs');
  }
}

/**
 * POST /api/admin/logs/analyze - Manage log patterns
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/analyze', 401, Date.now() - startTime);
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    if (session.user.role !== 'ADMIN') {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/analyze', 403, Date.now() - startTime);
      return ApiResponseBuilder.forbidden('Admin access required');
    }

    ApplicationLogger.apiRequestStart('POST', '/api/admin/logs/analyze', {
      userId: session.user.id,
    });

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'add_pattern':
        return await handleAddPattern(body.pattern, session.user.id, startTime);
      
      case 'remove_pattern':
        return await handleRemovePattern(body.patternId, session.user.id, startTime);
      
      case 'toggle_pattern':
        return await handleTogglePattern(body.patternId, body.enabled, session.user.id, startTime);
      
      case 'get_patterns':
        return await handleGetPatterns(session.user.id, startTime);
      
      default:
        ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/analyze', 400, Date.now() - startTime);
        return ApiResponseBuilder.validationError('Invalid action');
    }

  } catch (error) {
    ApplicationLogger.apiRequestError('POST', '/api/admin/logs/analyze', error as Error);
    return ApiResponseBuilder.internalError('Failed to process log analysis request');
  }
}

/**
 * Handle add pattern
 */
async function handleAddPattern(pattern: any, userId: string, startTime: number) {
  const patternResult = LogPatternSchema.safeParse(pattern);
  
  if (!patternResult.success) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/analyze', 400, Date.now() - startTime);
    return ApiResponseBuilder.validationError(patternResult.error);
  }

  try {
    const patternConfig = {
      ...patternResult.data,
      pattern: new RegExp(patternResult.data.pattern),
    };

    logAggregator.addPattern(patternConfig);
    
    ApplicationLogger.businessOperation('add_log_pattern', 'log_pattern', patternConfig.id, {
      userId,
      metadata: { patternName: patternConfig.name, severity: patternConfig.severity },
    });

    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/analyze', 201, Date.now() - startTime);
    return ApiResponseBuilder.success({ 
      message: 'Pattern added successfully', 
      patternId: patternConfig.id 
    });
  } catch (error) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/analyze', 400, Date.now() - startTime);
    return ApiResponseBuilder.validationError('Invalid regular expression pattern');
  }
}

/**
 * Handle remove pattern
 */
async function handleRemovePattern(patternId: string, userId: string, startTime: number) {
  if (!patternId || typeof patternId !== 'string') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/analyze', 400, Date.now() - startTime);
    return ApiResponseBuilder.validationError('Pattern ID is required');
  }

  const removed = logAggregator.removePattern(patternId);
  
  if (!removed) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/analyze', 404, Date.now() - startTime);
    return ApiResponseBuilder.notFound('Pattern not found');
  }

  ApplicationLogger.businessOperation('remove_log_pattern', 'log_pattern', patternId, {
    userId,
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/analyze', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({ message: 'Pattern removed successfully' });
}

/**
 * Handle toggle pattern
 */
async function handleTogglePattern(patternId: string, enabled: boolean, userId: string, startTime: number) {
  if (!patternId || typeof patternId !== 'string' || typeof enabled !== 'boolean') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/analyze', 400, Date.now() - startTime);
    return ApiResponseBuilder.validationError('Pattern ID and enabled status are required');
  }

  const toggled = logAggregator.togglePattern(patternId, enabled);
  
  if (!toggled) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/analyze', 404, Date.now() - startTime);
    return ApiResponseBuilder.notFound('Pattern not found');
  }

  ApplicationLogger.businessOperation('toggle_log_pattern', 'log_pattern', patternId, {
    userId,
    metadata: { enabled },
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/analyze', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({ 
    message: `Pattern ${enabled ? 'enabled' : 'disabled'} successfully` 
  });
}

/**
 * Handle get patterns
 */
async function handleGetPatterns(userId: string, startTime: number) {
  const patterns = logAggregator.getPatterns().map(pattern => ({
    ...pattern,
    pattern: pattern.pattern.source, // Convert RegExp to string
  }));

  ApplicationLogger.businessOperation('get_log_patterns', 'log_pattern', 'system', {
    userId,
    metadata: { patternCount: patterns.length },
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/analyze', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({ patterns });
}