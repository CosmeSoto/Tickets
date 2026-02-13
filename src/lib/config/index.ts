/**
 * Configuration Management - Main Export
 * 
 * Centralized export for all configuration services
 */

// Configuration Service
export { 
  ConfigurationService, 
  configurationService 
} from './configuration-service';
export type { 
  Configuration, 
  DatabaseConfig, 
  RedisConfig, 
  AuthConfig, 
  EmailConfig, 
  StorageConfig, 
  SecurityConfig, 
  MonitoringConfig, 
  AppConfig, 
  Environment 
} from './configuration-service';

// Secrets Manager
export { 
  SecretsManager, 
  secretsManager 
} from './secrets-manager';
export type { 
  Secret, 
  SecretMetadata, 
  SecretValidationRule, 
  SecretRotationConfig 
} from './secrets-manager';

// Feature Flags
export { 
  FeatureFlagsService, 
  featureFlagsService 
} from './feature-flags';
export type { 
  FeatureFlag, 
  FeatureFlagCondition, 
  FeatureFlagVariant, 
  FeatureFlagContext, 
  FeatureFlagEvaluation 
} from './feature-flags';

// Convenience exports
import { configurationService, type Configuration } from './configuration-service';
import { secretsManager } from './secrets-manager';
import { featureFlagsService } from './feature-flags';

// Default instances
export const config = configurationService;
export const secrets = secretsManager;
export const flags = featureFlagsService;

// Convenience functions
export const getConfig = <K extends keyof Configuration>(section: K) => 
  configurationService.getConfig(section);

export const isFeatureEnabled = (flagId: string, context?: any) => 
  featureFlagsService.isEnabled(flagId, context);

export const getSecret = (secretId: string) => 
  secretsManager.getSecret(secretId);

export const isProduction = () => 
  configurationService.isProduction();

export const isDevelopment = () => 
  configurationService.isDevelopment();

export const getEnvironment = () => 
  configurationService.getEnvironment();