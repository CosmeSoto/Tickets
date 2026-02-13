/**
 * Admin Configuration API
 * 
 * Provides endpoints for configuration management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { configurationService } from '@/lib/config';
import { ApplicationLogger } from '@/lib/logging';
import { ApiResponseBuilder } from '@/lib/api/response-builder';

/**
 * GET /api/admin/config - Get configuration summary
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/config', 401, Date.now() - startTime);
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    if (session.user.role !== 'ADMIN') {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/config', 403, Date.now() - startTime);
      return ApiResponseBuilder.forbidden('Admin access required');
    }

    ApplicationLogger.apiRequestStart('GET', '/api/admin/config', {
      userId: session.user.id,
    });

    // Get configuration summary (safe for API exposure)
    const summary = configurationService.getConfigurationSummary();
    const validation = configurationService.validateConfiguration();

    const response = {
      summary,
      validation,
      environment: configurationService.getEnvironment(),
      isProduction: configurationService.isProduction(),
      timestamp: new Date().toISOString(),
    };

    ApplicationLogger.apiRequestComplete('GET', '/api/admin/config', 200, Date.now() - startTime);
    return ApiResponseBuilder.success(response);

  } catch (error) {
    ApplicationLogger.apiRequestError('GET', '/api/admin/config', error as Error);
    return ApiResponseBuilder.internalError('Failed to get configuration');
  }
}

/**
 * POST /api/admin/config - Reload configuration
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/config', 401, Date.now() - startTime);
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    if (session.user.role !== 'ADMIN') {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/config', 403, Date.now() - startTime);
      return ApiResponseBuilder.forbidden('Admin access required');
    }

    ApplicationLogger.apiRequestStart('POST', '/api/admin/config', {
      userId: session.user.id,
    });

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'reload':
        return await handleReloadConfiguration(session.user.id, startTime);
      
      case 'validate':
        return await handleValidateConfiguration(session.user.id, startTime);
      
      default:
        ApplicationLogger.apiRequestComplete('POST', '/api/admin/config', 400, Date.now() - startTime);
        return ApiResponseBuilder.error('INVALID_INPUT', 'Invalid action', 400);
    }

  } catch (error) {
    ApplicationLogger.apiRequestError('POST', '/api/admin/config', error as Error);
    return ApiResponseBuilder.internalError('Failed to process configuration request');
  }
}

/**
 * Handle configuration reload
 */
async function handleReloadConfiguration(userId: string, startTime: number) {
  try {
    const newConfig = configurationService.reloadConfiguration();
    const summary = configurationService.getConfigurationSummary();

    ApplicationLogger.businessOperation('reload_configuration', 'configuration', 'system', {
      userId,
    });

    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config', 200, Date.now() - startTime);
    return ApiResponseBuilder.success({
      message: 'Configuration reloaded successfully',
      summary,
      environment: configurationService.getEnvironment(),
    });
  } catch (error) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config', 500, Date.now() - startTime);
    return ApiResponseBuilder.internalError('Failed to reload configuration');
  }
}

/**
 * Handle configuration validation
 */
async function handleValidateConfiguration(userId: string, startTime: number) {
  const validation = configurationService.validateConfiguration();

  ApplicationLogger.businessOperation('validate_configuration', 'configuration', 'system', {
    userId,
    metadata: { valid: validation.valid, errorCount: validation.errors.length },
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/config', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({
    message: validation.valid ? 'Configuration is valid' : 'Configuration has errors',
    validation,
  });
}