/**
 * Configuration Service
 * 
 * Centralized configuration management with environment-specific loading,
 * validation, and type safety
 */

import { z } from 'zod';
import { logger } from '@/lib/logging';

// Environment types
export type Environment = 'development' | 'test' | 'staging' | 'production';

// Database configuration schema
const DatabaseConfigSchema = z.object({
  url: z.string().url('Invalid database URL').optional(),
  maxConnections: z.number().min(1).max(100).default(10),
  connectionTimeout: z.number().min(1000).default(10000),
  queryTimeout: z.number().min(1000).default(30000),
  ssl: z.boolean().default(false),
  logging: z.boolean().default(false),
});

// Redis configuration schema
const RedisConfigSchema = z.object({
  url: z.string().url('Invalid Redis URL').optional(),
  maxRetries: z.number().min(0).default(3),
  retryDelay: z.number().min(100).default(1000),
  connectTimeout: z.number().min(1000).default(10000),
  commandTimeout: z.number().min(1000).default(5000),
  keyPrefix: z.string().default('tickets:'),
});

// Authentication configuration schema
const AuthConfigSchema = z.object({
  secret: z.string().min(32, 'Auth secret must be at least 32 characters').optional(),
  sessionMaxAge: z.number().min(300).default(86400), // 24 hours
  providers: z.object({
    credentials: z.object({
      enabled: z.boolean().default(true),
      maxAttempts: z.number().min(1).default(5),
      lockoutDuration: z.number().min(60).default(900), // 15 minutes
    }),
    oauth: z.object({
      enabled: z.boolean().default(false),
      providers: z.array(z.string()).default([]),
    }),
  }),
});

// Email configuration schema
const EmailConfigSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(['smtp', 'sendgrid', 'ses']).default('smtp'),
  smtp: z.object({
    host: z.string().optional(),
    port: z.number().min(1).max(65535).optional(),
    secure: z.boolean().default(false),
    auth: z.object({
      user: z.string().optional(),
      pass: z.string().optional(),
    }).optional(),
  }).optional(),
  from: z.object({
    name: z.string().default('Sistema de Tickets'),
    email: z.string().email('Invalid from email').optional(),
  }),
  templates: z.object({
    ticketCreated: z.string().default('ticket-created'),
    ticketUpdated: z.string().default('ticket-updated'),
    ticketAssigned: z.string().default('ticket-assigned'),
  }),
});

// File storage configuration schema
const StorageConfigSchema = z.object({
  provider: z.enum(['local', 's3', 'gcs']).default('local'),
  maxFileSize: z.number().min(1024).default(10 * 1024 * 1024), // 10MB
  allowedTypes: z.array(z.string()).default([
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  local: z.object({
    uploadPath: z.string().default('./uploads'),
    publicPath: z.string().default('/uploads'),
  }).optional(),
  s3: z.object({
    bucket: z.string().optional(),
    region: z.string().optional(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
  }).optional(),
});

// Security configuration schema
const SecurityConfigSchema = z.object({
  cors: z.object({
    enabled: z.boolean().default(true),
    origins: z.array(z.string()).default(['http://localhost:3000']),
    credentials: z.boolean().default(true),
  }),
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    windowMs: z.number().min(1000).default(900000), // 15 minutes
    maxRequests: z.number().min(1).default(100),
    skipSuccessfulRequests: z.boolean().default(false),
  }),
  csrf: z.object({
    enabled: z.boolean().default(true),
    secret: z.string().min(32).optional(),
  }),
  headers: z.object({
    hsts: z.boolean().default(true),
    noSniff: z.boolean().default(true),
    frameOptions: z.enum(['DENY', 'SAMEORIGIN']).default('DENY'),
    xssProtection: z.boolean().default(true),
  }),
});

// Monitoring configuration schema
const MonitoringConfigSchema = z.object({
  enabled: z.boolean().default(true),
  healthCheck: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().min(1000).default(30000), // 30 seconds
    timeout: z.number().min(1000).default(5000),
  }),
  metrics: z.object({
    enabled: z.boolean().default(true),
    collectInterval: z.number().min(1000).default(60000), // 1 minute
    retentionDays: z.number().min(1).default(7),
  }),
  logging: z.object({
    level: z.enum(['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']).default('INFO'),
    format: z.enum(['json', 'pretty']).default('json'),
    enableApiLogging: z.boolean().default(true),
    enablePerformanceLogging: z.boolean().default(true),
  }),
});

// Application configuration schema
const AppConfigSchema = z.object({
  name: z.string().optional().default('Sistema de Tickets'),
  version: z.string().optional().default('1.0.0'),
  description: z.string().optional().default('Sistema de gestión de tickets de soporte'),
  url: z.string().url('Invalid application URL').optional(),
  timezone: z.string().optional().default('America/Guayaquil'),
  locale: z.string().optional().default('es-EC'),
  features: z.object({
    ticketAssignment: z.boolean().default(true),
    emailNotifications: z.boolean().default(true),
    fileAttachments: z.boolean().default(true),
    auditLog: z.boolean().default(true),
    reporting: z.boolean().default(true),
  }),
});

// Main configuration schema
const ConfigurationSchema = z.object({
  environment: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  app: AppConfigSchema,
  database: DatabaseConfigSchema,
  redis: RedisConfigSchema,
  auth: AuthConfigSchema,
  email: EmailConfigSchema,
  storage: StorageConfigSchema,
  security: SecurityConfigSchema,
  monitoring: MonitoringConfigSchema,
});

export type Configuration = z.infer<typeof ConfigurationSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type EmailConfig = z.infer<typeof EmailConfigSchema>;
export type StorageConfig = z.infer<typeof StorageConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

export class ConfigurationService {
  private static instance: ConfigurationService;
  private config: Configuration | null = null;
  private environment: Environment;

  private constructor() {
    this.environment = this.detectEnvironment();
  }

  public static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  /**
   * Detect current environment
   */
  private detectEnvironment(): Environment {
    const env = process.env.NODE_ENV as Environment;
    const validEnvironments: Environment[] = ['development', 'test', 'staging', 'production'];
    
    if (validEnvironments.includes(env)) {
      return env;
    }
    
    logger.warn(`Invalid NODE_ENV: ${env}, defaulting to development`, {
      component: 'configuration',
      operation: 'detect_environment',
    });
    
    return 'development';
  }

  /**
   * Load configuration from environment variables
   */
  public loadConfiguration(): Configuration {
    if (this.config) {
      return this.config;
    }

    try {
      const rawConfig = this.buildConfigFromEnv();
      const validatedConfig = ConfigurationSchema.parse(rawConfig);
      
      this.config = validatedConfig;
      
      logger.info('Configuration loaded successfully', {
        component: 'configuration',
        operation: 'load_configuration',
        metadata: {
          environment: this.environment,
          features: validatedConfig.app.features,
        },
      });
      
      return this.config;
    } catch (error) {
      logger.error('Failed to load configuration', {
        component: 'configuration',
        operation: 'load_configuration',
      }, error as Error);
      
      throw new Error(`Configuration validation failed: ${error}`);
    }
  }

  /**
   * Parse number from environment variable with fallback
   */
  private parseNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Build configuration object from environment variables
   */
  private buildConfigFromEnv(): any {
    return {
      environment: this.environment,
      app: {
        ...(process.env.APP_NAME && { name: process.env.APP_NAME }),
        ...(process.env.APP_VERSION && { version: process.env.APP_VERSION }),
        ...(process.env.APP_DESCRIPTION && { description: process.env.APP_DESCRIPTION }),
        ...(process.env.APP_URL && { url: process.env.APP_URL }),
        ...(!process.env.APP_URL && process.env.NEXTAUTH_URL && { url: process.env.NEXTAUTH_URL }),
        ...(process.env.TZ && { timezone: process.env.TZ }),
        ...(process.env.LOCALE && { locale: process.env.LOCALE }),
        features: {
          ticketAssignment: process.env.FEATURE_TICKET_ASSIGNMENT !== 'false',
          emailNotifications: process.env.FEATURE_EMAIL_NOTIFICATIONS !== 'false',
          fileAttachments: process.env.FEATURE_FILE_ATTACHMENTS !== 'false',
          auditLog: process.env.FEATURE_AUDIT_LOG !== 'false',
          reporting: process.env.FEATURE_REPORTING !== 'false',
        },
      },
      database: {
        ...(process.env.DATABASE_URL && { url: process.env.DATABASE_URL }),
        maxConnections: this.parseNumber(process.env.DB_MAX_CONNECTIONS),
        connectionTimeout: this.parseNumber(process.env.DB_CONNECTION_TIMEOUT),
        queryTimeout: this.parseNumber(process.env.DB_QUERY_TIMEOUT),
        ssl: process.env.DB_SSL === 'true',
        logging: process.env.DB_LOGGING === 'true',
      },
      redis: {
        ...(process.env.REDIS_URL && { url: process.env.REDIS_URL }),
        maxRetries: this.parseNumber(process.env.REDIS_MAX_RETRIES),
        retryDelay: this.parseNumber(process.env.REDIS_RETRY_DELAY),
        connectTimeout: this.parseNumber(process.env.REDIS_CONNECT_TIMEOUT),
        commandTimeout: this.parseNumber(process.env.REDIS_COMMAND_TIMEOUT),
        keyPrefix: process.env.REDIS_KEY_PREFIX,
      },
      auth: {
        ...(process.env.NEXTAUTH_SECRET && { secret: process.env.NEXTAUTH_SECRET }),
        sessionMaxAge: this.parseNumber(process.env.SESSION_MAX_AGE),
        providers: {
          credentials: {
            enabled: process.env.AUTH_CREDENTIALS_ENABLED !== 'false',
            maxAttempts: this.parseNumber(process.env.AUTH_MAX_ATTEMPTS),
            lockoutDuration: this.parseNumber(process.env.AUTH_LOCKOUT_DURATION),
          },
          oauth: {
            enabled: process.env.AUTH_OAUTH_ENABLED === 'true',
            providers: process.env.AUTH_OAUTH_PROVIDERS ? process.env.AUTH_OAUTH_PROVIDERS.split(',') : undefined,
          },
        },
      },
      email: {
        enabled: process.env.EMAIL_ENABLED !== 'false',
        provider: process.env.EMAIL_PROVIDER as any,
        smtp: {
          host: process.env.SMTP_HOST,
          port: this.parseNumber(process.env.SMTP_PORT),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
        from: {
          ...(process.env.EMAIL_FROM_NAME && { name: process.env.EMAIL_FROM_NAME }),
          ...(process.env.EMAIL_FROM_ADDRESS && { email: process.env.EMAIL_FROM_ADDRESS }),
        },
        templates: {
          ticketCreated: process.env.EMAIL_TEMPLATE_TICKET_CREATED,
          ticketUpdated: process.env.EMAIL_TEMPLATE_TICKET_UPDATED,
          ticketAssigned: process.env.EMAIL_TEMPLATE_TICKET_ASSIGNED,
        },
      },
      storage: {
        provider: process.env.STORAGE_PROVIDER as any,
        maxFileSize: this.parseNumber(process.env.STORAGE_MAX_FILE_SIZE),
        allowedTypes: process.env.STORAGE_ALLOWED_TYPES ? process.env.STORAGE_ALLOWED_TYPES.split(',') : undefined,
        local: {
          uploadPath: process.env.STORAGE_LOCAL_UPLOAD_PATH,
          publicPath: process.env.STORAGE_LOCAL_PUBLIC_PATH,
        },
        s3: {
          bucket: process.env.AWS_S3_BUCKET,
          region: process.env.AWS_REGION,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      },
      security: {
        cors: {
          enabled: process.env.CORS_ENABLED !== 'false',
          origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : undefined,
          credentials: process.env.CORS_CREDENTIALS !== 'false',
        },
        rateLimit: {
          enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
          windowMs: this.parseNumber(process.env.RATE_LIMIT_WINDOW_MS),
          maxRequests: this.parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS),
          skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL === 'true',
        },
        csrf: {
          enabled: process.env.CSRF_ENABLED !== 'false',
          secret: process.env.CSRF_SECRET,
        },
        headers: {
          hsts: process.env.SECURITY_HSTS !== 'false',
          noSniff: process.env.SECURITY_NO_SNIFF !== 'false',
          frameOptions: process.env.SECURITY_FRAME_OPTIONS as any,
          xssProtection: process.env.SECURITY_XSS_PROTECTION !== 'false',
        },
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        healthCheck: {
          enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
          interval: this.parseNumber(process.env.HEALTH_CHECK_INTERVAL),
          timeout: this.parseNumber(process.env.HEALTH_CHECK_TIMEOUT),
        },
        metrics: {
          enabled: process.env.METRICS_ENABLED !== 'false',
          collectInterval: this.parseNumber(process.env.METRICS_COLLECT_INTERVAL),
          retentionDays: this.parseNumber(process.env.METRICS_RETENTION_DAYS),
        },
        logging: {
          level: process.env.LOG_LEVEL as any,
          format: process.env.LOG_FORMAT as any,
          enableApiLogging: process.env.LOG_API_ENABLED !== 'false',
          enablePerformanceLogging: process.env.LOG_PERFORMANCE_ENABLED !== 'false',
        },
      },
    };
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): Configuration {
    if (!this.config) {
      return this.loadConfiguration();
    }
    return this.config;
  }

  /**
   * Get specific configuration section
   */
  public getConfig<K extends keyof Configuration>(section: K): Configuration[K] {
    const config = this.getConfiguration();
    return config[section];
  }

  /**
   * Get current environment
   */
  public getEnvironment(): Environment {
    return this.environment;
  }

  /**
   * Check if running in production
   */
  public isProduction(): boolean {
    return this.environment === 'production';
  }

  /**
   * Check if running in development
   */
  public isDevelopment(): boolean {
    return this.environment === 'development';
  }

  /**
   * Check if running in test
   */
  public isTest(): boolean {
    return this.environment === 'test';
  }

  /**
   * Check if feature is enabled
   */
  public isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
    const config = this.getConfiguration();
    return config.app.features[feature];
  }

  /**
   * Validate configuration
   */
  public validateConfiguration(): { valid: boolean; errors: string[] } {
    try {
      this.loadConfiguration();
      return { valid: true, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { valid: false, errors: [errorMessage] };
    }
  }

  /**
   * Reload configuration (useful for testing)
   */
  public reloadConfiguration(): Configuration {
    this.config = null;
    return this.loadConfiguration();
  }

  /**
   * Get configuration summary for debugging
   */
  public getConfigurationSummary(): Record<string, any> {
    const config = this.getConfiguration();
    
    return {
      environment: config.environment,
      app: {
        name: config.app.name,
        version: config.app.version,
        features: config.app.features,
      },
      database: {
        connected: !!config.database.url,
        maxConnections: config.database.maxConnections,
      },
      redis: {
        connected: !!config.redis.url,
        keyPrefix: config.redis.keyPrefix,
      },
      email: {
        enabled: config.email.enabled,
        provider: config.email.provider,
      },
      storage: {
        provider: config.storage.provider,
        maxFileSize: config.storage.maxFileSize,
      },
      security: {
        corsEnabled: config.security.cors.enabled,
        rateLimitEnabled: config.security.rateLimit.enabled,
        csrfEnabled: config.security.csrf.enabled,
      },
      monitoring: {
        enabled: config.monitoring.enabled,
        healthCheckEnabled: config.monitoring.healthCheck.enabled,
        metricsEnabled: config.monitoring.metrics.enabled,
      },
    };
  }
}

// Export singleton instance
export const configurationService = ConfigurationService.getInstance();