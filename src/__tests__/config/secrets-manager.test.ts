/**
 * Secrets Manager Tests
 */

import { SecretsManager } from '@/lib/config/secrets-manager';

// Mock logger to avoid actual logging during tests
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock configuration service
jest.mock('@/lib/config/configuration-service', () => ({
  configurationService: {
    isProduction: jest.fn(() => false),
    getEnvironment: jest.fn(() => 'test'),
  },
}));

describe('SecretsManager', () => {
  let secretsManager: SecretsManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set up test environment
    process.env.SECRETS_ENCRYPTION_KEY = 'test-encryption-key-that-is-long-enough-for-validation-purposes';

    secretsManager = SecretsManager.getInstance();
    
    // Clear any existing secrets for clean tests
    (secretsManager as any).secrets.clear();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Clear secrets after each test
    (secretsManager as any).secrets.clear();
  });

  describe('Secret Storage and Retrieval', () => {
    it('should store and retrieve a secret', () => {
      const secretValue = 'my-secret-value';
      
      secretsManager.storeSecret('test-secret', secretValue, {
        name: 'Test Secret',
        description: 'A test secret',
      });

      const retrieved = secretsManager.getSecret('test-secret');
      expect(retrieved).toBe(secretValue);
    });

    it('should store encrypted secrets by default', () => {
      const secretValue = 'my-secret-value';
      
      secretsManager.storeSecret('test-secret', secretValue, {
        name: 'Test Secret',
      });

      const secret = (secretsManager as any).secrets.get('test-secret');
      expect(secret.encrypted).toBe(true);
      expect(secret.value).not.toBe(secretValue); // Should be encrypted
    });

    it('should store unencrypted secrets when specified', () => {
      const secretValue = 'my-secret-value';
      
      secretsManager.storeSecret('test-secret', secretValue, {
        name: 'Test Secret',
        encrypt: false,
      });

      const secret = (secretsManager as any).secrets.get('test-secret');
      expect(secret.encrypted).toBe(false);
      expect(secret.value).toBe(secretValue); // Should not be encrypted
    });

    it('should return null for non-existent secrets', () => {
      const retrieved = secretsManager.getSecret('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should check if secret exists', () => {
      secretsManager.storeSecret('test-secret', 'value', {
        name: 'Test Secret',
      });

      expect(secretsManager.hasSecret('test-secret')).toBe(true);
      expect(secretsManager.hasSecret('non-existent')).toBe(false);
    });
  });

  describe('Secret Metadata', () => {
    it('should store and retrieve secret metadata', () => {
      const now = new Date();
      
      secretsManager.storeSecret('test-secret', 'value', {
        name: 'Test Secret',
        description: 'A test secret',
        tags: ['test', 'api'],
      });

      const metadata = secretsManager.getSecretMetadata('test-secret');
      expect(metadata).toBeDefined();
      expect(metadata!.name).toBe('Test Secret');
      expect(metadata!.description).toBe('A test secret');
      expect(metadata!.tags).toEqual(['test', 'api']);
      expect(metadata!.version).toBe(1);
      expect(metadata!.createdAt).toBeInstanceOf(Date);
      expect(metadata!.updatedAt).toBeInstanceOf(Date);
    });

    it('should return null for non-existent secret metadata', () => {
      const metadata = secretsManager.getSecretMetadata('non-existent');
      expect(metadata).toBeNull();
    });
  });

  describe('Secret Validation', () => {
    it('should validate database URL secrets', () => {
      expect(() => {
        secretsManager.storeSecret('db-url', 'invalid-url', {
          name: 'Database URL',
          type: 'database_url',
        });
      }).toThrow(/validation failed/);

      // Valid database URL should work
      secretsManager.storeSecret('db-url', 'postgresql://user:pass@localhost:5432/db', {
        name: 'Database URL',
        type: 'database_url',
      });

      expect(secretsManager.hasSecret('db-url')).toBe(true);
    });

    it('should validate API key secrets', () => {
      expect(() => {
        secretsManager.storeSecret('api-key', 'short', {
          name: 'API Key',
          type: 'api_key',
        });
      }).toThrow(/validation failed/);

      // Valid API key should work
      const validApiKey = 'a'.repeat(32);
      secretsManager.storeSecret('api-key', validApiKey, {
        name: 'API Key',
        type: 'api_key',
      });

      expect(secretsManager.hasSecret('api-key')).toBe(true);
    });

    it('should validate JWT secret', () => {
      expect(() => {
        secretsManager.storeSecret('jwt-secret', 'short', {
          name: 'JWT Secret',
          type: 'jwt_secret',
        });
      }).toThrow(/validation failed/);

      // Valid JWT secret should work
      secretsManager.storeSecret('jwt-secret', 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0', {
        name: 'JWT Secret',
        type: 'jwt_secret',
      });

      expect(secretsManager.hasSecret('jwt-secret')).toBe(true);
    });
  });

  describe('Secret Updates', () => {
    it('should update existing secrets', () => {
      const originalValue = 'original-value';
      const updatedValue = 'updated-value';
      
      secretsManager.storeSecret('test-secret', originalValue, {
        name: 'Test Secret',
      });

      secretsManager.updateSecret('test-secret', updatedValue);

      const retrieved = secretsManager.getSecret('test-secret');
      expect(retrieved).toBe(updatedValue);

      const metadata = secretsManager.getSecretMetadata('test-secret');
      expect(metadata!.version).toBe(2);
    });

    it('should throw error when updating non-existent secret', () => {
      expect(() => {
        secretsManager.updateSecret('non-existent', 'value');
      }).toThrow(/not found/);
    });
  });

  describe('Secret Deletion', () => {
    it('should delete existing secrets', () => {
      secretsManager.storeSecret('test-secret', 'value', {
        name: 'Test Secret',
      });

      expect(secretsManager.hasSecret('test-secret')).toBe(true);

      const deleted = secretsManager.deleteSecret('test-secret');
      expect(deleted).toBe(true);
      expect(secretsManager.hasSecret('test-secret')).toBe(false);
    });

    it('should return false when deleting non-existent secret', () => {
      const deleted = secretsManager.deleteSecret('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Secret Listing', () => {
    beforeEach(() => {
      secretsManager.storeSecret('secret1', 'value1', {
        name: 'Secret 1',
        tags: ['api', 'production'],
      });

      secretsManager.storeSecret('secret2', 'value2', {
        name: 'Secret 2',
        tags: ['database', 'staging'],
      });

      secretsManager.storeSecret('secret3', 'value3', {
        name: 'Secret 3',
        tags: ['api', 'development'],
      });
    });

    it('should list all secrets', () => {
      const secrets = secretsManager.listSecrets();
      expect(secrets).toHaveLength(3);
      expect(secrets.map(s => s.name)).toEqual(['Secret 1', 'Secret 2', 'Secret 3']);
    });

    it('should filter secrets by tags', () => {
      const apiSecrets = secretsManager.listSecrets(['api']);
      expect(apiSecrets).toHaveLength(2);
      expect(apiSecrets.map(s => s.name)).toEqual(['Secret 1', 'Secret 3']);

      const dbSecrets = secretsManager.listSecrets(['database']);
      expect(dbSecrets).toHaveLength(1);
      expect(dbSecrets[0].name).toBe('Secret 2');
    });
  });

  describe('Secret Expiration', () => {
    it('should return null for expired secrets', () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago
      
      secretsManager.storeSecret('expired-secret', 'value', {
        name: 'Expired Secret',
        expiresAt: pastDate,
      });

      const retrieved = secretsManager.getSecret('expired-secret');
      expect(retrieved).toBeNull();
    });

    it('should return value for non-expired secrets', () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute from now
      
      secretsManager.storeSecret('valid-secret', 'value', {
        name: 'Valid Secret',
        expiresAt: futureDate,
      });

      const retrieved = secretsManager.getSecret('valid-secret');
      expect(retrieved).toBe('value');
    });
  });

  describe('Secret Rotation', () => {
    it('should rotate secrets with new values', () => {
      const originalValue = 'original-value';
      const newValue = 'new-rotated-value';
      
      secretsManager.storeSecret('test-secret', originalValue, {
        name: 'Test Secret',
      });

      secretsManager.rotateSecret('test-secret', newValue);

      const retrieved = secretsManager.getSecret('test-secret');
      expect(retrieved).toBe(newValue);

      const metadata = secretsManager.getSecretMetadata('test-secret');
      expect(metadata!.version).toBe(2);
      expect(metadata!.lastRotated).toBeInstanceOf(Date);
    });

    it('should generate new values when rotating without providing value', () => {
      secretsManager.storeSecret('test-secret', 'original-value', {
        name: 'Test Secret',
        tags: ['api_key'],
      });

      const originalValue = secretsManager.getSecret('test-secret');
      secretsManager.rotateSecret('test-secret');
      const rotatedValue = secretsManager.getSecret('test-secret');

      expect(rotatedValue).not.toBe(originalValue);
      expect(rotatedValue).toBeDefined();
      expect(rotatedValue!.length).toBeGreaterThan(0);
    });

    it('should check for secrets needing rotation', () => {
      const pastRotationTime = new Date(Date.now() - 2000); // 2 seconds ago
      
      secretsManager.storeSecret('needs-rotation', 'value', {
        name: 'Needs Rotation',
        rotationInterval: 1000, // 1 second
      });

      // Manually set last rotated time to past
      const secret = (secretsManager as any).secrets.get('needs-rotation');
      secret.metadata.lastRotated = pastRotationTime;

      const needsRotation = secretsManager.checkRotationNeeded();
      expect(needsRotation).toHaveLength(1);
      expect(needsRotation[0].name).toBe('Needs Rotation');
    });

    it('should check for expiring secrets', () => {
      const soonExpiry = new Date(Date.now() + 5000); // 5 seconds from now
      
      secretsManager.storeSecret('expiring-soon', 'value', {
        name: 'Expiring Soon',
        expiresAt: soonExpiry,
      });

      const expiringSoon = secretsManager.checkExpiringSecrets();
      expect(expiringSoon).toHaveLength(1);
      expect(expiringSoon[0].name).toBe('Expiring Soon');
    });
  });

  describe('Import and Export', () => {
    it('should import secrets from environment mapping', () => {
      process.env.TEST_API_KEY = 'test-api-key-value-that-is-long-enough';
      process.env.TEST_DB_URL = 'postgresql://test:test@localhost:5432/test';

      const mapping = {
        TEST_API_KEY: {
          name: 'Test API Key',
          type: 'api_key',
          tags: ['api', 'test'],
        },
        TEST_DB_URL: {
          name: 'Test Database URL',
          type: 'database_url',
          tags: ['database', 'test'],
        },
      };

      secretsManager.importFromEnvironment(mapping);

      expect(secretsManager.hasSecret('test_api_key')).toBe(true);
      expect(secretsManager.hasSecret('test_db_url')).toBe(true);

      const apiKey = secretsManager.getSecret('test_api_key');
      expect(apiKey).toBe('test-api-key-value-that-is-long-enough');
    });

    it('should export secrets for backup', () => {
      secretsManager.storeSecret('secret1', 'value1', {
        name: 'Secret 1',
        encrypt: true,
      });

      secretsManager.storeSecret('secret2', 'value2', {
        name: 'Secret 2',
        encrypt: false,
      });

      const exported = secretsManager.exportSecrets();

      expect(Object.keys(exported)).toHaveLength(2);
      expect(exported.secret1.metadata.name).toBe('Secret 1');
      expect(exported.secret1.encryptedValue).toBeDefined(); // Encrypted secret should have encrypted value
      expect(exported.secret2.encryptedValue).toBeUndefined(); // Unencrypted secret should not have encrypted value
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      secretsManager.storeSecret('secret1', 'value1', {
        name: 'Secret 1',
        encrypt: true,
        expiresAt: new Date(Date.now() + 60000),
      });

      secretsManager.storeSecret('secret2', 'value2', {
        name: 'Secret 2',
        encrypt: false,
      });

      const stats = secretsManager.getStatistics();

      expect(stats.totalSecrets).toBe(2);
      expect(stats.encryptedSecrets).toBe(1);
      expect(stats.secretsWithExpiry).toBe(1);
      expect(stats.secretsNeedingRotation).toBe(0);
      expect(stats.secretsExpiringSoon).toBe(1);
    });
  });

  describe('Validation Rules', () => {
    it('should allow adding custom validation rules', () => {
      secretsManager.addValidationRule('custom_type', {
        name: 'custom_validation',
        validator: (value: string) => value.startsWith('custom_'),
        message: 'Value must start with custom_',
      });

      expect(() => {
        secretsManager.storeSecret('custom-secret', 'invalid-value', {
          name: 'Custom Secret',
          type: 'custom_type',
        });
      }).toThrow(/must start with custom_/);

      // Valid value should work
      secretsManager.storeSecret('custom-secret', 'custom_valid_value', {
        name: 'Custom Secret',
        type: 'custom_type',
      });

      expect(secretsManager.hasSecret('custom-secret')).toBe(true);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SecretsManager.getInstance();
      const instance2 = SecretsManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});