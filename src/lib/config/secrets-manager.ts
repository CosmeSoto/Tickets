/**
 * Secrets Manager
 * 
 * Secure secrets management with encryption, rotation, and validation
 */

import crypto from 'crypto';
import { logger } from '@/lib/logging';
import { configurationService } from './configuration-service';

export interface SecretMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  rotationInterval?: number; // milliseconds
  lastRotated?: Date;
  version: number;
  tags: string[];
}

export interface Secret {
  metadata: SecretMetadata;
  value: string;
  encrypted: boolean;
}

export interface SecretValidationRule {
  name: string;
  validator: (value: string) => boolean;
  message: string;
}

export interface SecretRotationConfig {
  enabled: boolean;
  interval: number; // milliseconds
  retainVersions: number;
  notifyBeforeExpiry: number; // milliseconds
}

export class SecretsManager {
  private static instance: SecretsManager;
  private secrets: Map<string, Secret> = new Map();
  private encryptionKey: string;
  private rotationConfig: SecretRotationConfig;
  private validationRules: Map<string, SecretValidationRule[]> = new Map();

  private constructor() {
    this.encryptionKey = this.generateEncryptionKey();
    this.rotationConfig = {
      enabled: true,
      interval: 30 * 24 * 60 * 60 * 1000, // 30 days
      retainVersions: 3,
      notifyBeforeExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    
    this.initializeDefaultValidationRules();
    this.startRotationScheduler();
  }

  public static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  /**
   * Generate encryption key from environment or create new one
   */
  private generateEncryptionKey(): string {
    const envKey = process.env.SECRETS_ENCRYPTION_KEY;
    if (envKey && envKey.length >= 32) {
      return envKey;
    }

    // In production, this should come from a secure key management service
    if (configurationService.isProduction()) {
      throw new Error('SECRETS_ENCRYPTION_KEY must be provided in production');
    }

    // Generate a key for development/testing
    const key = crypto.randomBytes(32).toString('hex');
    logger.warn('Generated temporary encryption key for secrets (not for production)', {
      component: 'secrets-manager',
      operation: 'generate_encryption_key',
    });
    
    return key;
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultValidationRules(): void {
    // Database URL validation
    this.addValidationRule('database_url', {
      name: 'format',
      validator: (value: string) => /^(postgresql|mysql|sqlite):\/\/.+/.test(value),
      message: 'Database URL must be a valid connection string',
    });

    // API key validation
    this.addValidationRule('api_key', {
      name: 'length',
      validator: (value: string) => value.length >= 32,
      message: 'API key must be at least 32 characters long',
    });

    // JWT secret validation
    this.addValidationRule('jwt_secret', {
      name: 'strength',
      validator: (value: string) => value.length >= 32 && /[A-Za-z]/.test(value) && /[0-9]/.test(value),
      message: 'JWT secret must be at least 32 characters with letters and numbers',
    });

    // Email password validation
    this.addValidationRule('email_password', {
      name: 'not_empty',
      validator: (value: string) => value.trim().length > 0,
      message: 'Email password cannot be empty',
    });

    // Encryption key validation
    this.addValidationRule('encryption_key', {
      name: 'hex_format',
      validator: (value: string) => /^[a-fA-F0-9]{64}$/.test(value),
      message: 'Encryption key must be 64 character hex string',
    });
  }

  /**
   * Add validation rule for a secret type
   */
  public addValidationRule(secretType: string, rule: SecretValidationRule): void {
    if (!this.validationRules.has(secretType)) {
      this.validationRules.set(secretType, []);
    }
    this.validationRules.get(secretType)!.push(rule);
  }

  /**
   * Validate secret value
   */
  private validateSecret(secretType: string, value: string): { valid: boolean; errors: string[] } {
    const rules = this.validationRules.get(secretType) || [];
    const errors: string[] = [];

    for (const rule of rules) {
      if (!rule.validator(value)) {
        errors.push(rule.message);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Encrypt a value
   */
  private encrypt(value: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt a value
   */
  private decrypt(encryptedValue: string): string {
    const [ivHex, encrypted] = encryptedValue.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Store a secret
   */
  public storeSecret(
    id: string,
    value: string,
    options: {
      name: string;
      description?: string;
      type?: string;
      encrypt?: boolean;
      expiresAt?: Date;
      rotationInterval?: number;
      tags?: string[];
    }
  ): void {
    const { name, description, type, encrypt = true, expiresAt, rotationInterval, tags = [] } = options;

    // Validate secret if type is provided
    if (type) {
      const validation = this.validateSecret(type, value);
      if (!validation.valid) {
        throw new Error(`Secret validation failed: ${validation.errors.join(', ')}`);
      }
    }

    const now = new Date();
    const secret: Secret = {
      metadata: {
        id,
        name,
        description,
        createdAt: now,
        updatedAt: now,
        expiresAt,
        rotationInterval,
        version: 1,
        tags,
      },
      value: encrypt ? this.encrypt(value) : value,
      encrypted: encrypt,
    };

    this.secrets.set(id, secret);

    logger.info(`Secret stored: ${name}`, {
      component: 'secrets-manager',
      operation: 'store_secret',
      metadata: {
        secretId: id,
        secretName: name,
        encrypted: encrypt,
        hasExpiry: !!expiresAt,
        tags,
      },
    });
  }

  /**
   * Retrieve a secret
   */
  public getSecret(id: string): string | null {
    const secret = this.secrets.get(id);
    if (!secret) {
      logger.warn(`Secret not found: ${id}`, {
        component: 'secrets-manager',
        operation: 'get_secret',
        metadata: { secretId: id },
      });
      return null;
    }

    // Check if secret has expired
    if (secret.metadata.expiresAt && secret.metadata.expiresAt < new Date()) {
      logger.warn(`Secret expired: ${secret.metadata.name}`, {
        component: 'secrets-manager',
        operation: 'get_secret',
        metadata: {
          secretId: id,
          secretName: secret.metadata.name,
          expiresAt: secret.metadata.expiresAt,
        },
      });
      return null;
    }

    const value = secret.encrypted ? this.decrypt(secret.value) : secret.value;

    logger.debug(`Secret retrieved: ${secret.metadata.name}`, {
      component: 'secrets-manager',
      operation: 'get_secret',
      metadata: {
        secretId: id,
        secretName: secret.metadata.name,
      },
    });

    return value;
  }

  /**
   * Update a secret
   */
  public updateSecret(id: string, newValue: string, options?: { type?: string }): void {
    const secret = this.secrets.get(id);
    if (!secret) {
      throw new Error(`Secret not found: ${id}`);
    }

    // Validate new value if type is provided
    if (options?.type) {
      const validation = this.validateSecret(options.type, newValue);
      if (!validation.valid) {
        throw new Error(`Secret validation failed: ${validation.errors.join(', ')}`);
      }
    }

    const now = new Date();
    secret.value = secret.encrypted ? this.encrypt(newValue) : newValue;
    secret.metadata.updatedAt = now;
    secret.metadata.version += 1;
    secret.metadata.lastRotated = now;

    logger.info(`Secret updated: ${secret.metadata.name}`, {
      component: 'secrets-manager',
      operation: 'update_secret',
      metadata: {
        secretId: id,
        secretName: secret.metadata.name,
        version: secret.metadata.version,
      },
    });
  }

  /**
   * Delete a secret
   */
  public deleteSecret(id: string): boolean {
    const secret = this.secrets.get(id);
    if (!secret) {
      return false;
    }

    this.secrets.delete(id);

    logger.info(`Secret deleted: ${secret.metadata.name}`, {
      component: 'secrets-manager',
      operation: 'delete_secret',
      metadata: {
        secretId: id,
        secretName: secret.metadata.name,
      },
    });

    return true;
  }

  /**
   * List all secrets (metadata only)
   */
  public listSecrets(tags?: string[]): SecretMetadata[] {
    const secrets = Array.from(this.secrets.values());
    
    if (tags && tags.length > 0) {
      return secrets
        .filter(secret => tags.some(tag => secret.metadata.tags.includes(tag)))
        .map(secret => secret.metadata);
    }

    return secrets.map(secret => secret.metadata);
  }

  /**
   * Check if secret exists
   */
  public hasSecret(id: string): boolean {
    return this.secrets.has(id);
  }

  /**
   * Get secret metadata
   */
  public getSecretMetadata(id: string): SecretMetadata | null {
    const secret = this.secrets.get(id);
    return secret ? secret.metadata : null;
  }

  /**
   * Rotate a secret (generate new value)
   */
  public rotateSecret(id: string, newValue?: string): void {
    const secret = this.secrets.get(id);
    if (!secret) {
      throw new Error(`Secret not found: ${id}`);
    }

    const rotatedValue = newValue || this.generateSecretValue(secret.metadata.tags);
    this.updateSecret(id, rotatedValue);

    logger.info(`Secret rotated: ${secret.metadata.name}`, {
      component: 'secrets-manager',
      operation: 'rotate_secret',
      metadata: {
        secretId: id,
        secretName: secret.metadata.name,
        version: secret.metadata.version,
      },
    });
  }

  /**
   * Generate a secure secret value
   */
  private generateSecretValue(tags: string[]): string {
    // Generate different types of secrets based on tags
    if (tags.includes('api_key')) {
      return crypto.randomBytes(32).toString('hex');
    }
    
    if (tags.includes('jwt_secret')) {
      return crypto.randomBytes(64).toString('base64');
    }
    
    if (tags.includes('encryption_key')) {
      return crypto.randomBytes(32).toString('hex');
    }

    // Default: strong random string
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Check for secrets that need rotation
   */
  public checkRotationNeeded(): SecretMetadata[] {
    const now = new Date();
    const needsRotation: SecretMetadata[] = [];

    for (const secret of this.secrets.values()) {
      if (!secret.metadata.rotationInterval) continue;

      const lastRotated = secret.metadata.lastRotated || secret.metadata.createdAt;
      const nextRotation = new Date(lastRotated.getTime() + secret.metadata.rotationInterval);

      if (now >= nextRotation) {
        needsRotation.push(secret.metadata);
      }
    }

    return needsRotation;
  }

  /**
   * Check for secrets expiring soon
   */
  public checkExpiringSecrets(): SecretMetadata[] {
    const now = new Date();
    const expiringSoon: SecretMetadata[] = [];

    for (const secret of this.secrets.values()) {
      if (!secret.metadata.expiresAt) continue;

      const timeUntilExpiry = secret.metadata.expiresAt.getTime() - now.getTime();
      if (timeUntilExpiry > 0 && timeUntilExpiry <= this.rotationConfig.notifyBeforeExpiry) {
        expiringSoon.push(secret.metadata);
      }
    }

    return expiringSoon;
  }

  /**
   * Start rotation scheduler
   */
  private startRotationScheduler(): void {
    if (!this.rotationConfig.enabled) return;

    // Check every hour for secrets that need rotation
    setInterval(() => {
      this.performScheduledRotation();
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Perform scheduled rotation
   */
  private performScheduledRotation(): void {
    const needsRotation = this.checkRotationNeeded();
    const expiringSoon = this.checkExpiringSecrets();

    if (needsRotation.length > 0) {
      logger.info(`Found ${needsRotation.length} secrets needing rotation`, {
        component: 'secrets-manager',
        operation: 'scheduled_rotation',
        metadata: {
          secretsNeedingRotation: needsRotation.map(s => s.name),
        },
      });

      // In a real implementation, you might want to notify administrators
      // rather than automatically rotating all secrets
    }

    if (expiringSoon.length > 0) {
      logger.warn(`Found ${expiringSoon.length} secrets expiring soon`, {
        component: 'secrets-manager',
        operation: 'expiry_check',
        metadata: {
          expiringSecrets: expiringSoon.map(s => ({
            name: s.name,
            expiresAt: s.expiresAt,
          })),
        },
      });
    }
  }

  /**
   * Import secrets from environment variables
   */
  public importFromEnvironment(mapping: Record<string, { name: string; type?: string; tags?: string[] }>): void {
    for (const [envVar, config] of Object.entries(mapping)) {
      const value = process.env[envVar];
      if (value) {
        try {
          this.storeSecret(envVar.toLowerCase(), value, {
            name: config.name,
            type: config.type,
            tags: config.tags || [],
            description: `Imported from environment variable ${envVar}`,
          });
        } catch (error) {
          logger.error(`Failed to import secret from ${envVar}`, {
            component: 'secrets-manager',
            operation: 'import_from_environment',
            metadata: { envVar, secretName: config.name },
          }, error as Error);
        }
      }
    }
  }

  /**
   * Export secrets for backup (encrypted values only)
   */
  public exportSecrets(): Record<string, { metadata: SecretMetadata; encryptedValue?: string }> {
    const exported: Record<string, { metadata: SecretMetadata; encryptedValue?: string }> = {};

    for (const [id, secret] of this.secrets.entries()) {
      exported[id] = {
        metadata: secret.metadata,
        encryptedValue: secret.encrypted ? secret.value : undefined,
      };
    }

    logger.info(`Exported ${Object.keys(exported).length} secrets`, {
      component: 'secrets-manager',
      operation: 'export_secrets',
    });

    return exported;
  }

  /**
   * Get secrets statistics
   */
  public getStatistics(): {
    totalSecrets: number;
    encryptedSecrets: number;
    secretsWithExpiry: number;
    secretsNeedingRotation: number;
    secretsExpiringSoon: number;
  } {
    const total = this.secrets.size;
    const encrypted = Array.from(this.secrets.values()).filter(s => s.encrypted).length;
    const withExpiry = Array.from(this.secrets.values()).filter(s => s.metadata.expiresAt).length;
    const needingRotation = this.checkRotationNeeded().length;
    const expiringSoon = this.checkExpiringSecrets().length;

    return {
      totalSecrets: total,
      encryptedSecrets: encrypted,
      secretsWithExpiry: withExpiry,
      secretsNeedingRotation: needingRotation,
      secretsExpiringSoon: expiringSoon,
    };
  }

  /**
   * Update rotation configuration
   */
  public updateRotationConfig(config: Partial<SecretRotationConfig>): void {
    this.rotationConfig = { ...this.rotationConfig, ...config };
    
    logger.info('Secrets rotation configuration updated', {
      component: 'secrets-manager',
      operation: 'update_rotation_config',
      metadata: { config: this.rotationConfig },
    });
  }
}

// Export singleton instance (lazy initialization)
let _secretsManager: SecretsManager | null = null;

export const secretsManager = {
  getInstance(): SecretsManager {
    if (!_secretsManager) {
      _secretsManager = SecretsManager.getInstance();
    }
    return _secretsManager;
  },
  
  // Proxy methods for convenience
  getSecret: (secretId: string) => secretsManager.getInstance().getSecret(secretId),
  storeSecret: (id: string, value: string, options: {
    name: string;
    description?: string;
    type?: string;
    encrypt?: boolean;
    expiresAt?: Date;
    rotationInterval?: number;
    tags?: string[];
  }) => secretsManager.getInstance().storeSecret(id, value, options),
  updateSecret: (id: string, newValue: string, options?: { type?: string }) => 
    secretsManager.getInstance().updateSecret(id, newValue, options),
  deleteSecret: (secretId: string) => secretsManager.getInstance().deleteSecret(secretId),
  listSecrets: (tags?: string[]) => secretsManager.getInstance().listSecrets(tags),
  hasSecret: (id: string) => secretsManager.getInstance().hasSecret(id),
  getSecretMetadata: (id: string) => secretsManager.getInstance().getSecretMetadata(id),
  rotateSecret: (secretId: string, newValue?: string) => 
    secretsManager.getInstance().rotateSecret(secretId, newValue),
  checkRotationNeeded: () => secretsManager.getInstance().checkRotationNeeded(),
  checkExpiringSecrets: () => secretsManager.getInstance().checkExpiringSecrets(),
  importFromEnvironment: (mapping: Record<string, { name: string; type?: string; tags?: string[] }>) => 
    secretsManager.getInstance().importFromEnvironment(mapping),
  exportSecrets: () => secretsManager.getInstance().exportSecrets(),
  getStatistics: () => secretsManager.getInstance().getStatistics(),
  updateRotationConfig: (config: Partial<SecretRotationConfig>) => 
    secretsManager.getInstance().updateRotationConfig(config),
  addValidationRule: (secretType: string, rule: SecretValidationRule) => 
    secretsManager.getInstance().addValidationRule(secretType, rule),
};