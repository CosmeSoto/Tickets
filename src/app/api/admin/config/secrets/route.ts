/**
 * Admin Secrets Management API
 * 
 * Provides endpoints for secrets management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { secretsManager } from '@/lib/config';
import { ApplicationLogger } from '@/lib/logging';
import { ApiResponseBuilder } from '@/lib/api/response-builder';
import { z } from 'zod';

// Validation schemas
const CreateSecretSchema = z.object({
  id: z.string().min(1),
  value: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.string().optional(),
  encrypt: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
  rotationInterval: z.number().min(0).optional(),
  tags: z.array(z.string()).default([]),
});

const UpdateSecretSchema = z.object({
  value: z.string().min(1),
  type: z.string().optional(),
});

/**
 * GET /api/admin/config/secrets - List secrets metadata
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/config/secrets', 401, Date.now() - startTime);
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    if (session.user.role !== 'ADMIN') {
      ApplicationLogger.apiRequestComplete('GET', '/api/admin/config/secrets', 403, Date.now() - startTime);
      return ApiResponseBuilder.forbidden('Admin access required');
    }

    ApplicationLogger.apiRequestStart('GET', '/api/admin/config/secrets', {
      userId: session.user.id,
    });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);

    // Get secrets metadata (never expose actual values)
    const secrets = secretsManager.listSecrets(tags);
    const statistics = secretsManager.getStatistics();

    const response = {
      secrets: secrets.map(secret => ({
        ...secret,
        // Remove sensitive information
        value: undefined,
      })),
      statistics,
      timestamp: new Date().toISOString(),
    };

    ApplicationLogger.apiRequestComplete('GET', '/api/admin/config/secrets', 200, Date.now() - startTime);
    return ApiResponseBuilder.success(response);

  } catch (error) {
    ApplicationLogger.apiRequestError('GET', '/api/admin/config/secrets', error as Error);
    return ApiResponseBuilder.internalError('Failed to list secrets');
  }
}

/**
 * POST /api/admin/config/secrets - Create or manage secrets
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 401, Date.now() - startTime);
      return ApiResponseBuilder.unauthorized('Authentication required');
    }

    if (session.user.role !== 'ADMIN') {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 403, Date.now() - startTime);
      return ApiResponseBuilder.forbidden('Admin access required');
    }

    ApplicationLogger.apiRequestStart('POST', '/api/admin/config/secrets', {
      userId: session.user.id,
    });

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create':
        return await handleCreateSecret(body.secret, session.user.id, startTime);
      
      case 'update':
        return await handleUpdateSecret(body.secretId, body.secret, session.user.id, startTime);
      
      case 'delete':
        return await handleDeleteSecret(body.secretId, session.user.id, startTime);
      
      case 'rotate':
        return await handleRotateSecret(body.secretId, body.newValue, session.user.id, startTime);
      
      case 'check_rotation':
        return await handleCheckRotation(session.user.id, startTime);
      
      case 'import_env':
        return await handleImportFromEnvironment(body.mapping, session.user.id, startTime);
      
      default:
        ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 400, Date.now() - startTime);
        return ApiResponseBuilder.error('INVALID_INPUT', 'Invalid action', 400);
    }

  } catch (error) {
    ApplicationLogger.apiRequestError('POST', '/api/admin/config/secrets', error as Error);
    return ApiResponseBuilder.internalError('Failed to process secrets request');
  }
}

/**
 * Handle create secret
 */
async function handleCreateSecret(secretData: any, userId: string, startTime: number) {
  const secretResult = CreateSecretSchema.safeParse(secretData);
  
  if (!secretResult.success) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 400, Date.now() - startTime);
    return ApiResponseBuilder.validationError(secretResult.error);
  }

  const { id, value, expiresAt, ...options } = secretResult.data;

  try {
    secretsManager.storeSecret(id, value, {
      ...options,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    ApplicationLogger.businessOperation('create_secret', 'secret', id, {
      userId,
      metadata: { secretName: options.name, encrypted: options.encrypt },
    });

    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 201, Date.now() - startTime);
    return ApiResponseBuilder.success({ 
      message: 'Secret created successfully', 
      secretId: id 
    }, 201);
  } catch (error) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('VALIDATION_ERROR', (error as Error).message, 400);
  }
}

/**
 * Handle update secret
 */
async function handleUpdateSecret(secretId: string, secretData: any, userId: string, startTime: number) {
  if (!secretId || typeof secretId !== 'string') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('INVALID_INPUT', 'Secret ID is required', 400);
  }

  const secretResult = UpdateSecretSchema.safeParse(secretData);
  
  if (!secretResult.success) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 400, Date.now() - startTime);
    return ApiResponseBuilder.validationError(secretResult.error);
  }

  try {
    secretsManager.updateSecret(secretId, secretResult.data.value, {
      type: secretResult.data.type,
    });

    ApplicationLogger.businessOperation('update_secret', 'secret', secretId, {
      userId,
    });

    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 200, Date.now() - startTime);
    return ApiResponseBuilder.success({ message: 'Secret updated successfully' });
  } catch (error) {
    if ((error as Error).message.includes('not found')) {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 404, Date.now() - startTime);
      return ApiResponseBuilder.notFound('Secret not found');
    }

    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('VALIDATION_ERROR', (error as Error).message, 400);
  }
}

/**
 * Handle delete secret
 */
async function handleDeleteSecret(secretId: string, userId: string, startTime: number) {
  if (!secretId || typeof secretId !== 'string') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('INVALID_INPUT', 'Secret ID is required', 400);
  }

  const deleted = secretsManager.deleteSecret(secretId);
  
  if (!deleted) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 404, Date.now() - startTime);
    return ApiResponseBuilder.notFound('Secret not found');
  }

  ApplicationLogger.businessOperation('delete_secret', 'secret', secretId, {
    userId,
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({ message: 'Secret deleted successfully' });
}

/**
 * Handle rotate secret
 */
async function handleRotateSecret(secretId: string, newValue: string | undefined, userId: string, startTime: number) {
  if (!secretId || typeof secretId !== 'string') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('INVALID_INPUT', 'Secret ID is required', 400);
  }

  try {
    secretsManager.rotateSecret(secretId, newValue);

    ApplicationLogger.businessOperation('rotate_secret', 'secret', secretId, {
      userId,
      metadata: { providedNewValue: !!newValue },
    });

    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 200, Date.now() - startTime);
    return ApiResponseBuilder.success({ message: 'Secret rotated successfully' });
  } catch (error) {
    if ((error as Error).message.includes('not found')) {
      ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 404, Date.now() - startTime);
      return ApiResponseBuilder.notFound('Secret not found');
    }

    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 500, Date.now() - startTime);
    return ApiResponseBuilder.internalError('Failed to rotate secret');
  }
}

/**
 * Handle check rotation
 */
async function handleCheckRotation(userId: string, startTime: number) {
  const needsRotation = secretsManager.checkRotationNeeded();
  const expiringSoon = secretsManager.checkExpiringSecrets();

  ApplicationLogger.businessOperation('check_secret_rotation', 'secret', 'system', {
    userId,
    metadata: {
      needsRotationCount: needsRotation.length,
      expiringSoonCount: expiringSoon.length,
    },
  });

  ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 200, Date.now() - startTime);
  return ApiResponseBuilder.success({
    message: 'Rotation check completed',
    needsRotation: needsRotation.map(s => ({
      id: s.id,
      name: s.name,
      lastRotated: s.lastRotated,
      rotationInterval: s.rotationInterval,
    })),
    expiringSoon: expiringSoon.map(s => ({
      id: s.id,
      name: s.name,
      expiresAt: s.expiresAt,
    })),
  });
}

/**
 * Handle import from environment
 */
async function handleImportFromEnvironment(mapping: any, userId: string, startTime: number) {
  if (!mapping || typeof mapping !== 'object') {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 400, Date.now() - startTime);
    return ApiResponseBuilder.error('INVALID_INPUT', 'Mapping is required', 400);
  }

  try {
    secretsManager.importFromEnvironment(mapping);

    ApplicationLogger.businessOperation('import_secrets_from_env', 'secret', 'system', {
      userId,
      metadata: { mappingCount: Object.keys(mapping).length },
    });

    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 200, Date.now() - startTime);
    return ApiResponseBuilder.success({
      message: 'Secrets imported from environment successfully',
      importedCount: Object.keys(mapping).length,
    });
  } catch (error) {
    ApplicationLogger.apiRequestComplete('POST', '/api/admin/config/secrets', 500, Date.now() - startTime);
    return ApiResponseBuilder.internalError('Failed to import secrets from environment');
  }
}