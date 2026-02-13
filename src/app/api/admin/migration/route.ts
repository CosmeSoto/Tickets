/**
 * Migration Administration API
 * Endpoints for managing data migration operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiRoute, RouteContext } from '@/lib/api/route-template'
import { DataMigrationService } from '@/lib/migration/data-migration-service'
import { DataValidationScripts } from '@/lib/migration/data-validation-scripts'
import { RollbackProcedures } from '@/lib/migration/rollback-procedures'
import { IntegrityVerification } from '@/lib/migration/integrity-verification'
import { z } from 'zod'

// Request schemas
const CreateMigrationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sourceData: z.object({
    users: z.array(z.any()),
    tickets: z.array(z.any()),
    categories: z.array(z.any()),
  }),
  options: z.object({
    dryRun: z.boolean().optional(),
    batchSize: z.number().optional(),
    skipValidation: z.boolean().optional(),
    continueOnError: z.boolean().optional(),
    backupBeforeMigration: z.boolean().optional(),
    validateAfterMigration: z.boolean().optional(),
  }).optional(),
})

const ExecuteMigrationSchema = z.object({
  migrationId: z.string(),
  confirm: z.boolean(),
})

const RollbackMigrationSchema = z.object({
  migrationId: z.string(),
  targetState: z.enum(['pre_migration', 'specific_checkpoint', 'clean_state']).optional(),
  confirm: z.boolean(),
})

const ValidateDataSchema = z.object({
  data: z.object({
    users: z.array(z.any()),
    tickets: z.array(z.any()),
    categories: z.array(z.any()),
  }),
  options: z.object({
    includePerformanceChecks: z.boolean().optional(),
    includeSecurityChecks: z.boolean().optional(),
    includeBusinessRuleChecks: z.boolean().optional(),
    deepValidation: z.boolean().optional(),
  }).optional(),
})

// Services
const migrationService = new DataMigrationService()
const validationService = new DataValidationScripts()
const rollbackService = new RollbackProcedures()
const integrityService = new IntegrityVerification()

/**
 * GET /api/admin/migration
 * Get migration status and list active migrations
 */
export const GET = createApiRoute(
  async (request: NextRequest, context: RouteContext) => {
    const url = new URL(request.url)
    const migrationId = url.searchParams.get('migrationId')

    if (migrationId) {
      // Get specific migration progress
      const progress = migrationService.getMigrationProgress(migrationId)
      const rollbackProgress = rollbackService.getRollbackProgress(migrationId)

      if (!progress && !rollbackProgress) {
        return NextResponse.json(
          { error: 'Migration not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        migrationId,
        progress,
        rollbackProgress,
      })
    }

    // List all active migrations (in a real implementation, this would query a database)
    return NextResponse.json({
      activeMigrations: [],
      totalMigrations: 0,
      completedMigrations: 0,
      failedMigrations: 0,
    })
  },
  {
    auth: { required: true, roles: ['ADMIN'] },
    rateLimit: { maxRequests: 100, windowMs: 60000 },
  }
)

/**
 * POST /api/admin/migration
 * Create and manage migration operations
 */
export const POST = createApiRoute(
  async (request: NextRequest, context: RouteContext) => {
    const body = await request.json()
    const action = body.action

    switch (action) {
      case 'create':
        return await handleCreateMigration(body)
      case 'execute':
        return await handleExecuteMigration(body)
      case 'rollback':
        return await handleRollbackMigration(body)
      case 'validate':
        return await handleValidateData(body)
      case 'verify_integrity':
        return await handleVerifyIntegrity(body)
      case 'generate_report':
        return await handleGenerateReport(body)
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  },
  {
    auth: { required: true, roles: ['ADMIN'] },
    rateLimit: { maxRequests: 50, windowMs: 60000 },
  }
)

/**
 * Handle create migration
 */
async function handleCreateMigration(body: any) {
  try {
    const validatedData = CreateMigrationSchema.parse(body)

    // Create migration steps (simplified example)
    const steps = [
      {
        id: 'validate_data',
        name: 'Validate Data',
        description: 'Validate source data integrity',
        execute: async (context: any) => {
          const userValidation = await validationService.validateUsers(validatedData.sourceData.users)
          const ticketValidation = await validationService.validateTickets(validatedData.sourceData.tickets)
          const categoryValidation = await validationService.validateCategories(validatedData.sourceData.categories)

          const hasErrors = userValidation.errors.length > 0 || 
                           ticketValidation.errors.length > 0 || 
                           categoryValidation.errors.length > 0

          const allErrors = [
            ...userValidation.errors,
            ...ticketValidation.errors,
            ...categoryValidation.errors,
          ]

          const allWarnings = [
            ...userValidation.warnings,
            ...ticketValidation.warnings,
            ...categoryValidation.warnings,
          ]

          return {
            success: !hasErrors,
            processedRecords: validatedData.sourceData.users.length + 
                            validatedData.sourceData.tickets.length + 
                            validatedData.sourceData.categories.length,
            errors: allErrors.map(err => ({
              step: 'validate_data',
              error: String(err),
              recoverable: true,
              severity: 'high' as const,
              details: err
            })),
            warnings: allWarnings.map(warn => String(warn)),
          }
        },
      },
      {
        id: 'import_users',
        name: 'Import Users',
        description: 'Import user data',
        dependencies: ['validate_data'],
        execute: async (context: any) => {
          const result = await migrationService.importData(
            validatedData.sourceData.users,
            'users',
            { validate: true, transform: true }
          )

          return {
            success: result.errors.length === 0,
            processedRecords: result.imported.length,
            errors: result.errors.map(err => ({
              step: 'import_users',
              error: String(err),
              recoverable: true,
              severity: 'high' as const,
              details: err
            })),
            warnings: result.warnings.map(warn => String(warn)),
          }
        },
      },
      {
        id: 'import_categories',
        name: 'Import Categories',
        description: 'Import category data',
        dependencies: ['validate_data'],
        execute: async (context: any) => {
          const result = await migrationService.importData(
            validatedData.sourceData.categories,
            'categories',
            { validate: true, transform: true }
          )

          return {
            success: result.errors.length === 0,
            processedRecords: result.imported.length,
            errors: result.errors.map(err => ({
              step: 'import_categories',
              error: String(err),
              recoverable: true,
              severity: 'high' as const,
              details: err
            })),
            warnings: result.warnings.map(warn => String(warn)),
          }
        },
      },
      {
        id: 'import_tickets',
        name: 'Import Tickets',
        description: 'Import ticket data',
        dependencies: ['import_users', 'import_categories'],
        execute: async (context: any) => {
          const result = await migrationService.importData(
            validatedData.sourceData.tickets,
            'tickets',
            { validate: true, transform: true }
          )

          return {
            success: result.errors.length === 0,
            processedRecords: result.imported.length,
            errors: result.errors.map(err => ({
              step: 'import_tickets',
              error: String(err),
              recoverable: true,
              severity: 'high' as const,
              details: err
            })),
            warnings: result.warnings.map(warn => String(warn)),
          }
        },
      },
    ]

    const migrationId = await migrationService.createMigration(steps, validatedData.options)

    return NextResponse.json({
      success: true,
      migrationId,
      message: 'Migration created successfully',
      steps: steps.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        dependencies: s.dependencies || [],
      })),
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to create migration',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 400 }
    )
  }
}

/**
 * Handle execute migration
 */
async function handleExecuteMigration(body: any) {
  try {
    const validatedData = ExecuteMigrationSchema.parse(body)

    if (!validatedData.confirm) {
      return NextResponse.json(
        { error: 'Migration execution must be confirmed' },
        { status: 400 }
      )
    }

    // Get migration steps (in real implementation, retrieve from storage)
    const steps: any[] = [] // Would retrieve actual steps

    const result = await migrationService.executeMigration(validatedData.migrationId, steps)

    return NextResponse.json({
      success: result.success,
      migrationId: validatedData.migrationId,
      processedRecords: result.processedRecords,
      errors: result.errors,
      warnings: result.warnings,
      message: result.success ? 'Migration executed successfully' : 'Migration failed',
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to execute migration',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * Handle rollback migration
 */
async function handleRollbackMigration(body: any) {
  try {
    const validatedData = RollbackMigrationSchema.parse(body)

    if (!validatedData.confirm) {
      return NextResponse.json(
        { error: 'Migration rollback must be confirmed' },
        { status: 400 }
      )
    }

    const result = await rollbackService.executeRollback(
      validatedData.migrationId,
      validatedData.targetState || 'pre_migration'
    )

    return NextResponse.json({
      success: result.success,
      migrationId: validatedData.migrationId,
      restoredRecords: result.restoredRecords,
      errors: result.errors,
      warnings: result.warnings,
      message: result.success ? 'Migration rolled back successfully' : 'Rollback failed',
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to rollback migration',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * Handle validate data
 */
async function handleValidateData(body: any) {
  try {
    const validatedData = ValidateDataSchema.parse(body)

    const report = await validationService.generateDataQualityReport(validatedData.data)

    return NextResponse.json({
      success: true,
      report,
      message: 'Data validation completed',
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to validate data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * Handle verify integrity
 */
async function handleVerifyIntegrity(body: any) {
  try {
    const validatedData = ValidateDataSchema.parse(body)

    const result = await integrityService.verifyDataIntegrity(
      validatedData.data,
      validatedData.options || {}
    )

    return NextResponse.json({
      success: true,
      result,
      message: 'Integrity verification completed',
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to verify integrity',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * Handle generate report
 */
async function handleGenerateReport(body: any) {
  try {
    const { migrationId, data } = body

    if (!data) {
      return NextResponse.json(
        { error: 'Data is required for report generation' },
        { status: 400 }
      )
    }

    const consistencyReport = await integrityService.generateConsistencyReport(migrationId, data)
    const qualityReport = await validationService.generateDataQualityReport(data)

    return NextResponse.json({
      success: true,
      reports: {
        consistency: consistencyReport,
        quality: qualityReport,
      },
      message: 'Reports generated successfully',
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to generate report',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}