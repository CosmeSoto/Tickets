/**
 * Log Search API
 * 
 * Provides endpoints for searching and analyzing logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logAggregator, LogSearchQuery } from '@/lib/logging/log-aggregator';
import { ApplicationLogger } from '@/lib/logging';
import { ApiResponseBuilder } from '@/lib/api/response-builder';
import { z } from 'zod';

// Validation schema for search query
const LogSearchQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  levels: z.array(z.string()).optional(),
  components: z.array(z.string()).optional(),
  operations: z.array(z.string()).optional(),
  userId: z.string().optional(),
  requestId: z.string().optional(),
  searchText: z.string().optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  sortBy: z.enum(['timestamp', 'level', 'component']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * GET /api/admin/logs/search - Search logs
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/logs/search', 401, Date.now() - startTime);
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    if (session.user.role !== 'ADMIN') {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/logs/search', 403, Date.now() - startTime);
      return ApiResponseBuilder.forbidden('Admin access required');
    }

    ApplicationLogger.apiRequestStart('GET', '/api/admin/logs/search', {
      userId: session.user.id,
    });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryData: any = {};

    // Extract search parameters
    if (searchParams.get('startDate')) queryData.startDate = searchParams.get('startDate');
    if (searchParams.get('endDate')) queryData.endDate = searchParams.get('endDate');
    if (searchParams.get('levels')) queryData.levels = searchParams.get('levels')?.split(',');
    if (searchParams.get('components')) queryData.components = searchParams.get('components')?.split(',');
    if (searchParams.get('operations')) queryData.operations = searchParams.get('operations')?.split(',');
    if (searchParams.get('userId')) queryData.userId = searchParams.get('userId');
    if (searchParams.get('requestId')) queryData.requestId = searchParams.get('requestId');
    if (searchParams.get('searchText')) queryData.searchText = searchParams.get('searchText');
    if (searchParams.get('limit')) queryData.limit = parseInt(searchParams.get('limit')!);
    if (searchParams.get('offset')) queryData.offset = parseInt(searchParams.get('offset')!);
    if (searchParams.get('sortBy')) queryData.sortBy = searchParams.get('sortBy');
    if (searchParams.get('sortOrder')) queryData.sortOrder = searchParams.get('sortOrder');

    // Validate query parameters
    const queryResult = LogSearchQuerySchema.safeParse(queryData);
    if (!queryResult.success) {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/logs/search', 400, Date.now() - startTime);
      return ApiResponseBuilder.validationError(queryResult.error);
    }

    const query = queryResult.data;

    // Build search query
    const searchQuery: LogSearchQuery = {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    // Perform search
    const searchResult = logAggregator.searchLogs(searchQuery);

    ApplicationLogger.businessOperation('search_logs', 'log_search', 'system', {
      userId: session.user.id,
      metadata: {
        query: searchQuery,
        resultCount: searchResult.entries.length,
        totalMatches: searchResult.total,
      },
    });

    ApplicationLogger.apiRequestComplete('GET', '/api/admin/logs/search', 200, Date.now() - startTime);
    return ApiResponseBuilder.success(searchResult);

  } catch (error) {
    ApplicationLogger.apiRequestError('GET', '/api/admin/logs/search', error as Error);
    return ApiResponseBuilder.internalError('Failed to search logs');
  }
}

/**
 * POST /api/admin/logs/search - Advanced log search with complex queries
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/search', 401, Date.now() - startTime);
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    if (session.user.role !== 'ADMIN') {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/search', 403, Date.now() - startTime);
      return ApiResponseBuilder.forbidden('Admin access required');
    }

    ApplicationLogger.apiRequestStart('POST', '/api/admin/logs/search', {
      userId: session.user.id,
    });

    const body = await request.json();
    
    // Validate request body
    const queryResult = LogSearchQuerySchema.safeParse(body);
    if (!queryResult.success) {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/search', 400, Date.now() - startTime);
      return ApiResponseBuilder.validationError(queryResult.error);
    }

    const query = queryResult.data;

    // Build search query
    const searchQuery: LogSearchQuery = {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    // Perform search
    const searchResult = logAggregator.searchLogs(searchQuery);

    ApplicationLogger.businessOperation('advanced_search_logs', 'log_search', 'system', {
      userId: session.user.id,
      metadata: {
        query: searchQuery,
        resultCount: searchResult.entries.length,
        totalMatches: searchResult.total,
      },
    });

    ApplicationLogger.apiRequestComplete('POST', '/api/admin/logs/search', 200, Date.now() - startTime);
    return ApiResponseBuilder.success(searchResult);

  } catch (error) {
    ApplicationLogger.apiRequestError('POST', '/api/admin/logs/search', error as Error);
    return ApiResponseBuilder.internalError('Failed to perform advanced log search');
  }
}