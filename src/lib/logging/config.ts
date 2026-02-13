/**
 * Logging Configuration
 * 
 * Centralized configuration for the logging system
 */

export interface LoggingConfig {
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';
  format: 'json' | 'pretty';
  enableApiLogging: boolean;
  enableDatabaseLogging: boolean;
  enablePerformanceLogging: boolean;
  enableSecurityLogging: boolean;
  
  // API Logging specific
  api: {
    logRequestBody: boolean;
    logResponseBody: boolean;
    logHeaders: boolean;
    excludePaths: string[];
    excludeHeaders: string[];
    maxBodySize: number;
  };
  
  // Database Logging specific
  database: {
    logQueries: boolean;
    logSlowQueries: boolean;
    slowQueryThreshold: number; // milliseconds
    logQueryParameters: boolean;
  };
  
  // Performance Logging specific
  performance: {
    enableTimers: boolean;
    enableMemoryTracking: boolean;
    logThreshold: number; // milliseconds - only log operations slower than this
  };
  
  // Security Logging specific
  security: {
    logAuthAttempts: boolean;
    logAuthFailures: boolean;
    logAuthorizationChecks: boolean;
    logSuspiciousActivity: boolean;
  };
}

const developmentConfig: LoggingConfig = {
  level: 'DEBUG',
  format: 'pretty',
  enableApiLogging: true,
  enableDatabaseLogging: true,
  enablePerformanceLogging: true,
  enableSecurityLogging: true,
  
  api: {
    logRequestBody: true,
    logResponseBody: false,
    logHeaders: false,
    excludePaths: ['/api/health', '/api/metrics'],
    excludeHeaders: ['authorization', 'cookie', 'x-api-key'],
    maxBodySize: 1024 * 10, // 10KB
  },
  
  database: {
    logQueries: true,
    logSlowQueries: true,
    slowQueryThreshold: 100, // 100ms
    logQueryParameters: false, // May contain sensitive data
  },
  
  performance: {
    enableTimers: true,
    enableMemoryTracking: true,
    logThreshold: 50, // 50ms
  },
  
  security: {
    logAuthAttempts: true,
    logAuthFailures: true,
    logAuthorizationChecks: false, // Too verbose for development
    logSuspiciousActivity: true,
  },
};

const productionConfig: LoggingConfig = {
  level: 'INFO',
  format: 'json',
  enableApiLogging: true,
  enableDatabaseLogging: true,
  enablePerformanceLogging: true,
  enableSecurityLogging: true,
  
  api: {
    logRequestBody: false, // Too verbose for production
    logResponseBody: false,
    logHeaders: false,
    excludePaths: ['/api/health', '/api/metrics', '/api/status'],
    excludeHeaders: ['authorization', 'cookie', 'x-api-key', 'x-forwarded-for'],
    maxBodySize: 1024 * 5, // 5KB
  },
  
  database: {
    logQueries: false, // Too verbose for production
    logSlowQueries: true,
    slowQueryThreshold: 500, // 500ms
    logQueryParameters: false,
  },
  
  performance: {
    enableTimers: true,
    enableMemoryTracking: false, // May impact performance
    logThreshold: 200, // 200ms
  },
  
  security: {
    logAuthAttempts: true,
    logAuthFailures: true,
    logAuthorizationChecks: false,
    logSuspiciousActivity: true,
  },
};

const testConfig: LoggingConfig = {
  level: 'WARN',
  format: 'json',
  enableApiLogging: false,
  enableDatabaseLogging: false,
  enablePerformanceLogging: false,
  enableSecurityLogging: false,
  
  api: {
    logRequestBody: false,
    logResponseBody: false,
    logHeaders: false,
    excludePaths: [],
    excludeHeaders: [],
    maxBodySize: 0,
  },
  
  database: {
    logQueries: false,
    logSlowQueries: false,
    slowQueryThreshold: 1000,
    logQueryParameters: false,
  },
  
  performance: {
    enableTimers: false,
    enableMemoryTracking: false,
    logThreshold: 1000,
  },
  
  security: {
    logAuthAttempts: false,
    logAuthFailures: false,
    logAuthorizationChecks: false,
    logSuspiciousActivity: false,
  },
};

/**
 * Get logging configuration based on environment
 */
export function getLoggingConfig(): LoggingConfig {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        ...productionConfig,
        // Override with environment variables if provided
        level: (process.env.LOG_LEVEL as any) || productionConfig.level,
      };
    case 'test':
      return testConfig;
    case 'development':
    default:
      return {
        ...developmentConfig,
        // Override with environment variables if provided
        level: (process.env.LOG_LEVEL as any) || developmentConfig.level,
      };
  }
}

/**
 * Validate logging configuration
 */
export function validateLoggingConfig(config: LoggingConfig): string[] {
  const errors: string[] = [];
  
  const validLevels = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
  if (!validLevels.includes(config.level)) {
    errors.push(`Invalid log level: ${config.level}. Must be one of: ${validLevels.join(', ')}`);
  }
  
  const validFormats = ['json', 'pretty'];
  if (!validFormats.includes(config.format)) {
    errors.push(`Invalid log format: ${config.format}. Must be one of: ${validFormats.join(', ')}`);
  }
  
  if (config.api.maxBodySize < 0) {
    errors.push('API maxBodySize must be non-negative');
  }
  
  if (config.database.slowQueryThreshold < 0) {
    errors.push('Database slowQueryThreshold must be non-negative');
  }
  
  if (config.performance.logThreshold < 0) {
    errors.push('Performance logThreshold must be non-negative');
  }
  
  return errors;
}

// Export the current configuration
export const loggingConfig = getLoggingConfig();

// Validate configuration on startup
const configErrors = validateLoggingConfig(loggingConfig);
if (configErrors.length > 0) {
  console.error('Logging configuration errors:', configErrors);
  throw new Error(`Invalid logging configuration: ${configErrors.join(', ')}`);
}