/**
 * Migration Module Index
 * Centralized exports for data migration functionality
 */

// Core migration services
export { DataMigrationService } from './data-migration-service'
export { DataValidationScripts } from './data-validation-scripts'
export { RollbackProcedures } from './rollback-procedures'
export { IntegrityVerification } from './integrity-verification'

// Types and interfaces
export type {
  MigrationStatus,
  MigrationStep,
  MigrationContext,
  MigrationOptions,
  MigrationProgress,
  MigrationStepResult,
  MigrationError,
  ValidationResult,
  TransformationRule,
  MigrationSchemaType,
} from './data-migration-service'

export type {
  ValidationRule,
  ValidationError,
  ValidationWarning,
  ValidationStatistics,
  DataIntegrityResult,
  IntegrityCheck,
} from './data-validation-scripts'

export type {
  RollbackOperation,
  RollbackContext,
  RollbackOptions,
  RollbackProgress,
  RollbackResult,
  RollbackError,
  BackupData,
} from './rollback-procedures'

export type {
  IntegrityVerificationResult,
  IntegrityVerificationSummary,
  VerificationOptions,
  DataConsistencyReport,
  DataTableSummary,
  ConsistencyCheck,
} from './integrity-verification'

// Migration schemas
export { MigrationSchemas } from './data-migration-service'

/**
 * Migration utilities and helpers
 */
export class MigrationUtils {
  /**
   * Generate migration ID
   */
  static generateMigrationId(): string {
    return `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Validate migration data structure
   */
  static validateMigrationData(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false
    }
    
    return (
      Array.isArray(data.users) &&
      Array.isArray(data.tickets) &&
      Array.isArray(data.categories)
    )
  }

  /**
   * Calculate migration complexity score
   */
  static calculateComplexityScore(data: {
    users: any[]
    tickets: any[]
    categories: any[]
  }): number {
    const totalRecords = data.users.length + data.tickets.length + data.categories.length
    
    // Base complexity on record count
    let complexity = 1
    
    if (totalRecords > 100000) complexity = 5
    else if (totalRecords > 50000) complexity = 4
    else if (totalRecords > 10000) complexity = 3
    else if (totalRecords > 1000) complexity = 2
    
    // Adjust for relationships
    const hasRelationships = data.tickets.some(t => t.userId || t.categoryId || t.assignedToId)
    if (hasRelationships) complexity += 1
    
    // Adjust for hierarchy
    const hasHierarchy = data.categories.some(c => c.parentId)
    if (hasHierarchy) complexity += 1
    
    return Math.min(5, complexity)
  }

  /**
   * Estimate migration duration
   */
  static estimateMigrationDuration(data: {
    users: any[]
    tickets: any[]
    categories: any[]
  }): number {
    const totalRecords = data.users.length + data.tickets.length + data.categories.length
    const complexity = this.calculateComplexityScore(data)
    
    // Base time: 1ms per record
    let estimatedMs = totalRecords * 1
    
    // Adjust for complexity
    estimatedMs *= complexity
    
    // Add overhead for validation and integrity checks
    estimatedMs *= 1.5
    
    return Math.round(estimatedMs)
  }

  /**
   * Format migration duration
   */
  static formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`
    } else if (milliseconds < 60000) {
      return `${Math.round(milliseconds / 1000)}s`
    } else if (milliseconds < 3600000) {
      return `${Math.round(milliseconds / 60000)}m`
    } else {
      return `${Math.round(milliseconds / 3600000)}h`
    }
  }

  /**
   * Generate migration summary
   */
  static generateMigrationSummary(data: {
    users: any[]
    tickets: any[]
    categories: any[]
  }): {
    totalRecords: number
    recordsByType: Record<string, number>
    complexity: number
    estimatedDuration: string
    recommendations: string[]
  } {
    const totalRecords = data.users.length + data.tickets.length + data.categories.length
    const complexity = this.calculateComplexityScore(data)
    const duration = this.estimateMigrationDuration(data)
    
    const recommendations: string[] = []
    
    if (complexity >= 4) {
      recommendations.push('Consider breaking migration into smaller batches')
    }
    
    if (totalRecords > 50000) {
      recommendations.push('Enable progress monitoring for large dataset')
    }
    
    if (data.categories.some(c => c.parentId)) {
      recommendations.push('Verify category hierarchy integrity before migration')
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Migration appears straightforward - proceed with standard process')
    }

    return {
      totalRecords,
      recordsByType: {
        users: data.users.length,
        tickets: data.tickets.length,
        categories: data.categories.length,
      },
      complexity,
      estimatedDuration: this.formatDuration(duration),
      recommendations,
    }
  }
}

/**
 * Migration constants
 */
export const MIGRATION_CONSTANTS = {
  DEFAULT_BATCH_SIZE: 1000,
  MAX_BATCH_SIZE: 10000,
  DEFAULT_TIMEOUT: 300000, // 5 minutes
  MAX_RETRIES: 3,
  BACKUP_RETENTION_DAYS: 30,
  
  VALIDATION_RULES: {
    MAX_FIELD_LENGTH: 65535,
    MAX_RECORDS_PER_BATCH: 10000,
    REQUIRED_FIELDS: {
      users: ['id', 'email', 'name'],
      tickets: ['id', 'title', 'userId'],
      categories: ['id', 'name'],
    },
  },
  
  SEVERITY_LEVELS: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical',
  } as const,
  
  MIGRATION_STATES: {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    ROLLED_BACK: 'rolled_back',
  } as const,
}

/**
 * Migration error codes
 */
export const MIGRATION_ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INTEGRITY_CHECK_FAILED: 'INTEGRITY_CHECK_FAILED',
  ROLLBACK_FAILED: 'ROLLBACK_FAILED',
  BACKUP_FAILED: 'BACKUP_FAILED',
  TIMEOUT: 'TIMEOUT',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  INVALID_DATA_FORMAT: 'INVALID_DATA_FORMAT',
  DEPENDENCY_NOT_MET: 'DEPENDENCY_NOT_MET',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  RESOURCE_EXHAUSTED: 'RESOURCE_EXHAUSTED',
} as const

export type MigrationErrorCode = typeof MIGRATION_ERROR_CODES[keyof typeof MIGRATION_ERROR_CODES]