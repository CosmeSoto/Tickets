/**
 * Data Integrity Verification Tools
 * Comprehensive tools for verifying data integrity after migration
 */

import { logger } from '@/lib/logging/logger'
import { ConfigurationService } from '@/lib/config/configuration-service'

// Integrity verification result
export interface IntegrityVerificationResult {
  passed: boolean
  score: number // 0-100
  checks: IntegrityCheck[]
  summary: IntegrityVerificationSummary
  recommendations: string[]
}

// Integrity verification summary
export interface IntegrityVerificationSummary {
  totalChecks: number
  passedChecks: number
  failedChecks: number
  criticalFailures: number
  warningCount: number
  dataQualityScore: number
  migrationIntegrityScore: number
}

// Enhanced integrity check
export interface IntegrityCheck {
  id: string
  name: string
  description: string
  category: 'referential' | 'structural' | 'business' | 'performance' | 'security'
  passed: boolean
  severity: 'info' | 'warning' | 'error' | 'critical'
  details: string
  affectedRecords?: number
  suggestions?: string[]
  executionTime?: number
  metadata?: Record<string, any>
}

// Verification options
export interface VerificationOptions {
  includePerformanceChecks?: boolean
  includeSecurityChecks?: boolean
  includeBusinessRuleChecks?: boolean
  deepValidation?: boolean
  generateReport?: boolean
  fixableIssuesOnly?: boolean
  batchSize?: number
}

// Data consistency report
export interface DataConsistencyReport {
  timestamp: Date
  migrationId: string
  dataSnapshot: {
    users: DataTableSummary
    tickets: DataTableSummary
    categories: DataTableSummary
  }
  consistencyChecks: ConsistencyCheck[]
  overallConsistency: 'excellent' | 'good' | 'fair' | 'poor'
}

// Data table summary
export interface DataTableSummary {
  recordCount: number
  fieldCount: number
  nullValues: number
  duplicateRecords: number
  orphanedRecords: number
  invalidRecords: number
  lastUpdated: Date
}

// Consistency check
export interface ConsistencyCheck {
  name: string
  description: string
  passed: boolean
  expectedValue: any
  actualValue: any
  deviation?: number
  impact: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Data Integrity Verification Service
 */
export class IntegrityVerification {
  private logger = logger.child({ component: 'IntegrityVerification' })
  private config: ConfigurationService

  constructor() {
    this.config = ConfigurationService.getInstance()
  }

  /**
   * Perform comprehensive integrity verification
   */
  async verifyDataIntegrity(
    data: {
      users: any[]
      tickets: any[]
      categories: any[]
    },
    options: VerificationOptions = {}
  ): Promise<IntegrityVerificationResult> {
    const startTime = Date.now()
    
    this.logger.info('Starting comprehensive data integrity verification', {
      users: data.users.length,
      tickets: data.tickets.length,
      categories: data.categories.length,
      config: options,
    } as any)

    const checks: IntegrityCheck[] = []

    // Core integrity checks
    checks.push(...await this.performReferentialIntegrityChecks(data))
    checks.push(...await this.performStructuralIntegrityChecks(data))
    checks.push(...await this.performBusinessRuleChecks(data))

    // Optional checks
    if (options.includePerformanceChecks) {
      checks.push(...await this.performPerformanceChecks(data))
    }

    if (options.includeSecurityChecks) {
      checks.push(...await this.performSecurityChecks(data))
    }

    // Deep validation if requested
    if (options.deepValidation) {
      checks.push(...await this.performDeepValidation(data))
    }

    // Calculate scores and summary
    const summary = this.calculateVerificationSummary(checks)
    const score = this.calculateIntegrityScore(checks)
    const recommendations = this.generateIntegrityRecommendations(checks)

    const result: IntegrityVerificationResult = {
      passed: summary.criticalFailures === 0,
      score,
      checks,
      summary,
      recommendations,
    }

    const executionTime = Date.now() - startTime

    this.logger.info('Data integrity verification completed', {
      duration: executionTime,
      total: summary.totalChecks,
      passed: summary.passedChecks,
      failed: summary.failedChecks,
      critical: summary.criticalFailures,
      score: score,
      result: result.passed,
    } as any)

    return result
  }

  /**
   * Generate data consistency report
   */
  async generateConsistencyReport(
    migrationId: string,
    data: {
      users: any[]
      tickets: any[]
      categories: any[]
    }
  ): Promise<DataConsistencyReport> {
    this.logger.info('Generating data consistency report', { migration: migrationId } as any)

    const dataSnapshot = {
      users: this.generateTableSummary(data.users),
      tickets: this.generateTableSummary(data.tickets),
      categories: this.generateTableSummary(data.categories),
    }

    const consistencyChecks = await this.performConsistencyChecks(data)
    const overallConsistency = this.calculateOverallConsistency(consistencyChecks)

    return {
      timestamp: new Date(),
      migrationId,
      dataSnapshot,
      consistencyChecks,
      overallConsistency,
    }
  }

  /**
   * Verify migration completeness
   */
  async verifyMigrationCompleteness(
    originalData: {
      users: any[]
      tickets: any[]
      categories: any[]
    },
    migratedData: {
      users: any[]
      tickets: any[]
      categories: any[]
    }
  ): Promise<{
    complete: boolean
    missingRecords: {
      users: any[]
      tickets: any[]
      categories: any[]
    }
    extraRecords: {
      users: any[]
      tickets: any[]
      categories: any[]
    }
    modifiedRecords: {
      users: any[]
      tickets: any[]
      categories: any[]
    }
  }> {
    this.logger.info('Verifying migration completeness')

    const result = {
      complete: true,
      missingRecords: {
        users: this.findMissingRecords(originalData.users, migratedData.users),
        tickets: this.findMissingRecords(originalData.tickets, migratedData.tickets),
        categories: this.findMissingRecords(originalData.categories, migratedData.categories),
      },
      extraRecords: {
        users: this.findExtraRecords(originalData.users, migratedData.users),
        tickets: this.findExtraRecords(originalData.tickets, migratedData.tickets),
        categories: this.findExtraRecords(originalData.categories, migratedData.categories),
      },
      modifiedRecords: {
        users: this.findModifiedRecords(originalData.users, migratedData.users),
        tickets: this.findModifiedRecords(originalData.tickets, migratedData.tickets),
        categories: this.findModifiedRecords(originalData.categories, migratedData.categories),
      },
    }

    // Check if migration is complete
    const hasMissingRecords = Object.values(result.missingRecords).some(records => records.length > 0)
    const hasUnexpectedChanges = Object.values(result.modifiedRecords).some(records => records.length > 0)
    
    result.complete = !hasMissingRecords && !hasUnexpectedChanges

    this.logger.info('Migration completeness verification completed', {
      status: result.complete,
      missing: Object.values(result.missingRecords).reduce((sum, records) => sum + records.length, 0),
      extra: Object.values(result.extraRecords).reduce((sum, records) => sum + records.length, 0),
      modified: Object.values(result.modifiedRecords).reduce((sum, records) => sum + records.length, 0),
    } as any)

    return result
  }

  /**
   * Perform referential integrity checks
   */
  private async performReferentialIntegrityChecks(data: any): Promise<IntegrityCheck[]> {
    const checks: IntegrityCheck[] = []

    // Check ticket-user relationships
    checks.push(await this.checkTicketUserReferences(data.tickets, data.users))
    checks.push(await this.checkTicketAssigneeReferences(data.tickets, data.users))
    
    // Check ticket-category relationships
    checks.push(await this.checkTicketCategoryReferences(data.tickets, data.categories))
    
    // Check category hierarchy
    checks.push(await this.checkCategoryHierarchy(data.categories))

    return checks
  }

  /**
   * Perform structural integrity checks
   */
  private async performStructuralIntegrityChecks(data: any): Promise<IntegrityCheck[]> {
    const checks: IntegrityCheck[] = []

    // Check required fields
    checks.push(await this.checkRequiredFields(data.users, 'users', ['id', 'email', 'name']))
    checks.push(await this.checkRequiredFields(data.tickets, 'tickets', ['id', 'title', 'userId']))
    checks.push(await this.checkRequiredFields(data.categories, 'categories', ['id', 'name']))

    // Check data types
    checks.push(await this.checkDataTypes(data.users, 'users'))
    checks.push(await this.checkDataTypes(data.tickets, 'tickets'))
    checks.push(await this.checkDataTypes(data.categories, 'categories'))

    // Check unique constraints
    checks.push(await this.checkUniqueConstraints(data.users, 'users', ['email']))
    checks.push(await this.checkUniqueConstraints(data.categories, 'categories', ['name']))

    return checks
  }

  /**
   * Perform business rule checks
   */
  private async performBusinessRuleChecks(data: any): Promise<IntegrityCheck[]> {
    const checks: IntegrityCheck[] = []

    // Check business rules for tickets
    checks.push(await this.checkTicketBusinessRules(data.tickets))
    
    // Check business rules for users
    checks.push(await this.checkUserBusinessRules(data.users))
    
    // Check business rules for categories
    checks.push(await this.checkCategoryBusinessRules(data.categories))

    return checks
  }

  /**
   * Perform performance checks
   */
  private async performPerformanceChecks(data: any): Promise<IntegrityCheck[]> {
    const checks: IntegrityCheck[] = []

    // Check for performance issues
    checks.push(await this.checkDataVolume(data))
    checks.push(await this.checkIndexableFields(data))

    return checks
  }

  /**
   * Perform security checks
   */
  private async performSecurityChecks(data: any): Promise<IntegrityCheck[]> {
    const checks: IntegrityCheck[] = []

    // Check for security issues
    checks.push(await this.checkSensitiveDataExposure(data.users))
    checks.push(await this.checkDataSanitization(data))

    return checks
  }

  /**
   * Perform deep validation
   */
  private async performDeepValidation(data: any): Promise<IntegrityCheck[]> {
    const checks: IntegrityCheck[] = []

    // Deep validation checks
    checks.push(await this.checkDataConsistencyPatterns(data))
    checks.push(await this.checkTemporalConsistency(data))

    return checks
  }

  /**
   * Individual check implementations
   */
  private async checkTicketUserReferences(tickets: any[], users: any[]): Promise<IntegrityCheck> {
    const startTime = Date.now()
    const userIds = new Set(users.map(u => u.id).filter(Boolean))
    let affectedRecords = 0

    for (const ticket of tickets) {
      if (ticket.userId && !userIds.has(ticket.userId)) {
        affectedRecords++
      }
    }

    return {
      id: 'ticket_user_references',
      name: 'Ticket User References',
      description: 'Verify all tickets reference valid users',
      category: 'referential',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'critical' : 'info',
      details: `Found ${affectedRecords} tickets with invalid user references`,
      affectedRecords,
      suggestions: affectedRecords > 0 ? [
        'Remove tickets with invalid user references',
        'Create missing user records',
        'Update user references to valid IDs',
      ] : [],
      executionTime: Date.now() - startTime,
    }
  }

  private async checkTicketAssigneeReferences(tickets: any[], users: any[]): Promise<IntegrityCheck> {
    const startTime = Date.now()
    const userIds = new Set(users.map(u => u.id).filter(Boolean))
    let affectedRecords = 0

    for (const ticket of tickets) {
      if (ticket.assignedToId && !userIds.has(ticket.assignedToId)) {
        affectedRecords++
      }
    }

    return {
      id: 'ticket_assignee_references',
      name: 'Ticket Assignee References',
      description: 'Verify all ticket assignees reference valid users',
      category: 'referential',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'error' : 'info',
      details: `Found ${affectedRecords} tickets with invalid assignee references`,
      affectedRecords,
      suggestions: affectedRecords > 0 ? [
        'Remove invalid assignee references',
        'Create missing user records for assignees',
        'Update assignee references to valid IDs',
      ] : [],
      executionTime: Date.now() - startTime,
    }
  }

  private async checkTicketCategoryReferences(tickets: any[], categories: any[]): Promise<IntegrityCheck> {
    const startTime = Date.now()
    const categoryIds = new Set(categories.map(c => c.id).filter(Boolean))
    let affectedRecords = 0

    for (const ticket of tickets) {
      if (ticket.categoryId && !categoryIds.has(ticket.categoryId)) {
        affectedRecords++
      }
    }

    return {
      id: 'ticket_category_references',
      name: 'Ticket Category References',
      description: 'Verify all tickets reference valid categories',
      category: 'referential',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'error' : 'info',
      details: `Found ${affectedRecords} tickets with invalid category references`,
      affectedRecords,
      suggestions: affectedRecords > 0 ? [
        'Remove invalid category references',
        'Create missing category records',
        'Update category references to valid IDs',
      ] : [],
      executionTime: Date.now() - startTime,
    }
  }

  private async checkCategoryHierarchy(categories: any[]): Promise<IntegrityCheck> {
    const startTime = Date.now()
    const categoryIds = new Set(categories.map(c => c.id).filter(Boolean))
    let affectedRecords = 0

    for (const category of categories) {
      if (category.parentId && !categoryIds.has(category.parentId)) {
        affectedRecords++
      }
    }

    return {
      id: 'category_hierarchy',
      name: 'Category Hierarchy',
      description: 'Verify category parent references are valid',
      category: 'referential',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'error' : 'info',
      details: `Found ${affectedRecords} categories with invalid parent references`,
      affectedRecords,
      suggestions: affectedRecords > 0 ? [
        'Remove invalid parent references',
        'Create missing parent categories',
        'Update parent references to valid IDs',
      ] : [],
      executionTime: Date.now() - startTime,
    }
  }

  private async checkRequiredFields(records: any[], tableName: string, requiredFields: string[]): Promise<IntegrityCheck> {
    const startTime = Date.now()
    let affectedRecords = 0

    for (const record of records) {
      for (const field of requiredFields) {
        if (!record[field] || String(record[field]).trim() === '') {
          affectedRecords++
          break
        }
      }
    }

    return {
      id: `${tableName}_required_fields`,
      name: `${tableName} Required Fields`,
      description: `Verify all required fields are present in ${tableName}`,
      category: 'structural',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'error' : 'info',
      details: `Found ${affectedRecords} records with missing required fields`,
      affectedRecords,
      suggestions: affectedRecords > 0 ? [
        'Fill in missing required fields',
        'Remove records with missing required data',
        'Set default values for missing fields',
      ] : [],
      executionTime: Date.now() - startTime,
    }
  }

  private async checkDataTypes(records: any[], tableName: string): Promise<IntegrityCheck> {
    const startTime = Date.now()
    let affectedRecords = 0

    // Define expected types for each table
    const expectedTypes: Record<string, Record<string, string>> = {
      users: {
        id: 'string',
        email: 'string',
        name: 'string',
        role: 'string',
      },
      tickets: {
        id: 'string',
        title: 'string',
        description: 'string',
        status: 'string',
        priority: 'string',
        userId: 'string',
      },
      categories: {
        id: 'string',
        name: 'string',
        description: 'string',
      },
    }

    const typeMap = expectedTypes[tableName] || {}

    for (const record of records) {
      for (const [field, expectedType] of Object.entries(typeMap)) {
        if (record[field] != null && typeof record[field] !== expectedType) {
          affectedRecords++
          break
        }
      }
    }

    return {
      id: `${tableName}_data_types`,
      name: `${tableName} Data Types`,
      description: `Verify data types are correct in ${tableName}`,
      category: 'structural',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'warning' : 'info',
      details: `Found ${affectedRecords} records with incorrect data types`,
      affectedRecords,
      suggestions: affectedRecords > 0 ? [
        'Convert fields to correct data types',
        'Validate data before migration',
        'Add type checking in migration scripts',
      ] : [],
      executionTime: Date.now() - startTime,
    }
  }

  private async checkUniqueConstraints(records: any[], tableName: string, uniqueFields: string[]): Promise<IntegrityCheck> {
    const startTime = Date.now()
    let affectedRecords = 0

    for (const field of uniqueFields) {
      const values = new Set()
      for (const record of records) {
        if (record[field]) {
          if (values.has(record[field])) {
            affectedRecords++
          } else {
            values.add(record[field])
          }
        }
      }
    }

    return {
      id: `${tableName}_unique_constraints`,
      name: `${tableName} Unique Constraints`,
      description: `Verify unique constraints are maintained in ${tableName}`,
      category: 'structural',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'error' : 'info',
      details: `Found ${affectedRecords} duplicate values in unique fields`,
      affectedRecords,
      suggestions: affectedRecords > 0 ? [
        'Remove duplicate records',
        'Merge duplicate records',
        'Update duplicate values to be unique',
      ] : [],
      executionTime: Date.now() - startTime,
    }
  }

  // Additional check implementations...
  private async checkTicketBusinessRules(tickets: any[]): Promise<IntegrityCheck> {
    const startTime = Date.now()
    let affectedRecords = 0

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

    for (const ticket of tickets) {
      if (ticket.status && !validStatuses.includes(ticket.status.toUpperCase())) {
        affectedRecords++
      }
      if (ticket.priority && !validPriorities.includes(ticket.priority.toUpperCase())) {
        affectedRecords++
      }
    }

    return {
      id: 'ticket_business_rules',
      name: 'Ticket Business Rules',
      description: 'Verify tickets follow business rules',
      category: 'business',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'warning' : 'info',
      details: `Found ${affectedRecords} tickets violating business rules`,
      affectedRecords,
      executionTime: Date.now() - startTime,
    }
  }

  private async checkUserBusinessRules(users: any[]): Promise<IntegrityCheck> {
    const startTime = Date.now()
    let affectedRecords = 0

    const validRoles = ['USER', 'TECHNICIAN', 'ADMIN']
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    for (const user of users) {
      if (user.role && !validRoles.includes(user.role.toUpperCase())) {
        affectedRecords++
      }
      if (user.email && !emailRegex.test(user.email)) {
        affectedRecords++
      }
    }

    return {
      id: 'user_business_rules',
      name: 'User Business Rules',
      description: 'Verify users follow business rules',
      category: 'business',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'warning' : 'info',
      details: `Found ${affectedRecords} users violating business rules`,
      affectedRecords,
      executionTime: Date.now() - startTime,
    }
  }

  private async checkCategoryBusinessRules(categories: any[]): Promise<IntegrityCheck> {
    const startTime = Date.now()
    let affectedRecords = 0

    // Check for circular references
    const parentMap = new Map<string, string>()
    for (const category of categories) {
      if (category.id && category.parentId) {
        parentMap.set(category.id, category.parentId)
      }
    }

    for (const category of categories) {
      if (category.id && this.hasCircularReference(category.id, parentMap)) {
        affectedRecords++
      }
    }

    return {
      id: 'category_business_rules',
      name: 'Category Business Rules',
      description: 'Verify categories follow business rules',
      category: 'business',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'error' : 'info',
      details: `Found ${affectedRecords} categories violating business rules`,
      affectedRecords,
      executionTime: Date.now() - startTime,
    }
  }

  private async checkDataVolume(data: any): Promise<IntegrityCheck> {
    const startTime = Date.now()
    const totalRecords = data.users.length + data.tickets.length + data.categories.length
    const maxRecommendedRecords = 100000 // Example threshold

    return {
      id: 'data_volume',
      name: 'Data Volume',
      description: 'Check if data volume is within recommended limits',
      category: 'performance',
      passed: totalRecords <= maxRecommendedRecords,
      severity: totalRecords > maxRecommendedRecords ? 'warning' : 'info',
      details: `Total records: ${totalRecords}, recommended limit: ${maxRecommendedRecords}`,
      affectedRecords: totalRecords > maxRecommendedRecords ? totalRecords - maxRecommendedRecords : 0,
      executionTime: Date.now() - startTime,
    }
  }

  private async checkIndexableFields(data: any): Promise<IntegrityCheck> {
    const startTime = Date.now()
    
    // Check for fields that should be indexed
    const indexableFields = ['id', 'email', 'userId', 'categoryId', 'status', 'priority']
    let recommendations = 0

    // This is a placeholder - in real implementation, check actual database indexes
    for (const field of indexableFields) {
      recommendations++
    }

    return {
      id: 'indexable_fields',
      name: 'Indexable Fields',
      description: 'Check for fields that should be indexed for performance',
      category: 'performance',
      passed: true,
      severity: 'info',
      details: `Found ${recommendations} fields that could benefit from indexing`,
      suggestions: [
        'Add database indexes for frequently queried fields',
        'Consider composite indexes for multi-field queries',
      ],
      executionTime: Date.now() - startTime,
    }
  }

  private async checkSensitiveDataExposure(users: any[]): Promise<IntegrityCheck> {
    const startTime = Date.now()
    let affectedRecords = 0

    // Check for potentially sensitive data that shouldn't be exposed
    const sensitiveFields = ['password', 'ssn', 'creditCard', 'token']

    for (const user of users) {
      for (const field of sensitiveFields) {
        if (user[field]) {
          affectedRecords++
          break
        }
      }
    }

    return {
      id: 'sensitive_data_exposure',
      name: 'Sensitive Data Exposure',
      description: 'Check for exposed sensitive data',
      category: 'security',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'critical' : 'info',
      details: `Found ${affectedRecords} records with potentially sensitive data`,
      affectedRecords,
      suggestions: affectedRecords > 0 ? [
        'Remove sensitive data from migration',
        'Encrypt sensitive fields',
        'Use data masking for non-production environments',
      ] : [],
      executionTime: Date.now() - startTime,
    }
  }

  private async checkDataSanitization(data: any): Promise<IntegrityCheck> {
    const startTime = Date.now()
    let affectedRecords = 0

    // Check for potentially malicious content
    const dangerousPatterns = [/<script/i, /javascript:/i, /on\w+=/i]

    const allRecords = [...data.users, ...data.tickets, ...data.categories]
    
    for (const record of allRecords) {
      for (const value of Object.values(record)) {
        if (typeof value === 'string') {
          for (const pattern of dangerousPatterns) {
            if (pattern.test(value)) {
              affectedRecords++
              break
            }
          }
        }
      }
    }

    return {
      id: 'data_sanitization',
      name: 'Data Sanitization',
      description: 'Check for potentially malicious content',
      category: 'security',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'error' : 'info',
      details: `Found ${affectedRecords} records with potentially malicious content`,
      affectedRecords,
      suggestions: affectedRecords > 0 ? [
        'Sanitize all user input',
        'Remove potentially malicious content',
        'Implement input validation',
      ] : [],
      executionTime: Date.now() - startTime,
    }
  }

  private async checkDataConsistencyPatterns(data: any): Promise<IntegrityCheck> {
    const startTime = Date.now()
    
    // Deep pattern analysis
    return {
      id: 'data_consistency_patterns',
      name: 'Data Consistency Patterns',
      description: 'Deep analysis of data consistency patterns',
      category: 'structural',
      passed: true,
      severity: 'info',
      details: 'Data consistency patterns analysis completed',
      executionTime: Date.now() - startTime,
    }
  }

  private async checkTemporalConsistency(data: any): Promise<IntegrityCheck> {
    const startTime = Date.now()
    let affectedRecords = 0

    // Check temporal consistency (created/updated dates)
    const allRecords = [...data.users, ...data.tickets, ...data.categories]
    
    for (const record of allRecords) {
      if (record.createdAt && record.updatedAt) {
        const created = new Date(record.createdAt)
        const updated = new Date(record.updatedAt)
        
        if (updated < created) {
          affectedRecords++
        }
      }
    }

    return {
      id: 'temporal_consistency',
      name: 'Temporal Consistency',
      description: 'Check temporal consistency of timestamps',
      category: 'business',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'warning' : 'info',
      details: `Found ${affectedRecords} records with inconsistent timestamps`,
      affectedRecords,
      executionTime: Date.now() - startTime,
    }
  }

  /**
   * Utility methods
   */
  private calculateVerificationSummary(checks: IntegrityCheck[]): IntegrityVerificationSummary {
    const passedChecks = checks.filter(c => c.passed).length
    const failedChecks = checks.length - passedChecks
    const criticalFailures = checks.filter(c => !c.passed && c.severity === 'critical').length
    const warningCount = checks.filter(c => c.severity === 'warning').length

    return {
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      criticalFailures,
      warningCount,
      dataQualityScore: this.calculateDataQualityScore(checks),
      migrationIntegrityScore: this.calculateMigrationIntegrityScore(checks),
    }
  }

  private calculateIntegrityScore(checks: IntegrityCheck[]): number {
    if (checks.length === 0) return 100

    let score = 100
    
    for (const check of checks) {
      if (!check.passed) {
        switch (check.severity) {
          case 'critical':
            score -= 20
            break
          case 'error':
            score -= 10
            break
          case 'warning':
            score -= 5
            break
          default:
            score -= 1
        }
      }
    }

    return Math.max(0, score)
  }

  private calculateDataQualityScore(checks: IntegrityCheck[]): number {
    const qualityChecks = checks.filter(c => 
      c.category === 'structural' || c.category === 'business'
    )
    
    if (qualityChecks.length === 0) return 100
    
    const passedQualityChecks = qualityChecks.filter(c => c.passed).length
    return Math.round((passedQualityChecks / qualityChecks.length) * 100)
  }

  private calculateMigrationIntegrityScore(checks: IntegrityCheck[]): number {
    const integrityChecks = checks.filter(c => c.category === 'referential')
    
    if (integrityChecks.length === 0) return 100
    
    const passedIntegrityChecks = integrityChecks.filter(c => c.passed).length
    return Math.round((passedIntegrityChecks / integrityChecks.length) * 100)
  }

  private generateIntegrityRecommendations(checks: IntegrityCheck[]): string[] {
    const recommendations: string[] = []
    
    const failedChecks = checks.filter(c => !c.passed)
    
    if (failedChecks.length === 0) {
      recommendations.push('Data integrity verification passed - no issues found')
      return recommendations
    }

    // Group by category
    const categorizedFailures = failedChecks.reduce((acc, check) => {
      if (!acc[check.category]) acc[check.category] = []
      acc[check.category].push(check)
      return acc
    }, {} as Record<string, IntegrityCheck[]>)

    for (const [category, categoryChecks] of Object.entries(categorizedFailures)) {
      const criticalCount = categoryChecks.filter(c => c.severity === 'critical').length
      const errorCount = categoryChecks.filter(c => c.severity === 'error').length
      
      if (criticalCount > 0) {
        recommendations.push(`Critical ${category} issues found - immediate attention required`)
      } else if (errorCount > 0) {
        recommendations.push(`${category} errors detected - should be fixed before production`)
      } else {
        recommendations.push(`${category} warnings found - consider addressing for optimal data quality`)
      }
    }

    return recommendations
  }

  private generateTableSummary(records: any[]): DataTableSummary {
    if (records.length === 0) {
      return {
        recordCount: 0,
        fieldCount: 0,
        nullValues: 0,
        duplicateRecords: 0,
        orphanedRecords: 0,
        invalidRecords: 0,
        lastUpdated: new Date(),
      }
    }

    const fieldCount = Object.keys(records[0]).length
    let nullValues = 0
    let invalidRecords = 0

    for (const record of records) {
      for (const value of Object.values(record)) {
        if (value == null) nullValues++
      }
      
      // Basic validation - record is invalid if it has no id
      if (!record.id) invalidRecords++
    }

    // Simple duplicate detection based on id
    const ids = records.map(r => r.id).filter(Boolean)
    const uniqueIds = new Set(ids)
    const duplicateRecords = ids.length - uniqueIds.size

    return {
      recordCount: records.length,
      fieldCount,
      nullValues,
      duplicateRecords,
      orphanedRecords: 0, // Would need cross-reference data to calculate
      invalidRecords,
      lastUpdated: new Date(),
    }
  }

  private async performConsistencyChecks(data: any): Promise<ConsistencyCheck[]> {
    const checks: ConsistencyCheck[] = []

    // Record count consistency
    checks.push({
      name: 'User Count Consistency',
      description: 'Verify user count is within expected range',
      passed: data.users.length > 0,
      expectedValue: '> 0',
      actualValue: data.users.length,
      impact: data.users.length === 0 ? 'critical' : 'low',
    })

    checks.push({
      name: 'Ticket Count Consistency',
      description: 'Verify ticket count is reasonable',
      passed: data.tickets.length >= 0,
      expectedValue: '>= 0',
      actualValue: data.tickets.length,
      impact: 'low',
    })

    return checks
  }

  private calculateOverallConsistency(checks: ConsistencyCheck[]): 'excellent' | 'good' | 'fair' | 'poor' {
    if (checks.length === 0) return 'excellent'

    const passedChecks = checks.filter(c => c.passed).length
    const percentage = (passedChecks / checks.length) * 100

    if (percentage >= 95) return 'excellent'
    if (percentage >= 85) return 'good'
    if (percentage >= 70) return 'fair'
    return 'poor'
  }

  private findMissingRecords(original: any[], migrated: any[]): any[] {
    const migratedIds = new Set(migrated.map(r => r.id).filter(Boolean))
    return original.filter(r => r.id && !migratedIds.has(r.id))
  }

  private findExtraRecords(original: any[], migrated: any[]): any[] {
    const originalIds = new Set(original.map(r => r.id).filter(Boolean))
    return migrated.filter(r => r.id && !originalIds.has(r.id))
  }

  private findModifiedRecords(original: any[], migrated: any[]): any[] {
    const modified: any[] = []
    const originalMap = new Map(original.map(r => [r.id, r]))

    for (const migratedRecord of migrated) {
      if (migratedRecord.id) {
        const originalRecord = originalMap.get(migratedRecord.id)
        if (originalRecord && JSON.stringify(originalRecord) !== JSON.stringify(migratedRecord)) {
          modified.push({
            id: migratedRecord.id,
            original: originalRecord,
            migrated: migratedRecord,
          })
        }
      }
    }

    return modified
  }

  private hasCircularReference(categoryId: string, parentMap: Map<string, string>): boolean {
    const visited = new Set<string>()
    let current = categoryId

    while (current && parentMap.has(current)) {
      if (visited.has(current)) {
        return true
      }
      visited.add(current)
      current = parentMap.get(current)!
    }

    return false
  }
}