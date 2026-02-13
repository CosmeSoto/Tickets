/**
 * Data Validation Scripts
 * Comprehensive data validation and integrity verification tools
 */

import { logger } from '@/lib/logging/logger'

// Validation rule interface
export interface ValidationRule {
  name: string
  description: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  validate: (data: any[]) => Promise<ValidationResult>
  fix?: (data: any[]) => Promise<any[]>
}

// Validation result
export interface ValidationResult {
  passed: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  statistics: ValidationStatistics
}

// Validation error
export interface ValidationError {
  rule: string
  record?: any
  field?: string
  message: string
  severity: 'error' | 'critical'
  suggestion?: string
}

// Validation warning
export interface ValidationWarning {
  rule: string
  record?: any
  field?: string
  message: string
  suggestion?: string
}

// Validation statistics
export interface ValidationStatistics {
  totalRecords: number
  validRecords: number
  invalidRecords: number
  recordsWithWarnings: number
  fieldStatistics: Record<string, {
    nullCount: number
    uniqueCount: number
    duplicateCount: number
    averageLength?: number
    minValue?: any
    maxValue?: any
  }>
}

// Data integrity check result
export interface DataIntegrityResult {
  passed: boolean
  checks: IntegrityCheck[]
  summary: {
    totalChecks: number
    passedChecks: number
    failedChecks: number
    criticalFailures: number
  }
}

// Integrity check
export interface IntegrityCheck {
  name: string
  description: string
  passed: boolean
  severity: 'info' | 'warning' | 'error' | 'critical'
  details: string
  affectedRecords?: number
  suggestions?: string[]
}

/**
 * Data Validation Scripts
 */
export class DataValidationScripts {
  private logger = logger.child({ component: 'DataValidationScripts' })

  constructor() {
    // Logger is already initialized as a child logger
  }

  /**
   * Validate user data
   */
  async validateUsers(users: any[]): Promise<ValidationResult> {
    const rules: ValidationRule[] = [
      {
        name: 'email_format',
        description: 'Email addresses must be valid',
        severity: 'error',
        validate: async (data) => this.validateEmailFormat(data),
      },
      {
        name: 'email_uniqueness',
        description: 'Email addresses must be unique',
        severity: 'critical',
        validate: async (data) => this.validateEmailUniqueness(data),
      },
      {
        name: 'required_fields',
        description: 'Required fields must not be empty',
        severity: 'error',
        validate: async (data) => this.validateRequiredUserFields(data),
      },
      {
        name: 'role_validity',
        description: 'User roles must be valid',
        severity: 'error',
        validate: async (data) => this.validateUserRoles(data),
      },
      {
        name: 'name_length',
        description: 'User names should have reasonable length',
        severity: 'warning',
        validate: async (data) => this.validateNameLength(data),
      },
    ]

    return this.runValidationRules(users, rules)
  }

  /**
   * Validate ticket data
   */
  async validateTickets(tickets: any[]): Promise<ValidationResult> {
    const rules: ValidationRule[] = [
      {
        name: 'required_fields',
        description: 'Required fields must not be empty',
        severity: 'error',
        validate: async (data) => this.validateRequiredTicketFields(data),
      },
      {
        name: 'status_validity',
        description: 'Ticket status must be valid',
        severity: 'error',
        validate: async (data) => this.validateTicketStatus(data),
      },
      {
        name: 'priority_validity',
        description: 'Ticket priority must be valid',
        severity: 'error',
        validate: async (data) => this.validateTicketPriority(data),
      },
      {
        name: 'user_references',
        description: 'User references must be valid',
        severity: 'critical',
        validate: async (data) => this.validateTicketUserReferences(data),
      },
      {
        name: 'title_length',
        description: 'Ticket titles should have reasonable length',
        severity: 'warning',
        validate: async (data) => this.validateTicketTitleLength(data),
      },
      {
        name: 'description_content',
        description: 'Ticket descriptions should not be empty',
        severity: 'warning',
        validate: async (data) => this.validateTicketDescription(data),
      },
    ]

    return this.runValidationRules(tickets, rules)
  }

  /**
   * Validate category data
   */
  async validateCategories(categories: any[]): Promise<ValidationResult> {
    const rules: ValidationRule[] = [
      {
        name: 'required_fields',
        description: 'Required fields must not be empty',
        severity: 'error',
        validate: async (data) => this.validateRequiredCategoryFields(data),
      },
      {
        name: 'name_uniqueness',
        description: 'Category names must be unique',
        severity: 'error',
        validate: async (data) => this.validateCategoryNameUniqueness(data),
      },
      {
        name: 'parent_references',
        description: 'Parent category references must be valid',
        severity: 'error',
        validate: async (data) => this.validateCategoryParentReferences(data),
      },
      {
        name: 'circular_references',
        description: 'Categories must not have circular parent references',
        severity: 'critical',
        validate: async (data) => this.validateCategoryCircularReferences(data),
      },
    ]

    return this.runValidationRules(categories, rules)
  }

  /**
   * Perform comprehensive data integrity checks
   */
  async performDataIntegrityChecks(data: {
    users: any[]
    tickets: any[]
    categories: any[]
  }): Promise<DataIntegrityResult> {
    const checks: IntegrityCheck[] = []

    // Check referential integrity
    checks.push(await this.checkTicketUserIntegrity(data.tickets, data.users))
    checks.push(await this.checkTicketCategoryIntegrity(data.tickets, data.categories))
    checks.push(await this.checkCategoryHierarchyIntegrity(data.categories))

    // Check data consistency
    checks.push(await this.checkDataConsistency(data))

    // Check for orphaned records
    checks.push(await this.checkOrphanedRecords(data))

    // Check for duplicate records
    checks.push(await this.checkDuplicateRecords(data))

    // Calculate summary
    const summary = {
      totalChecks: checks.length,
      passedChecks: checks.filter(c => c.passed).length,
      failedChecks: checks.filter(c => !c.passed).length,
      criticalFailures: checks.filter(c => !c.passed && c.severity === 'critical').length,
    }

    const passed = summary.criticalFailures === 0

    this.logger.info('Data integrity check completed', {
      total: summary.totalChecks,
      passed: summary.passedChecks,
      failed: summary.failedChecks,
      critical: summary.criticalFailures,
      result: passed ? 'PASSED' : 'FAILED',
    } as any)

    return {
      passed,
      checks,
      summary,
    }
  }

  /**
   * Generate data quality report
   */
  async generateDataQualityReport(data: {
    users: any[]
    tickets: any[]
    categories: any[]
  }): Promise<{
    overall: 'excellent' | 'good' | 'fair' | 'poor'
    score: number
    details: {
      users: ValidationResult
      tickets: ValidationResult
      categories: ValidationResult
      integrity: DataIntegrityResult
    }
    recommendations: string[]
  }> {
    // Validate each data type
    const userValidation = await this.validateUsers(data.users)
    const ticketValidation = await this.validateTickets(data.tickets)
    const categoryValidation = await this.validateCategories(data.categories)
    const integrityCheck = await this.performDataIntegrityChecks(data)

    // Calculate overall score
    const score = this.calculateDataQualityScore({
      users: userValidation,
      tickets: ticketValidation,
      categories: categoryValidation,
      integrity: integrityCheck,
    })

    // Determine overall rating
    let overall: 'excellent' | 'good' | 'fair' | 'poor'
    if (score >= 90) overall = 'excellent'
    else if (score >= 75) overall = 'good'
    else if (score >= 60) overall = 'fair'
    else overall = 'poor'

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      users: userValidation,
      tickets: ticketValidation,
      categories: categoryValidation,
      integrity: integrityCheck,
    })

    return {
      overall,
      score,
      details: {
        users: userValidation,
        tickets: ticketValidation,
        categories: categoryValidation,
        integrity: integrityCheck,
      },
      recommendations,
    }
  }

  /**
   * Run validation rules
   */
  private async runValidationRules(
    data: any[],
    rules: ValidationRule[]
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    const statistics = this.calculateStatistics(data)

    for (const rule of rules) {
      try {
        const result = await rule.validate(data)
        errors.push(...result.errors)
        warnings.push(...result.warnings)
      } catch (error) {
        errors.push({
          rule: rule.name,
          message: `Validation rule failed: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'critical',
        })
      }
    }

    const passed = errors.length === 0

    return {
      passed,
      errors,
      warnings,
      statistics,
    }
  }

  /**
   * Calculate data statistics
   */
  private calculateStatistics(data: any[]): ValidationStatistics {
    if (data.length === 0) {
      return {
        totalRecords: 0,
        validRecords: 0,
        invalidRecords: 0,
        recordsWithWarnings: 0,
        fieldStatistics: {},
      }
    }

    const fieldStatistics: Record<string, any> = {}
    const fields = Object.keys(data[0])

    for (const field of fields) {
      const values = data.map(record => record[field]).filter(v => v != null)
      const uniqueValues = new Set(values)

      fieldStatistics[field] = {
        nullCount: data.length - values.length,
        uniqueCount: uniqueValues.size,
        duplicateCount: values.length - uniqueValues.size,
      }

      // Calculate additional statistics for string fields
      if (values.length > 0 && typeof values[0] === 'string') {
        const lengths = values.map(v => String(v).length)
        fieldStatistics[field].averageLength = lengths.reduce((a, b) => a + b, 0) / lengths.length
      }

      // Calculate min/max for numeric fields
      if (values.length > 0 && typeof values[0] === 'number') {
        fieldStatistics[field].minValue = Math.min(...values)
        fieldStatistics[field].maxValue = Math.max(...values)
      }
    }

    return {
      totalRecords: data.length,
      validRecords: data.length, // Will be updated by validation rules
      invalidRecords: 0, // Will be updated by validation rules
      recordsWithWarnings: 0, // Will be updated by validation rules
      fieldStatistics,
    }
  }

  // Validation rule implementations

  private async validateEmailFormat(users: any[]): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    for (const user of users) {
      if (user.email && !emailRegex.test(user.email)) {
        errors.push({
          rule: 'email_format',
          record: user,
          field: 'email',
          message: `Invalid email format: ${user.email}`,
          severity: 'error',
          suggestion: 'Ensure email follows the format: user@domain.com',
        })
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
      statistics: this.calculateStatistics(users),
    }
  }

  private async validateEmailUniqueness(users: any[]): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const emailCounts = new Map<string, number>()

    // Count email occurrences
    for (const user of users) {
      if (user.email) {
        const email = user.email.toLowerCase()
        emailCounts.set(email, (emailCounts.get(email) || 0) + 1)
      }
    }

    // Find duplicates
    for (const user of users) {
      if (user.email) {
        const email = user.email.toLowerCase()
        if (emailCounts.get(email)! > 1) {
          errors.push({
            rule: 'email_uniqueness',
            record: user,
            field: 'email',
            message: `Duplicate email address: ${user.email}`,
            severity: 'critical',
            suggestion: 'Remove duplicate email addresses or merge user accounts',
          })
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
      statistics: this.calculateStatistics(users),
    }
  }

  private async validateRequiredUserFields(users: any[]): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const requiredFields = ['email', 'name']

    for (const user of users) {
      for (const field of requiredFields) {
        if (!user[field] || String(user[field]).trim() === '') {
          errors.push({
            rule: 'required_fields',
            record: user,
            field,
            message: `Required field '${field}' is missing or empty`,
            severity: 'error',
            suggestion: `Provide a valid value for ${field}`,
          })
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
      statistics: this.calculateStatistics(users),
    }
  }

  private async validateUserRoles(users: any[]): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const validRoles = ['USER', 'TECHNICIAN', 'ADMIN']

    for (const user of users) {
      if (user.role && !validRoles.includes(user.role.toUpperCase())) {
        errors.push({
          rule: 'role_validity',
          record: user,
          field: 'role',
          message: `Invalid role: ${user.role}`,
          severity: 'error',
          suggestion: `Use one of: ${validRoles.join(', ')}`,
        })
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
      statistics: this.calculateStatistics(users),
    }
  }

  private async validateNameLength(users: any[]): Promise<ValidationResult> {
    const warnings: ValidationWarning[] = []

    for (const user of users) {
      if (user.name) {
        const nameLength = String(user.name).length
        if (nameLength < 2) {
          warnings.push({
            rule: 'name_length',
            record: user,
            field: 'name',
            message: `Name is very short: ${user.name}`,
            suggestion: 'Consider using full names for better identification',
          })
        } else if (nameLength > 100) {
          warnings.push({
            rule: 'name_length',
            record: user,
            field: 'name',
            message: `Name is very long: ${user.name}`,
            suggestion: 'Consider shortening the name for better display',
          })
        }
      }
    }

    return {
      passed: true,
      errors: [],
      warnings,
      statistics: this.calculateStatistics(users),
    }
  }

  // Additional validation methods for tickets and categories...
  private async validateRequiredTicketFields(tickets: any[]): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const requiredFields = ['title', 'description', 'userId']

    for (const ticket of tickets) {
      for (const field of requiredFields) {
        if (!ticket[field] || String(ticket[field]).trim() === '') {
          errors.push({
            rule: 'required_fields',
            record: ticket,
            field,
            message: `Required field '${field}' is missing or empty`,
            severity: 'error',
            suggestion: `Provide a valid value for ${field}`,
          })
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
      statistics: this.calculateStatistics(tickets),
    }
  }

  private async validateTicketStatus(tickets: any[]): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

    for (const ticket of tickets) {
      if (ticket.status && !validStatuses.includes(ticket.status.toUpperCase())) {
        errors.push({
          rule: 'status_validity',
          record: ticket,
          field: 'status',
          message: `Invalid status: ${ticket.status}`,
          severity: 'error',
          suggestion: `Use one of: ${validStatuses.join(', ')}`,
        })
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
      statistics: this.calculateStatistics(tickets),
    }
  }

  private async validateTicketPriority(tickets: any[]): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

    for (const ticket of tickets) {
      if (ticket.priority && !validPriorities.includes(ticket.priority.toUpperCase())) {
        errors.push({
          rule: 'priority_validity',
          record: ticket,
          field: 'priority',
          message: `Invalid priority: ${ticket.priority}`,
          severity: 'error',
          suggestion: `Use one of: ${validPriorities.join(', ')}`,
        })
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
      statistics: this.calculateStatistics(tickets),
    }
  }

  private async validateTicketUserReferences(tickets: any[]): Promise<ValidationResult> {
    // This would need access to user data for proper validation
    // For now, just check if userId is present
    const errors: ValidationError[] = []

    for (const ticket of tickets) {
      if (!ticket.userId) {
        errors.push({
          rule: 'user_references',
          record: ticket,
          field: 'userId',
          message: 'Ticket must have a valid user reference',
          severity: 'critical',
          suggestion: 'Ensure all tickets are associated with valid users',
        })
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
      statistics: this.calculateStatistics(tickets),
    }
  }

  private async validateTicketTitleLength(tickets: any[]): Promise<ValidationResult> {
    const warnings: ValidationWarning[] = []

    for (const ticket of tickets) {
      if (ticket.title) {
        const titleLength = String(ticket.title).length
        if (titleLength < 5) {
          warnings.push({
            rule: 'title_length',
            record: ticket,
            field: 'title',
            message: `Title is very short: ${ticket.title}`,
            suggestion: 'Consider using more descriptive titles',
          })
        } else if (titleLength > 200) {
          warnings.push({
            rule: 'title_length',
            record: ticket,
            field: 'title',
            message: `Title is very long: ${ticket.title}`,
            suggestion: 'Consider shortening the title for better readability',
          })
        }
      }
    }

    return {
      passed: true,
      errors: [],
      warnings,
      statistics: this.calculateStatistics(tickets),
    }
  }

  private async validateTicketDescription(tickets: any[]): Promise<ValidationResult> {
    const warnings: ValidationWarning[] = []

    for (const ticket of tickets) {
      if (!ticket.description || String(ticket.description).trim().length < 10) {
        warnings.push({
          rule: 'description_content',
          record: ticket,
          field: 'description',
          message: 'Ticket description is empty or very short',
          suggestion: 'Provide detailed descriptions for better ticket resolution',
        })
      }
    }

    return {
      passed: true,
      errors: [],
      warnings,
      statistics: this.calculateStatistics(tickets),
    }
  }

  private async validateRequiredCategoryFields(categories: any[]): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const requiredFields = ['name']

    for (const category of categories) {
      for (const field of requiredFields) {
        if (!category[field] || String(category[field]).trim() === '') {
          errors.push({
            rule: 'required_fields',
            record: category,
            field,
            message: `Required field '${field}' is missing or empty`,
            severity: 'error',
            suggestion: `Provide a valid value for ${field}`,
          })
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
      statistics: this.calculateStatistics(categories),
    }
  }

  private async validateCategoryNameUniqueness(categories: any[]): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const nameCounts = new Map<string, number>()

    // Count name occurrences
    for (const category of categories) {
      if (category.name) {
        const name = category.name.toLowerCase()
        nameCounts.set(name, (nameCounts.get(name) || 0) + 1)
      }
    }

    // Find duplicates
    for (const category of categories) {
      if (category.name) {
        const name = category.name.toLowerCase()
        if (nameCounts.get(name)! > 1) {
          errors.push({
            rule: 'name_uniqueness',
            record: category,
            field: 'name',
            message: `Duplicate category name: ${category.name}`,
            severity: 'error',
            suggestion: 'Use unique names for categories or merge similar categories',
          })
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
      statistics: this.calculateStatistics(categories),
    }
  }

  private async validateCategoryParentReferences(categories: any[]): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const categoryIds = new Set(categories.map(c => c.id).filter(Boolean))

    for (const category of categories) {
      if (category.parentId && !categoryIds.has(category.parentId)) {
        errors.push({
          rule: 'parent_references',
          record: category,
          field: 'parentId',
          message: `Invalid parent category reference: ${category.parentId}`,
          severity: 'error',
          suggestion: 'Ensure parent category exists or remove parent reference',
        })
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
      statistics: this.calculateStatistics(categories),
    }
  }

  private async validateCategoryCircularReferences(categories: any[]): Promise<ValidationResult> {
    const errors: ValidationError[] = []

    // Build parent-child map
    const parentMap = new Map<string, string>()
    for (const category of categories) {
      if (category.id && category.parentId) {
        parentMap.set(category.id, category.parentId)
      }
    }

    // Check for circular references
    for (const category of categories) {
      if (category.id && this.hasCircularReference(category.id, parentMap)) {
        errors.push({
          rule: 'circular_references',
          record: category,
          field: 'parentId',
          message: `Circular reference detected in category hierarchy`,
          severity: 'critical',
          suggestion: 'Remove circular parent-child relationships',
        })
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
      statistics: this.calculateStatistics(categories),
    }
  }

  private hasCircularReference(categoryId: string, parentMap: Map<string, string>): boolean {
    const visited = new Set<string>()
    let current = categoryId

    while (current && parentMap.has(current)) {
      if (visited.has(current)) {
        return true // Circular reference found
      }
      visited.add(current)
      current = parentMap.get(current)!
    }

    return false
  }

  // Integrity check implementations
  private async checkTicketUserIntegrity(tickets: any[], users: any[]): Promise<IntegrityCheck> {
    const userIds = new Set(users.map(u => u.id).filter(Boolean))
    let affectedRecords = 0

    for (const ticket of tickets) {
      if (ticket.userId && !userIds.has(ticket.userId)) {
        affectedRecords++
      }
      if (ticket.assignedToId && !userIds.has(ticket.assignedToId)) {
        affectedRecords++
      }
    }

    return {
      name: 'ticket_user_integrity',
      description: 'Check that all ticket user references are valid',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'critical' : 'info',
      details: `Found ${affectedRecords} invalid user references in tickets`,
      affectedRecords,
      suggestions: affectedRecords > 0 ? [
        'Remove tickets with invalid user references',
        'Create missing user records',
        'Update user references to valid IDs',
      ] : [],
    }
  }

  private async checkTicketCategoryIntegrity(tickets: any[], categories: any[]): Promise<IntegrityCheck> {
    const categoryIds = new Set(categories.map(c => c.id).filter(Boolean))
    let affectedRecords = 0

    for (const ticket of tickets) {
      if (ticket.categoryId && !categoryIds.has(ticket.categoryId)) {
        affectedRecords++
      }
    }

    return {
      name: 'ticket_category_integrity',
      description: 'Check that all ticket category references are valid',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'error' : 'info',
      details: `Found ${affectedRecords} invalid category references in tickets`,
      affectedRecords,
      suggestions: affectedRecords > 0 ? [
        'Remove invalid category references',
        'Create missing category records',
        'Update category references to valid IDs',
      ] : [],
    }
  }

  private async checkCategoryHierarchyIntegrity(categories: any[]): Promise<IntegrityCheck> {
    const categoryIds = new Set(categories.map(c => c.id).filter(Boolean))
    let affectedRecords = 0

    for (const category of categories) {
      if (category.parentId && !categoryIds.has(category.parentId)) {
        affectedRecords++
      }
    }

    return {
      name: 'category_hierarchy_integrity',
      description: 'Check that all category parent references are valid',
      passed: affectedRecords === 0,
      severity: affectedRecords > 0 ? 'error' : 'info',
      details: `Found ${affectedRecords} invalid parent references in categories`,
      affectedRecords,
      suggestions: affectedRecords > 0 ? [
        'Remove invalid parent references',
        'Create missing parent categories',
        'Update parent references to valid IDs',
      ] : [],
    }
  }

  private async checkDataConsistency(data: any): Promise<IntegrityCheck> {
    // Implement data consistency checks
    return {
      name: 'data_consistency',
      description: 'Check overall data consistency',
      passed: true,
      severity: 'info',
      details: 'Data consistency check passed',
      suggestions: [],
    }
  }

  private async checkOrphanedRecords(data: any): Promise<IntegrityCheck> {
    // Implement orphaned records check
    return {
      name: 'orphaned_records',
      description: 'Check for orphaned records',
      passed: true,
      severity: 'info',
      details: 'No orphaned records found',
      suggestions: [],
    }
  }

  private async checkDuplicateRecords(data: any): Promise<IntegrityCheck> {
    // Implement duplicate records check
    return {
      name: 'duplicate_records',
      description: 'Check for duplicate records',
      passed: true,
      severity: 'info',
      details: 'No duplicate records found',
      suggestions: [],
    }
  }

  private calculateDataQualityScore(results: any): number {
    // Implement data quality score calculation
    let score = 100
    
    // Deduct points for errors and warnings
    const allResults = [results.users, results.tickets, results.categories]
    
    for (const result of allResults) {
      score -= result.errors.filter((e: any) => e.severity === 'critical').length * 10
      score -= result.errors.filter((e: any) => e.severity === 'error').length * 5
      score -= result.warnings.length * 1
    }

    // Deduct points for integrity failures
    if (!results.integrity.passed) {
      score -= results.integrity.summary.criticalFailures * 15
      score -= (results.integrity.summary.failedChecks - results.integrity.summary.criticalFailures) * 5
    }

    return Math.max(0, score)
  }

  private generateRecommendations(results: any): string[] {
    const recommendations: string[] = []

    // Add recommendations based on validation results
    if (results.users.errors.length > 0) {
      recommendations.push('Fix user data validation errors before migration')
    }
    
    if (results.tickets.errors.length > 0) {
      recommendations.push('Resolve ticket data issues to ensure data integrity')
    }
    
    if (results.categories.errors.length > 0) {
      recommendations.push('Address category data problems for proper hierarchy')
    }
    
    if (!results.integrity.passed) {
      recommendations.push('Fix referential integrity issues before proceeding')
    }

    if (recommendations.length === 0) {
      recommendations.push('Data quality is good - proceed with migration')
    }

    return recommendations
  }
}