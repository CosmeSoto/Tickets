/**
 * Data Migration Service
 * Comprehensive data import/export and migration utilities
 */

import { z } from 'zod'
import { logger } from '@/lib/logging/logger'
import { ConfigurationService } from '@/lib/config/configuration-service'

// Migration status types
export type MigrationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back'

// Migration step interface
export interface MigrationStep {
  id: string
  name: string
  description: string
  execute: (context: MigrationContext) => Promise<MigrationStepResult>
  rollback?: (context: MigrationContext) => Promise<void>
  validate?: (context: MigrationContext) => Promise<ValidationResult>
  dependencies?: string[]
  estimatedDuration?: number // in milliseconds
}

// Migration context
export interface MigrationContext {
  migrationId: string
  sourceData: any
  targetData: any
  options: MigrationOptions
  logger: typeof logger
  progress: MigrationProgress
  metadata: Record<string, any>
}

// Migration options
export interface MigrationOptions {
  dryRun?: boolean
  batchSize?: number
  skipValidation?: boolean
  continueOnError?: boolean
  backupBeforeMigration?: boolean
  validateAfterMigration?: boolean
  transformationRules?: TransformationRule[]
  customMappings?: Record<string, string>
}

// Migration progress tracking
export interface MigrationProgress {
  totalSteps: number
  completedSteps: number
  currentStep: string
  startTime: Date
  estimatedEndTime?: Date
  processedRecords: number
  totalRecords: number
  errors: MigrationError[]
  warnings: string[]
}

// Migration step result
export interface MigrationStepResult {
  success: boolean
  processedRecords: number
  errors: MigrationError[]
  warnings: string[]
  metadata?: Record<string, any>
}

// Migration error
export interface MigrationError {
  step: string
  record?: any
  error: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  recoverable: boolean
}

// Validation result
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  statistics: Record<string, number>
}

// Transformation rule
export interface TransformationRule {
  field: string
  sourceField?: string
  transform: (value: any, record: any) => any
  validate?: (value: any) => boolean
  required?: boolean
}

// Data schemas for validation
const UserMigrationSchema = z.object({
  id: z.string().optional(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['USER', 'TECHNICIAN', 'ADMIN']),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})

const TicketMigrationSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  userId: z.string(),
  assignedToId: z.string().optional(),
  categoryId: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})

const CategoryMigrationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})

export const MigrationSchemas = {
  users: UserMigrationSchema,
  tickets: TicketMigrationSchema,
  categories: CategoryMigrationSchema,
}

export type MigrationSchemaType = keyof typeof MigrationSchemas

/**
 * Data Migration Service
 */
export class DataMigrationService {
  private logger = logger.child({ component: 'DataMigrationService' })
  private config: ConfigurationService
  private activeMigrations: Map<string, MigrationContext> = new Map()

  constructor() {
    this.config = ConfigurationService.getInstance()
  }

  /**
   * Create a new migration
   */
  async createMigration(
    steps: MigrationStep[],
    options: MigrationOptions = {}
  ): Promise<string> {
    const migrationId = `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Validate migration steps
    this.validateMigrationSteps(steps)
    
    // Create migration context
    const context: MigrationContext = {
      migrationId,
      sourceData: {},
      targetData: {},
      options: {
        dryRun: false,
        batchSize: 1000,
        skipValidation: false,
        continueOnError: false,
        backupBeforeMigration: true,
        validateAfterMigration: true,
        ...options,
      },
      logger: this.logger as any,
      progress: {
        totalSteps: steps.length,
        completedSteps: 0,
        currentStep: '',
        startTime: new Date(),
        processedRecords: 0,
        totalRecords: 0,
        errors: [],
        warnings: [],
      },
      metadata: {},
    }

    this.activeMigrations.set(migrationId, context)

    this.logger.info('Migration created', {
      migration: migrationId,
      totalSteps: steps.length,
      config: options,
    } as any)

    return migrationId
  }

  /**
   * Execute migration
   */
  async executeMigration(
    migrationId: string,
    steps: MigrationStep[]
  ): Promise<MigrationStepResult> {
    const context = this.activeMigrations.get(migrationId)
    if (!context) {
      throw new Error(`Migration ${migrationId} not found`)
    }

    this.logger.info('Starting migration execution', { migration: migrationId } as any)

    try {
      // Sort steps by dependencies
      const sortedSteps = this.sortStepsByDependencies(steps)
      
      // Execute steps
      for (const step of sortedSteps) {
        context.progress.currentStep = step.name
        
        this.logger.info('Executing migration step', {
          migration: migrationId,
          stepId: step.id,
          stepName: step.name,
        } as any)

        // Pre-step validation
        if (step.validate && !context.options.skipValidation) {
          const validationResult = await step.validate(context)
          if (!validationResult.valid) {
            const error: MigrationError = {
              step: step.id,
              error: `Validation failed: ${validationResult.errors.join(', ')}`,
              severity: 'critical',
              recoverable: false,
            }
            context.progress.errors.push(error)
            
            if (!context.options.continueOnError) {
              throw new Error(`Migration step ${step.id} validation failed`)
            }
          }
        }

        // Execute step
        const stepResult = await step.execute(context)
        
        // Handle step result
        if (!stepResult.success) {
          context.progress.errors.push(...stepResult.errors)
          
          if (!context.options.continueOnError) {
            throw new Error(`Migration step ${step.id} failed`)
          }
        } else {
          context.progress.completedSteps++
          context.progress.processedRecords += stepResult.processedRecords
          context.progress.warnings.push(...stepResult.warnings)
        }

        this.logger.info('Migration step completed', {
          migration: migrationId,
          stepId: step.id,
          success: stepResult.success,
          processedRecords: stepResult.processedRecords,
          errors: stepResult.errors.length,
          warnings: stepResult.warnings.length,
        } as any)
      }

      // Final validation
      if (context.options.validateAfterMigration) {
        await this.validateMigrationResult(context)
      }

      this.logger.info('Migration completed successfully', {
        migration: migrationId,
        totalSteps: context.progress.totalSteps,
        processedRecords: context.progress.processedRecords,
        errors: context.progress.errors.length,
        warnings: context.progress.warnings.length,
      } as any)

      return {
        success: true,
        processedRecords: context.progress.processedRecords,
        errors: context.progress.errors,
        warnings: context.progress.warnings,
      }

    } catch (error) {
      this.logger.error('Migration failed', {
        migration: migrationId,
        error: error instanceof Error ? error.message : String(error),
      } as any)

      return {
        success: false,
        processedRecords: context.progress.processedRecords,
        errors: [
          ...context.progress.errors,
          {
            step: context.progress.currentStep,
            error: error instanceof Error ? error.message : String(error),
            severity: 'critical' as const,
            recoverable: false,
          },
        ],
        warnings: context.progress.warnings,
      }
    }
  }

  /**
   * Rollback migration
   */
  async rollbackMigration(
    migrationId: string,
    steps: MigrationStep[]
  ): Promise<void> {
    const context = this.activeMigrations.get(migrationId)
    if (!context) {
      throw new Error(`Migration ${migrationId} not found`)
    }

    this.logger.info('Starting migration rollback', { migration: migrationId } as any)

    try {
      // Execute rollback steps in reverse order
      const reversedSteps = steps.reverse()
      
      for (const step of reversedSteps) {
        if (step.rollback) {
          this.logger.info('Rolling back migration step', {
            migration: migrationId,
            stepId: step.id,
            stepName: step.name,
          } as any)

          await step.rollback(context)
        }
      }

      this.logger.info('Migration rollback completed', { migration: migrationId } as any)

    } catch (error) {
      this.logger.error('Migration rollback failed', {
        migration: migrationId,
        error: error instanceof Error ? error.message : String(error),
      } as any)
      throw error
    }
  }

  /**
   * Get migration progress
   */
  getMigrationProgress(migrationId: string): MigrationProgress | null {
    const context = this.activeMigrations.get(migrationId)
    return context ? context.progress : null
  }

  /**
   * Import data from various formats
   */
  async importData(
    data: any[],
    schemaType: MigrationSchemaType,
    options: {
      validate?: boolean
      transform?: boolean
      batchSize?: number
    } = {}
  ): Promise<{
    imported: any[]
    errors: MigrationError[]
    warnings: string[]
  }> {
    const schema = MigrationSchemas[schemaType]
    const imported: any[] = []
    const errors: MigrationError[] = []
    const warnings: string[] = []

    const batchSize = options.batchSize || 1000
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      
      for (const record of batch) {
        try {
          // Validate if requested
          if (options.validate !== false) {
            const validationResult = schema.safeParse(record)
            if (!validationResult.success) {
              errors.push({
                step: 'import',
                record,
                error: `Validation failed: ${validationResult.error.message}`,
                severity: 'medium',
                recoverable: true,
              })
              continue
            }
          }

          // Transform if requested
          let processedRecord = record
          if (options.transform) {
            processedRecord = await this.transformRecord(record, schemaType)
          }

          imported.push(processedRecord)

        } catch (error) {
          errors.push({
            step: 'import',
            record,
            error: error instanceof Error ? error.message : String(error),
            severity: 'high',
            recoverable: false,
          })
        }
      }
    }

    this.logger.info('Data import completed', {
      schema: schemaType,
      totalRecords: data.length,
      importedRecords: imported.length,
      errors: errors.length,
      warnings: warnings.length,
    } as any)

    return { imported, errors, warnings }
  }

  /**
   * Export data to various formats
   */
  async exportData(
    data: any[],
    format: 'json' | 'csv' | 'xml' = 'json',
    options: {
      includeMetadata?: boolean
      compress?: boolean
    } = {}
  ): Promise<string> {
    switch (format) {
      case 'json':
        return this.exportToJSON(data, options)
      case 'csv':
        return this.exportToCSV(data, options)
      case 'xml':
        return this.exportToXML(data, options)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  /**
   * Validate migration steps
   */
  private validateMigrationSteps(steps: MigrationStep[]): void {
    const stepIds = new Set<string>()
    
    for (const step of steps) {
      // Check for duplicate step IDs
      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step ID: ${step.id}`)
      }
      stepIds.add(step.id)

      // Validate dependencies
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.has(dep)) {
            // Check if dependency exists in the steps array
            const depExists = steps.some(s => s.id === dep)
            if (!depExists) {
              throw new Error(`Step ${step.id} depends on non-existent step: ${dep}`)
            }
          }
        }
      }
    }

    // Check for circular dependencies
    this.checkCircularDependencies(steps)
  }

  /**
   * Check for circular dependencies
   */
  private checkCircularDependencies(steps: MigrationStep[]): void {
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (stepId: string, path: string[] = []): void => {
      if (visiting.has(stepId)) {
        throw new Error(`Circular dependency detected: ${path.join(' -> ')} -> ${stepId}`)
      }
      
      if (visited.has(stepId)) {
        return
      }

      visiting.add(stepId)
      const step = steps.find(s => s.id === stepId)
      
      if (step?.dependencies) {
        for (const dep of step.dependencies) {
          visit(dep, [...path, stepId])
        }
      }

      visiting.delete(stepId)
      visited.add(stepId)
    }

    for (const step of steps) {
      if (!visited.has(step.id)) {
        visit(step.id)
      }
    }
  }

  /**
   * Sort steps by dependencies
   */
  private sortStepsByDependencies(steps: MigrationStep[]): MigrationStep[] {
    const sorted: MigrationStep[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (step: MigrationStep) => {
      if (visiting.has(step.id)) {
        throw new Error(`Circular dependency detected involving step: ${step.id}`)
      }
      
      if (visited.has(step.id)) {
        return
      }

      visiting.add(step.id)

      // Visit dependencies first
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          const depStep = steps.find(s => s.id === depId)
          if (depStep) {
            visit(depStep)
          }
        }
      }

      visiting.delete(step.id)
      visited.add(step.id)
      sorted.push(step)
    }

    for (const step of steps) {
      visit(step)
    }

    return sorted
  }

  /**
   * Validate migration result
   */
  private async validateMigrationResult(context: MigrationContext): Promise<void> {
    // Implement post-migration validation logic
    this.logger.info('Validating migration result', {
      migration: context.migrationId,
    } as any)

    // Add specific validation checks based on your requirements
    // For example: data integrity checks, foreign key validation, etc.
  }

  /**
   * Transform record based on schema type
   */
  private async transformRecord(record: any, schemaType: MigrationSchemaType): Promise<any> {
    // Implement transformation logic based on schema type
    switch (schemaType) {
      case 'users':
        return this.transformUserRecord(record)
      case 'tickets':
        return this.transformTicketRecord(record)
      case 'categories':
        return this.transformCategoryRecord(record)
      default:
        return record
    }
  }

  /**
   * Transform user record
   */
  private transformUserRecord(record: any): any {
    return {
      ...record,
      email: record.email?.toLowerCase(),
      role: record.role?.toUpperCase() || 'USER',
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || new Date().toISOString(),
    }
  }

  /**
   * Transform ticket record
   */
  private transformTicketRecord(record: any): any {
    return {
      ...record,
      status: record.status?.toUpperCase() || 'OPEN',
      priority: record.priority?.toUpperCase() || 'MEDIUM',
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || new Date().toISOString(),
    }
  }

  /**
   * Transform category record
   */
  private transformCategoryRecord(record: any): any {
    return {
      ...record,
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || new Date().toISOString(),
    }
  }

  /**
   * Export to JSON
   */
  private exportToJSON(data: any[], options: any): string {
    const exportData = {
      data,
      metadata: options.includeMetadata ? {
        exportedAt: new Date().toISOString(),
        recordCount: data.length,
        version: '1.0',
      } : undefined,
    }

    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Export to CSV
   */
  private exportToCSV(data: any[], options: any): string {
    if (data.length === 0) return ''

    const headers = Object.keys(data[0])
    const csvRows = [headers.join(',')]

    for (const record of data) {
      const values = headers.map(header => {
        const value = record[header]
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      })
      csvRows.push(values.join(','))
    }

    return csvRows.join('\n')
  }

  /**
   * Export to XML
   */
  private exportToXML(data: any[], options: any): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<data>\n'

    for (const record of data) {
      xml += '  <record>\n'
      for (const [key, value] of Object.entries(record)) {
        xml += `    <${key}>${this.escapeXML(String(value))}</${key}>\n`
      }
      xml += '  </record>\n'
    }

    xml += '</data>'
    return xml
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  /**
   * Clean up migration
   */
  cleanupMigration(migrationId: string): void {
    this.activeMigrations.delete(migrationId)
    this.logger.info('Migration cleaned up', { migration: migrationId } as any)
  }
}