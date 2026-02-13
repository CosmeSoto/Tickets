/**
 * Structured Logging Service
 * 
 * Provides consistent, structured logging across the application with:
 * - Contextual information
 * - Log levels and filtering
 * - Structured JSON format
 * - Performance tracking
 * - Error correlation
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  traceId?: string;
  operation?: string;
  component?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration: number;
    memory?: number;
    cpu?: number;
  };
  environment: string;
  service: string;
  version: string;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private service: string;
  private version: string;
  private environment: string;

  private constructor() {
    this.logLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'INFO');
    this.service = process.env.SERVICE_NAME || 'sistema-tickets-nextjs';
    this.version = process.env.SERVICE_VERSION || '1.0.0';
    this.environment = process.env.NODE_ENV || 'development';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toUpperCase()) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      case 'TRACE': return LogLevel.TRACE;
      default: return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context: LogContext = {},
    error?: Error,
    performance?: { duration: number; memory?: number; cpu?: number }
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context: {
        ...context,
        requestId: context.requestId || this.generateRequestId(),
      },
      environment: this.environment,
      service: this.service,
      version: this.version,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    if (performance) {
      entry.performance = performance;
    }

    return entry;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private output(entry: LogEntry): void {
    const logString = JSON.stringify(entry);
    
    // In development, also output a readable format
    if (this.environment === 'development') {
      const readable = `[${entry.timestamp}] ${entry.level}: ${entry.message}`;
      const contextStr = Object.keys(entry.context).length > 0 
        ? ` | Context: ${JSON.stringify(entry.context)}` 
        : '';
      
      switch (entry.level) {
        case 'ERROR':
          console.error(readable + contextStr);
          if (entry.error?.stack) {
            console.error(entry.error.stack);
          }
          break;
        case 'WARN':
          console.warn(readable + contextStr);
          break;
        case 'DEBUG':
        case 'TRACE':
          console.debug(readable + contextStr);
          break;
        default:
          console.log(readable + contextStr);
      }
    } else {
      // In production, output structured JSON
      console.log(logString);
    }
  }

  public error(message: string, context: LogContext = {}, error?: Error): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, error);
    this.output(entry);
  }

  public warn(message: string, context: LogContext = {}): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry = this.createLogEntry(LogLevel.WARN, message, context);
    this.output(entry);
  }

  public info(message: string, context: LogContext = {}): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry = this.createLogEntry(LogLevel.INFO, message, context);
    this.output(entry);
  }

  public debug(message: string, context: LogContext = {}): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry = this.createLogEntry(LogLevel.DEBUG, message, context);
    this.output(entry);
  }

  public trace(message: string, context: LogContext = {}): void {
    if (!this.shouldLog(LogLevel.TRACE)) return;
    
    const entry = this.createLogEntry(LogLevel.TRACE, message, context);
    this.output(entry);
  }

  /**
   * Log performance metrics for operations
   */
  public performance(
    message: string,
    duration: number,
    context: LogContext = {},
    additionalMetrics?: { memory?: number; cpu?: number }
  ): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry = this.createLogEntry(
      LogLevel.INFO,
      message,
      { ...context, operation: context.operation || 'performance' },
      undefined,
      { duration, ...additionalMetrics }
    );
    this.output(entry);
  }

  /**
   * Create a child logger with additional context
   */
  public child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }

  /**
   * Time an operation and log its performance
   */
  public time(operation: string, context: LogContext = {}): PerformanceTimer {
    return new PerformanceTimer(this, operation, context);
  }
}

/**
 * Child logger that inherits context from parent
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private baseContext: LogContext
  ) {}

  private mergeContext(context: LogContext = {}): LogContext {
    return { ...this.baseContext, ...context };
  }

  public error(message: string, context: LogContext = {}, error?: Error): void {
    this.parent.error(message, this.mergeContext(context), error);
  }

  public warn(message: string, context: LogContext = {}): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  public info(message: string, context: LogContext = {}): void {
    this.parent.info(message, this.mergeContext(context));
  }

  public debug(message: string, context: LogContext = {}): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  public trace(message: string, context: LogContext = {}): void {
    this.parent.trace(message, this.mergeContext(context));
  }

  public performance(
    message: string,
    duration: number,
    context: LogContext = {},
    additionalMetrics?: { memory?: number; cpu?: number }
  ): void {
    this.parent.performance(message, duration, this.mergeContext(context), additionalMetrics);
  }

  public child(context: LogContext): ChildLogger {
    return new ChildLogger(this.parent, this.mergeContext(context));
  }

  public time(operation: string, context: LogContext = {}): PerformanceTimer {
    return new PerformanceTimer(this.parent, operation, this.mergeContext(context));
  }
}

/**
 * Performance timer for measuring operation duration
 */
class PerformanceTimer {
  private startTime: number;
  private startMemory?: number;

  constructor(
    private logger: Logger,
    private operation: string,
    private context: LogContext
  ) {
    this.startTime = performance.now();
    
    // Capture memory usage if available (only in Node.js environment)
    // Skip memory tracking in Edge Runtime to avoid compatibility issues
    if (typeof window === 'undefined' && typeof process !== 'undefined') {
      try {
        // Dynamic access to avoid Edge Runtime detection
        const memoryUsage = process['memoryUsage'];
        if (typeof memoryUsage === 'function') {
          this.startMemory = memoryUsage().heapUsed;
        }
      } catch (error) {
        // Ignore errors in edge runtime
      }
    }
  }

  public end(message?: string, additionalContext: LogContext = {}): void {
    const duration = performance.now() - this.startTime;
    const finalMessage = message || `Operation ${this.operation} completed`;
    
    const metrics: { memory?: number } = {};
    if (this.startMemory && typeof window === 'undefined' && typeof process !== 'undefined') {
      try {
        // Dynamic access to avoid Edge Runtime detection
        const memoryUsage = process['memoryUsage'];
        if (typeof memoryUsage === 'function') {
          metrics.memory = memoryUsage().heapUsed - this.startMemory;
        }
      } catch (error) {
        // Ignore errors in edge runtime
      }
    }

    this.logger.performance(
      finalMessage,
      duration,
      { ...this.context, operation: this.operation, ...additionalContext },
      metrics
    );
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export classes for external use
export { ChildLogger, PerformanceTimer };