/**
 * Admin Feature Flags API
 * 
 * Provides endpoints for feature flags management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { featureFlagsService, type FeatureFlagCondition } from '@/lib/config';
import { ApplicationLogger } from '@/lib/logging';
import { ApiResponseBuilder } from '@/lib/api/response-builder';
import { z } from 'zod';

// Validation schemas
const FeatureFlagConditionSchema = z.object({
  type: z.enum(['user_id', 'user_role', 'user_attribute', 'environment', 'date_range', 'custom']),
  operator: z.enum(['equals', 'not_equals', 'in', 'not_in', 'contains', 'greater_than', 'less_than']),
  value: z.unknown(),
  attribute: z.string().optional(),
});

const FeatureFlagVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  weight: z.number().min(0).max(100),
  payload: z.record(z.any()).optional(),
});

const CreateFeatureFlagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  enabled: z.boolean().default(false),
  rolloutPercentage: z.number().min(0).max(100).default(0),
  conditions: z.array(FeatureFlagConditionSchema).default([]),
  variants: z.array(FeatureFlagVariantSchema).default([]),
});

const UpdateFeatureFlagSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  conditions: z.array(FeatureFlagConditionSchema).optional(),
  variants: z.array(FeatureFlagVariantSchema).optional(),
});

const EvaluateContextSchema = z.object({
  userId: z.string().optional(),
  userRole: z.string().optional(),
  userAttributes: z.record(z.any()).optional(),
  environment: z.string().optional(),
  customAttributes: z.record(z.any()).optional(),
});

/**
 * GET /api/admin/config/features - List feature flags
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/config/features', 401, Date.now() - startTime);
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    if (session.user.role !== 'ADMIN') {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/config/features', 403, Date.now() - startTime);
      return ApiResponseBuilder.forbidden('Admin access required');
    }

    ApplicationLogger.apiRequestStart('GET', '/api/admin/config/features', {
      userId: session.user.id,
    });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const enabled = searchParams.get('enabled');
    const environment = searchParams.get('environment');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);

    const filters: any = {};
    if (enabled !== null) filters.enabled = enabled === 'true';
    if (environment) filters.environment = environment;
    if (tags && tags.length > 0) filters.tags = tags;

    // Get feature flags
    const flags = featureFlagsService.listFlags(filters);
    const statistics = featureFlagsService.getStatistics();

    const response = {
      flags: flags.map(flag => ({
        ...flag,
        // Convert RegExp patterns to strings for JSON serialization
        conditions: flag.conditions.map(condition => ({
          ...condition,
          value: condition.value instanceof RegExp ? condition.value.source : condition.value,
        })),
      })),
      statistics,
      timestamp: new Date().toISOString(),
    };

    ApplicationLogger.apiRequestComplete('GET', '/api/admin/config/features', 200, Date.now() - startTime);
    return ApiResponseBuilder.success(response);

  } catch (error) {
    ApplicationLogger.apiRequestError('GET', '/api/admin/config/features', error as Error);
    return ApiResponseBuilder.internalError('Failed to list feature flags');
  }
}

/**
 * POST /api/admin/config/features - Create or manage feature flags
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 401, Date.now() - startTime);
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    if (session.user.role !== 'ADMIN') {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 403, Date.now() - startTime);
      return ApiResponseBuilder.forbidden('Admin access required');
    }

    ApplicationLogger.apiRequestStart('POST', '/api/admin/config/features', {
      userId: session.user.id,
    });

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create':
        return await handleCreateFlag(body.flag, session.user.id, startTime);
      
      case 'update':
        return await handleUpdateFlag(body.flagId, body.flag, session.user.id, startTime);
      
      case 'delete':
        return await handleDeleteFlag(body.flagId, session.user.id, startTime);
      
      case 'evaluate':
        return await handleEvaluateFlag(body.flagId, body.context, session.user.id, startTime);
      
      case 'bulk_evaluate':
        return await handleBulkEvaluate(body.flagIds, body.context, session.user.id, startTime);
      
      case 'export':
        return await handleExportFlags(session.user.id, startTime);
      
      case 'import':
        return await handleImportFlags(body.flags, session.user.id, startTime);
      
      default:
        ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 400, Date.now() - startTime);
        return ApiResponseBuilder.error('INVALID_INPUT', 'Invalid action', 400);
    }

  } catch (error) {
    ApplicationLogger.apiRequestError('POST', '/api/admin/config/features', error as Error);
    return ApiResponseBuilder.internalError('Failed to process feature flags request');
  }
}

/**
 * Handle create flag
 */
async function handleCreateFlag(flagData: any, userId: string, startTime: number) {
  const flagResult = CreateFeatureFlagSchema.safeParse(flagData);
  
  if (!flagResult.success) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 400, Date.now() - startTime);
    return ApiResponseBuilder.validationError(flagResult.error);
  }

  const flag = flagResult.data;

  // Validate variant weights sum to 100 if variants exist
  if (flag.variants.length > 0) {
    const totalWeight = flag.variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (totalWeight !== 100) {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 400, Date.now() - startTime);
      return ApiResponseBuilder.error('VALIDATION_ERROR', 'Variant weights must sum to 100', 400);
    }
  }

  featureFlagsService.setFlag(flag as any, userId);

  ApplicationLogger.businessOperation('create_feature_flag', 'feature_flag', flag.id, {
    userId,
    metadata: { 
      flagName: flag.name, 
      enabled: flag.enabled, 
      rolloutPercentage: flag.rolloutPercentage 
    },
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 201, Date.now() - startTime);
  return ApiResponseBuilder.success({ 
    message: 'Feature flag created successfully', 
    flagId: flag.id 
  }, 201);
}

/**
 * Handle update flag
 */
async function handleUpdateFlag(flagId: string, flagData: any, userId: string, startTime: number) {
  if (!flagId || typeof flagId !== 'string') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('INVALID_INPUT', 'Flag ID is required', 400);
  }

  const existingFlag = featureFlagsService.getFlag(flagId);
  if (!existingFlag) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 404, Date.now() - startTime);
    return ApiResponseBuilder.notFound('Feature flag not found');
  }

  const flagResult = UpdateFeatureFlagSchema.safeParse(flagData);
  
  if (!flagResult.success) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 400, Date.now() - startTime);
    return ApiResponseBuilder.validationError(flagResult.error);
  }

  const updates = flagResult.data;

  // Validate variant weights if variants are being updated
  if (updates.variants && updates.variants.length > 0) {
    const totalWeight = updates.variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (totalWeight !== 100) {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 400, Date.now() - startTime);
      return ApiResponseBuilder.error('VALIDATION_ERROR', 'Variant weights must sum to 100', 400);
    }
  }

  const updatedFlag = {
    ...existingFlag,
    ...updates,
    id: flagId, // Ensure ID doesn't change
  };

  featureFlagsService.setFlag(updatedFlag as any, userId);

  ApplicationLogger.businessOperation('update_feature_flag', 'feature_flag', flagId, {
    userId,
    metadata: { 
      flagName: updatedFlag.name,
      changes: Object.keys(updates),
    },
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({ message: 'Feature flag updated successfully' });
}

/**
 * Handle delete flag
 */
async function handleDeleteFlag(flagId: string, userId: string, startTime: number) {
  if (!flagId || typeof flagId !== 'string') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('INVALID_INPUT', 'Flag ID is required', 400);
  }

  const deleted = featureFlagsService.deleteFlag(flagId);
  
  if (!deleted) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 404, Date.now() - startTime);
    return ApiResponseBuilder.notFound('Feature flag not found');
  }

  ApplicationLogger.businessOperation('delete_feature_flag', 'feature_flag', flagId, {
    userId,
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({ message: 'Feature flag deleted successfully' });
}

/**
 * Handle evaluate flag
 */
async function handleEvaluateFlag(flagId: string, context: any, userId: string, startTime: number) {
  if (!flagId || typeof flagId !== 'string') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('INVALID_INPUT', 'Flag ID is required', 400);
  }

  const contextResult = EvaluateContextSchema.safeParse(context || {});
  
  if (!contextResult.success) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 400, Date.now() - startTime);
    return ApiResponseBuilder.validationError(contextResult.error);
  }

  const evaluation = featureFlagsService.evaluateFlag(flagId, contextResult.data);

  ApplicationLogger.businessOperation('evaluate_feature_flag', 'feature_flag', flagId, {
    userId,
    metadata: { 
      enabled: evaluation.enabled,
      reason: evaluation.reason,
      hasVariant: !!evaluation.variant,
    },
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({
    message: 'Feature flag evaluated successfully',
    evaluation,
  });
}

/**
 * Handle bulk evaluate
 */
async function handleBulkEvaluate(flagIds: string[], context: any, userId: string, startTime: number) {
  if (!Array.isArray(flagIds) || flagIds.length === 0) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('INVALID_INPUT', 'Flag IDs array is required', 400);
  }

  const contextResult = EvaluateContextSchema.safeParse(context || {});
  
  if (!contextResult.success) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 400, Date.now() - startTime);
    return ApiResponseBuilder.validationError(contextResult.error);
  }

  const evaluations = featureFlagsService.evaluateFlags(flagIds, contextResult.data);

  ApplicationLogger.businessOperation('bulk_evaluate_feature_flags', 'feature_flag', 'system', {
    userId,
    metadata: { 
      flagCount: flagIds.length,
      enabledCount: Object.values(evaluations).filter(e => e.enabled).length,
    },
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({
    message: 'Feature flags evaluated successfully',
    evaluations,
  });
}

/**
 * Handle export flags
 */
async function handleExportFlags(userId: string, startTime: number) {
  const flags = featureFlagsService.exportFlags();

  ApplicationLogger.businessOperation('export_feature_flags', 'feature_flag', 'system', {
    userId,
    metadata: { flagCount: Object.keys(flags).length },
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({
    message: 'Feature flags exported successfully',
    flags,
    exportedAt: new Date().toISOString(),
  });
}

/**
 * Handle import flags
 */
async function handleImportFlags(flags: any, userId: string, startTime: number) {
  if (!flags || typeof flags !== 'object') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('INVALID_INPUT', 'Flags object is required', 400);
  }

  try {
    featureFlagsService.importFlags(flags, userId);

    ApplicationLogger.businessOperation('import_feature_flags', 'feature_flag', 'system', {
      userId,
      metadata: { flagCount: Object.keys(flags).length },
    });

    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 200, Date.now() - startTime);
    return ApiResponseBuilder.success({
      message: 'Feature flags imported successfully',
      importedCount: Object.keys(flags).length,
    });
  } catch (error) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/features', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('VALIDATION_ERROR', (error as Error).message, 400);
  }
}