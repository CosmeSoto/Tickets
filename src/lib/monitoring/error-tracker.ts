/**
 * Error Tracking and Alerting System
 * 
 * Comprehensive error tracking with categorization, alerting, and reporting
 */

import { ApplicationLogger } from '@/lib/logging'

export interface ErrorContext {
  userId?: string
  sessionId?: string
  userAgent?: string
  url?: string
  method?: string
  ip?: string
  timestamp?: Date
  environment?: string
  version?: string
  component?: string
  operation?: string
  metadata?: Record<string, any>
}

export interface ErrorReport {
  id: string
  message: string
  stack?: string
  type: ErrorType
  severity: ErrorSeverity
  context: ErrorContext
  fingerprint: string
  count: number
  firstSeen: Date
  lastSeen: Date
  resolved: boolean
  tags: string[]
}

export enum ErrorType {
  JAVASCRIPT = 'javascript',
  API = 'api',
  DATABASE = 'database',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NETWORK = 'network',
  SYSTEM = 'system',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_SERVICE = 'external_service'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorTrackingConfig {
  enabled: boolean
  environment: string
  version: string
  sampleRate: number
  enableStackTrace: boolean
  enableUserContext: boolean
  enablePerformanceTracking: boolean
  alerting: {
    enabled: boolean
    webhookUrl?: string
    emailRecipients?: string[]
    slackWebhook?: string
    teamsWebhook?: string
  }
  filtering: {
    ignoreErrors: string[]
    ignorePaths: string[]
    ignoreUserAgents: string[]
  }
}

const DEFAULT_CONFIG: ErrorTrackingConfig = {
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV || 'development',
  version: process.env.npm_package_version || '1.0.0',
  sampleRate: 1.0,
  enableStackTrace: true,
  enableUserContext: true,
  enablePerformanceTracking: true,
  alerting: {
    enabled: process.env.ERROR_ALERTING_ENABLED === 'true',
    webhookUrl: process.env.ERROR_WEBHOOK_URL,
    emailRecipients: process.env.ERROR_EMAIL_RECIPIENTS?.split(','),
    slackWebhook: process.env.SLACK_WEBHOOK_URL,
    teamsWebhook: process.env.TEAMS_WEBHOOK_URL
  },
  filtering: {
    ignoreErrors: [
      'Network Error',
      'ChunkLoadError',
      'Loading chunk',
      'Script error',
      'ResizeObserver loop limit exceeded'
    ],
    ignorePaths: [
      '/favicon.ico',
      '/robots.txt',
      '/_next/static'
    ],
    ignoreUserAgents: [
      'bot',
      'crawler',
      'spider',
      'scraper'
    ]
  }
}

export class ErrorTracker {
  private static config: ErrorTrackingConfig = DEFAULT_CONFIG
  private static errorStore = new Map<string, ErrorReport>()
  private static alertCooldown = new Map<string, number>()

  /**
   * Initialize error tracking
   */
  static initialize(config?: Partial<ErrorTrackingConfig>): void {
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    if (this.config.enabled) {
      this.setupGlobalErrorHandlers()
      ApplicationLogger.businessOperation('initialize_error_tracking', 'error-tracker', 'system', {
        metadata: { 
          environment: this.config.environment,
          version: this.config.version,
          alertingEnabled: this.config.alerting.enabled
        }
      })
    }
  }

  /**
   * Track an error
   */
  static async trackError(
    error: Error | string,
    context: ErrorContext = {},
    type: ErrorType = ErrorType.JAVASCRIPT,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): Promise<string> {
    if (!this.config.enabled) {
      return ''
    }

    const timer = ApplicationLogger.timer('track_error', {
      component: 'error-tracker',
      metadata: { type, severity }
    })

    try {
      // Normalize error
      const normalizedError = this.normalizeError(error)
      
      // Check if error should be ignored
      if (this.shouldIgnoreError(normalizedError, context)) {
        timer.end('Error ignored by filters')
        return ''
      }

      // Generate error fingerprint
      const fingerprint = this.generateFingerprint(normalizedError, type, context)
      
      // Create or update error report
      const errorReport = this.createOrUpdateErrorReport(
        normalizedError,
        context,
        type,
        severity,
        fingerprint
      )

      // Log the error
      ApplicationLogger.systemHealth('error-tracker', 'degraded', {
        errorId: errorReport.id,
        type,
        severity,
        message: normalizedError.message,
        fingerprint,
        count: errorReport.count
      })

      // Send alerts if needed
      await this.sendAlertsIfNeeded(errorReport)

      timer.end('Error tracked successfully')
      return errorReport.id

    } catch (trackingError) {
      const err = trackingError instanceof Error ? trackingError : new Error(String(trackingError))
      ApplicationLogger.systemHealth('error-tracker', 'unhealthy', {
        error: err.message,
        originalError: error instanceof Error ? error.message : String(error)
      })
      timer.end('Error tracking failed')
      return ''
    }
  }

  /**
   * Track API error
   */
  static async trackAPIError(
    error: Error,
    request: {
      method: string
      url: string
      headers?: Record<string, string>
      body?: any
    },
    response?: {
      status: number
      statusText: string
    },
    userId?: string
  ): Promise<string> {
    const context: ErrorContext = {
      userId,
      method: request.method,
      url: request.url,
      userAgent: request.headers?.['user-agent'],
      component: 'api',
      metadata: {
        requestBody: request.body,
        responseStatus: response?.status,
        responseStatusText: response?.statusText
      }
    }

    const severity = this.determineSeverityFromStatus(response?.status)
    return this.trackError(error, context, ErrorType.API, severity)
  }

  /**
   * Track database error
   */
  static async trackDatabaseError(
    error: Error,
    operation: string,
    query?: string,
    params?: any[]
  ): Promise<string> {
    const context: ErrorContext = {
      component: 'database',
      operation,
      metadata: {
        query: query?.substring(0, 500), // Limit query length
        paramCount: params?.length
      }
    }

    return this.trackError(error, context, ErrorType.DATABASE, ErrorSeverity.HIGH)
  }

  /**
   * Track authentication error
   */
  static async trackAuthError(
    error: Error,
    userId?: string,
    operation?: string
  ): Promise<string> {
    const context: ErrorContext = {
      userId,
      component: 'authentication',
      operation,
      metadata: {
        hasUserId: !!userId
      }
    }

    return this.trackError(error, context, ErrorType.AUTHENTICATION, ErrorSeverity.HIGH)
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): {
    totalErrors: number
    errorsByType: Record<ErrorType, number>
    errorsBySeverity: Record<ErrorSeverity, number>
    recentErrors: ErrorReport[]
    topErrors: ErrorReport[]
  } {
    const errors = Array.from(this.errorStore.values())
    
    const errorsByType = {} as Record<ErrorType, number>
    const errorsBySeverity = {} as Record<ErrorSeverity, number>
    
    // Initialize counters
    Object.values(ErrorType).forEach(type => errorsByType[type] = 0)
    Object.values(ErrorSeverity).forEach(severity => errorsBySeverity[severity] = 0)
    
    // Count errors
    errors.forEach(error => {
      errorsByType[error.type] += error.count
      errorsBySeverity[error.severity] += error.count
    })

    // Get recent errors (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentErrors = errors
      .filter(error => error.lastSeen > oneDayAgo)
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, 10)

    // Get top errors by count
    const topErrors = errors
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalErrors: errors.reduce((sum, error) => sum + error.count, 0),
      errorsByType,
      errorsBySeverity,
      recentErrors,
      topErrors
    }
  }

  /**
   * Resolve an error
   */
  static resolveError(errorId: string, resolvedBy?: string): boolean {
    const error = this.errorStore.get(errorId)
    if (!error) {
      return false
    }

    error.resolved = true
    error.tags.push(`resolved-by:${resolvedBy || 'system'}`)
    
    ApplicationLogger.businessOperation('resolve_error', 'error-tracker', 'error', {
      metadata: { errorId, resolvedBy, fingerprint: error.fingerprint }
    })

    return true
  }

  /**
   * Clear old errors
   */
  static clearOldErrors(olderThanDays: number = 30): number {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
    let clearedCount = 0

    for (const [key, error] of this.errorStore.entries()) {
      if (error.lastSeen < cutoffDate && error.resolved) {
        this.errorStore.delete(key)
        clearedCount++
      }
    }

    ApplicationLogger.businessOperation('clear_old_errors', 'error-tracker', 'maintenance', {
      metadata: { clearedCount, olderThanDays }
    })

    return clearedCount
  }

  // Private methods
  private static setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    if (typeof process !== 'undefined') {
      process.on('unhandledRejection', (reason, promise) => {
        const error = reason instanceof Error ? reason : new Error(String(reason))
        this.trackError(error, { component: 'unhandled-promise' }, ErrorType.SYSTEM, ErrorSeverity.HIGH)
      })

      process.on('uncaughtException', (error) => {
        this.trackError(error, { component: 'uncaught-exception' }, ErrorType.SYSTEM, ErrorSeverity.CRITICAL)
      })
    }

    // Handle client-side errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        const error = event.error || new Error(event.message)
        this.trackError(error, {
          url: event.filename,
          component: 'window-error',
          metadata: {
            lineno: event.lineno,
            colno: event.colno
          }
        })
      })

      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
        this.trackError(error, { component: 'unhandled-promise-client' }, ErrorType.JAVASCRIPT, ErrorSeverity.HIGH)
      })
    }
  }

  private static normalizeError(error: Error | string): Error {
    if (error instanceof Error) {
      return error
    }
    return new Error(String(error))
  }

  private static shouldIgnoreError(error: Error, context: ErrorContext): boolean {
    // Check ignored error messages
    if (this.config.filtering.ignoreErrors.some(ignored => 
      error.message.includes(ignored)
    )) {
      return true
    }

    // Check ignored paths
    if (context.url && this.config.filtering.ignorePaths.some(path => 
      context.url!.includes(path)
    )) {
      return true
    }

    // Check ignored user agents
    if (context.userAgent && this.config.filtering.ignoreUserAgents.some(agent => 
      context.userAgent!.toLowerCase().includes(agent.toLowerCase())
    )) {
      return true
    }

    return false
  }

  private static generateFingerprint(error: Error, type: ErrorType, context: ErrorContext): string {
    const components = [
      error.message,
      type,
      context.component || '',
      context.operation || '',
      error.stack?.split('\n')[1] || '' // First line of stack trace
    ]
    
    return Buffer.from(components.join('|')).toString('base64').substring(0, 16)
  }

  private static createOrUpdateErrorReport(
    error: Error,
    context: ErrorContext,
    type: ErrorType,
    severity: ErrorSeverity,
    fingerprint: string
  ): ErrorReport {
    const now = new Date()
    const existingError = this.errorStore.get(fingerprint)

    if (existingError) {
      // Update existing error
      existingError.count++
      existingError.lastSeen = now
      existingError.context = { ...existingError.context, ...context }
      return existingError
    }

    // Create new error report
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      message: error.message,
      stack: error.stack,
      type,
      severity,
      context: {
        ...context,
        timestamp: now,
        environment: this.config.environment,
        version: this.config.version
      },
      fingerprint,
      count: 1,
      firstSeen: now,
      lastSeen: now,
      resolved: false,
      tags: []
    }

    this.errorStore.set(fingerprint, errorReport)
    return errorReport
  }

  private static async sendAlertsIfNeeded(errorReport: ErrorReport): Promise<void> {
    if (!this.config.alerting.enabled) {
      return
    }

    // Check cooldown to prevent spam
    const cooldownKey = `${errorReport.fingerprint}-${errorReport.severity}`
    const lastAlert = this.alertCooldown.get(cooldownKey) || 0
    const cooldownPeriod = this.getCooldownPeriod(errorReport.severity)
    
    if (Date.now() - lastAlert < cooldownPeriod) {
      return
    }

    // Send alerts based on severity
    if (errorReport.severity === ErrorSeverity.CRITICAL || 
        (errorReport.severity === ErrorSeverity.HIGH && errorReport.count >= 5) ||
        (errorReport.severity === ErrorSeverity.MEDIUM && errorReport.count >= 10)) {
      
      await this.sendAlert(errorReport)
      this.alertCooldown.set(cooldownKey, Date.now())
    }
  }

  private static async sendAlert(errorReport: ErrorReport): Promise<void> {
    const alertData = {
      title: `🚨 Error Alert - ${errorReport.severity.toUpperCase()}`,
      message: errorReport.message,
      environment: this.config.environment,
      count: errorReport.count,
      firstSeen: errorReport.firstSeen.toISOString(),
      lastSeen: errorReport.lastSeen.toISOString(),
      component: errorReport.context.component,
      url: errorReport.context.url,
      userId: errorReport.context.userId
    }

    try {
      // Send to Teams webhook if configured
      if (this.config.alerting.teamsWebhook) {
        await this.sendTeamsAlert(this.config.alerting.teamsWebhook, alertData)
      }

      // Send to Slack webhook if configured
      if (this.config.alerting.slackWebhook) {
        await this.sendSlackAlert(this.config.alerting.slackWebhook, alertData)
      }

      ApplicationLogger.businessOperation('send_error_alert', 'error-tracker', 'alert', {
        metadata: { 
          errorId: errorReport.id,
          severity: errorReport.severity,
          alertChannels: [
            this.config.alerting.teamsWebhook ? 'teams' : null,
            this.config.alerting.slackWebhook ? 'slack' : null
          ].filter(Boolean)
        }
      })

    } catch (error) {
      ApplicationLogger.systemHealth('error-tracker', 'degraded', {
        error: error instanceof Error ? error.message : String(error),
        operation: 'send_alert'
      })
    }
  }

  private static async sendTeamsAlert(webhookUrl: string, alertData: any): Promise<void> {
    const payload = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": this.getSeverityColor(alertData.count > 10 ? 'critical' : 'high'),
      "summary": alertData.title,
      "sections": [{
        "activityTitle": alertData.title,
        "activitySubtitle": `Environment: ${alertData.environment}`,
        "facts": [
          { "name": "Error", "value": alertData.message },
          { "name": "Count", "value": alertData.count.toString() },
          { "name": "Component", "value": alertData.component || 'Unknown' },
          { "name": "First Seen", "value": alertData.firstSeen },
          { "name": "Last Seen", "value": alertData.lastSeen }
        ]
      }]
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Teams webhook failed: ${response.statusText}`)
    }
  }

  private static async sendSlackAlert(webhookUrl: string, alertData: any): Promise<void> {
    const payload = {
      text: alertData.title,
      attachments: [{
        color: this.getSeverityColor(alertData.count > 10 ? 'critical' : 'high'),
        fields: [
          { title: "Error", value: alertData.message, short: false },
          { title: "Count", value: alertData.count.toString(), short: true },
          { title: "Environment", value: alertData.environment, short: true },
          { title: "Component", value: alertData.component || 'Unknown', short: true },
          { title: "First Seen", value: alertData.firstSeen, short: true }
        ]
      }]
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`)
    }
  }

  private static determineSeverityFromStatus(status?: number): ErrorSeverity {
    if (!status) return ErrorSeverity.MEDIUM
    
    if (status >= 500) return ErrorSeverity.HIGH
    if (status >= 400) return ErrorSeverity.MEDIUM
    return ErrorSeverity.LOW
  }

  private static getCooldownPeriod(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.CRITICAL: return 5 * 60 * 1000 // 5 minutes
      case ErrorSeverity.HIGH: return 15 * 60 * 1000 // 15 minutes
      case ErrorSeverity.MEDIUM: return 60 * 60 * 1000 // 1 hour
      case ErrorSeverity.LOW: return 4 * 60 * 60 * 1000 // 4 hours
    }
  }

  private static getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#FF0000'
      case 'high': return '#FF6600'
      case 'medium': return '#FFCC00'
      case 'low': return '#00CC00'
      default: return '#808080'
    }
  }

  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  }

  /**
   * Get current configuration
   */
  static getConfig(): ErrorTrackingConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  static updateConfig(newConfig: Partial<ErrorTrackingConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    ApplicationLogger.businessOperation('config_updated', 'error-tracker', 'config', {
      metadata: { updatedFields: Object.keys(newConfig) }
    })
  }
}