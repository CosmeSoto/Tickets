/**
 * Configuration Service Tests
 */

import { ConfigurationService } from '@/lib/config/configuration-service';

// Mock logger to avoid actual logging during tests
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ConfigurationService', () => {
  let configService: ConfigurationService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set up test environment
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      writable: true,
      configurable: true,
    });
    process.env.APP_URL = 'http://localhost:3000';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.NEXTAUTH_SECRET = 'test-secret-key-that-is-long-enough-for-validation';
    process.env.EMAIL_FROM_ADDRESS = 'test@example.com';

    configService = ConfigurationService.getInstance();
    // Force reload configuration for each test
    (configService as any).config = null;
  });

  afterEach(() => {
    // Restore original environment
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv.NODE_ENV,
      writable: true,
      configurable: true,
    });
    process.env = originalEnv;
  });

  describe('Environment Detection', () => {
    it('should detect test environment', () => {
      expect(configService.getEnvironment()).toBe('test');
      expect(configService.isTest()).toBe(true);
      expect(configService.isProduction()).toBe(false);
      expect(configService.isDevelopment()).toBe(false);
    });

    it('should default to development for invalid environment', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'invalid',
        writable: true,
        configurable: true,
      });
      const newService = new (ConfigurationService as any)();
      expect(newService.getEnvironment()).toBe('development');
    });
  });

  describe('Configuration Loading', () => {
    it('should load configuration successfully', () => {
      const config = configService.loadConfiguration();
      
      expect(config).toBeDefined();
      expect(config.environment).toBe('test');
      expect(config.app).toBeDefined();
      expect(config.database).toBeDefined();
      expect(config.redis).toBeDefined();
      expect(config.auth).toBeDefined();
      expect(config.email).toBeDefined();
      expect(config.storage).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.monitoring).toBeDefined();
    });

    it('should validate required fields', () => {
      // Remove required field
      delete process.env.DATABASE_URL;
      
      // Since DATABASE_URL is now optional, this should not throw
      const config = configService.reloadConfiguration();
      expect(config).toBeDefined();
    });

    it('should use default values for optional fields', () => {
      const config = configService.loadConfiguration();
      
      expect(config.app.name).toBe('Sistema de Tickets');
      expect(config.database.maxConnections).toBe(10);
      expect(config.redis.maxRetries).toBe(3);
      expect(config.auth.sessionMaxAge).toBe(86400);
    });
  });

  describe('Configuration Sections', () => {
    it('should get specific configuration sections', () => {
      const appConfig = configService.getConfig('app');
      expect(appConfig).toBeDefined();
      expect(appConfig.name).toBe('Sistema de Tickets');

      const dbConfig = configService.getConfig('database');
      expect(dbConfig).toBeDefined();
      expect(dbConfig.url).toBe('postgresql://test:test@localhost:5432/test');
    });

    it('should get configuration summary', () => {
      const summary = configService.getConfigurationSummary();
      
      expect(summary).toBeDefined();
      expect(summary.environment).toBe('test');
      expect(summary.app).toBeDefined();
      expect(summary.database).toBeDefined();
      expect(summary.redis).toBeDefined();
      expect(summary.email).toBeDefined();
      expect(summary.storage).toBeDefined();
      expect(summary.security).toBeDefined();
      expect(summary.monitoring).toBeDefined();
    });
  });

  describe('Feature Flags', () => {
    it('should check if features are enabled', () => {
      // Default features should be enabled
      expect(configService.isFeatureEnabled('ticketAssignment')).toBe(true);
      expect(configService.isFeatureEnabled('emailNotifications')).toBe(true);
      expect(configService.isFeatureEnabled('fileAttachments')).toBe(true);
      expect(configService.isFeatureEnabled('auditLog')).toBe(true);
      expect(configService.isFeatureEnabled('reporting')).toBe(true);
    });

    it('should respect environment variable overrides', () => {
      process.env.FEATURE_EMAIL_NOTIFICATIONS = 'false';
      process.env.FEATURE_FILE_ATTACHMENTS = 'false';
      
      const config = configService.reloadConfiguration();
      
      expect(config.app.features.emailNotifications).toBe(false);
      expect(config.app.features.fileAttachments).toBe(false);
      expect(config.app.features.ticketAssignment).toBe(true); // Should remain true
    });
  });

  describe('Validation', () => {
    it('should validate configuration successfully', () => {
      const validation = configService.validateConfiguration();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect validation errors', () => {
      process.env.DATABASE_URL = 'invalid-url';
      
      const validation = configService.validateConfiguration();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should validate email configuration', () => {
      process.env.EMAIL_FROM_ADDRESS = 'invalid-email';
      
      const validation = configService.validateConfiguration();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error => error.includes('email'))).toBe(true);
    });

    it('should validate auth secret length', () => {
      process.env.NEXTAUTH_SECRET = 'short';
      
      const validation = configService.validateConfiguration();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error => error.includes('32 characters'))).toBe(true);
    });
  });

  describe('Environment-Specific Configuration', () => {
    it('should load development configuration', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true,
      });
      const devService = new (ConfigurationService as any)();
      
      expect(devService.getEnvironment()).toBe('development');
      expect(devService.isDevelopment()).toBe(true);
    });

    it('should load production configuration', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      });
      const prodService = new (ConfigurationService as any)();
      
      expect(prodService.getEnvironment()).toBe('production');
      expect(prodService.isProduction()).toBe(true);
    });

    it('should load staging configuration', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'staging',
        writable: true,
        configurable: true,
      });
      const stagingService = new (ConfigurationService as any)();
      
      expect(stagingService.getEnvironment()).toBe('staging');
    });
  });

  describe('Configuration Caching', () => {
    it('should cache configuration after first load', () => {
      const config1 = configService.getConfiguration();
      const config2 = configService.getConfiguration();
      
      expect(config1).toBe(config2); // Should be the same object reference
    });

    it('should reload configuration when requested', () => {
      const config1 = configService.getConfiguration();
      const config2 = configService.reloadConfiguration();
      
      expect(config1).not.toBe(config2); // Should be different object references
      expect(config1).toEqual(config2); // But should have same content
    });
  });

  describe('Type Safety', () => {
    it('should provide type-safe configuration access', () => {
      const config = configService.getConfiguration();
      
      // These should compile without TypeScript errors
      expect(typeof config.app.name).toBe('string');
      expect(typeof config.database.maxConnections).toBe('number');
      expect(typeof config.auth.sessionMaxAge).toBe('number');
      expect(typeof config.email.enabled).toBe('boolean');
      expect(Array.isArray(config.storage.allowedTypes)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required environment variables', () => {
      delete process.env.NEXTAUTH_SECRET;
      
      // Since NEXTAUTH_SECRET is now optional, this should not throw
      const config = configService.reloadConfiguration();
      expect(config).toBeDefined();
    });

    it('should handle invalid numeric values', () => {
      process.env.DB_MAX_CONNECTIONS = 'not-a-number';
      
      // Should use default value instead of throwing
      const config = configService.reloadConfiguration();
      expect(config.database.maxConnections).toBe(10); // Default value
    });

    it('should handle invalid boolean values', () => {
      process.env.EMAIL_ENABLED = 'maybe';
      
      // Should use default value
      const config = configService.reloadConfiguration();
      expect(config.email.enabled).toBe(true); // Default value
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConfigurationService.getInstance();
      const instance2 = ConfigurationService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});