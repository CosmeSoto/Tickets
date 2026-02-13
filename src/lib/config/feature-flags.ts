/**
 * Feature Flags Service
 * 
 * Dynamic feature flag management with gradual rollouts, A/B testing,
 * and real-time configuration updates
 */

import { logger } from '@/lib/logging';
import { configurationService } from './configuration-service';

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  conditions: FeatureFlagCondition[];
  variants: FeatureFlagVariant[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    tags: string[];
    environment: string[];
  };
}

export interface FeatureFlagCondition {
  type: 'user_id' | 'user_role' | 'user_attribute' | 'environment' | 'date_range' | 'custom';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'greater_than' | 'less_than';
  value: any;
  attribute?: string; // For user_attribute and custom conditions
}

export interface FeatureFlagVariant {
  id: string;
  name: string;
  weight: number; // 0-100, total should equal 100
  payload?: Record<string, any>;
}

export interface FeatureFlagContext {
  userId?: string;
  userRole?: string;
  userAttributes?: Record<string, any>;
  environment?: string;
  customAttributes?: Record<string, any>;
}

export interface FeatureFlagEvaluation {
  enabled: boolean;
  variant?: FeatureFlagVariant;
  reason: string;
  metadata: {
    flagId: string;
    evaluatedAt: Date;
    context: FeatureFlagContext;
  };
}

export class FeatureFlagsService {
  private static instance: FeatureFlagsService;
  private flags: Map<string, FeatureFlag> = new Map();
  private evaluationCache: Map<string, { result: FeatureFlagEvaluation; expiresAt: Date }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.initializeDefaultFlags();
    this.startCacheCleanup();
  }

  public static getInstance(): FeatureFlagsService {
    if (!FeatureFlagsService.instance) {
      FeatureFlagsService.instance = new FeatureFlagsService();
    }
    return FeatureFlagsService.instance;
  }

  /**
   * Initialize default feature flags
   */
  private initializeDefaultFlags(): void {
    const defaultFlags: Omit<FeatureFlag, 'metadata'>[] = [
      {
        id: 'ticket_assignment',
        name: 'Ticket Assignment',
        description: 'Enable automatic and manual ticket assignment',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [],
        variants: [],
      },
      {
        id: 'email_notifications',
        name: 'Email Notifications',
        description: 'Send email notifications for ticket updates',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [],
        variants: [],
      },
      {
        id: 'file_attachments',
        name: 'File Attachments',
        description: 'Allow file attachments on tickets',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [],
        variants: [],
      },
      {
        id: 'advanced_reporting',
        name: 'Advanced Reporting',
        description: 'Advanced analytics and reporting features',
        enabled: false,
        rolloutPercentage: 0,
        conditions: [
          {
            type: 'user_role',
            operator: 'in',
            value: ['ADMIN', 'MANAGER'],
          },
        ],
        variants: [],
      },
      {
        id: 'ai_suggestions',
        name: 'AI Suggestions',
        description: 'AI-powered ticket categorization and suggestions',
        enabled: false,
        rolloutPercentage: 10,
        conditions: [
          {
            type: 'environment',
            operator: 'not_equals',
            value: 'production',
          },
        ],
        variants: [
          {
            id: 'basic_ai',
            name: 'Basic AI',
            weight: 70,
            payload: { model: 'basic', confidence_threshold: 0.7 },
          },
          {
            id: 'advanced_ai',
            name: 'Advanced AI',
            weight: 30,
            payload: { model: 'advanced', confidence_threshold: 0.8 },
          },
        ],
      },
      {
        id: 'dark_mode',
        name: 'Dark Mode UI',
        description: 'Dark mode user interface',
        enabled: true,
        rolloutPercentage: 50,
        conditions: [],
        variants: [],
      },
      {
        id: 'real_time_updates',
        name: 'Real-time Updates',
        description: 'Real-time ticket updates via WebSocket',
        enabled: false,
        rolloutPercentage: 25,
        conditions: [
          {
            type: 'user_attribute',
            operator: 'equals',
            attribute: 'beta_tester',
            value: true,
          },
        ],
        variants: [],
      },
      {
        id: 'mobile_app',
        name: 'Mobile App Features',
        description: 'Mobile-specific features and optimizations',
        enabled: true,
        rolloutPercentage: 80,
        conditions: [],
        variants: [],
      },
    ];

    const now = new Date();
    const environment = configurationService.getEnvironment();

    for (const flagData of defaultFlags) {
      const flag: FeatureFlag = {
        ...flagData,
        metadata: {
          createdAt: now,
          updatedAt: now,
          createdBy: 'system',
          tags: ['default'],
          environment: [environment],
        },
      };

      this.flags.set(flag.id, flag);
    }

    logger.info(`Initialized ${defaultFlags.length} default feature flags`, {
      component: 'feature-flags',
      operation: 'initialize_defaults',
      metadata: {
        flagCount: defaultFlags.length,
        environment,
      },
    });
  }

  /**
   * Create or update a feature flag
   */
  public setFlag(flag: Omit<FeatureFlag, 'metadata'>, createdBy: string = 'system'): void {
    const now = new Date();
    const existingFlag = this.flags.get(flag.id);

    const fullFlag: FeatureFlag = {
      ...flag,
      metadata: {
        createdAt: existingFlag?.metadata.createdAt || now,
        updatedAt: now,
        createdBy: existingFlag?.metadata.createdBy || createdBy,
        tags: flag.id in (existingFlag?.metadata.tags || []) ? existingFlag!.metadata.tags : ['custom'],
        environment: [configurationService.getEnvironment()],
      },
    };

    this.flags.set(flag.id, fullFlag);
    this.clearCache(flag.id);

    logger.info(`Feature flag ${existingFlag ? 'updated' : 'created'}: ${flag.name}`, {
      component: 'feature-flags',
      operation: existingFlag ? 'update_flag' : 'create_flag',
      metadata: {
        flagId: flag.id,
        flagName: flag.name,
        enabled: flag.enabled,
        rolloutPercentage: flag.rolloutPercentage,
        createdBy,
      },
    });
  }

  /**
   * Get a feature flag
   */
  public getFlag(flagId: string): FeatureFlag | null {
    return this.flags.get(flagId) || null;
  }

  /**
   * List all feature flags
   */
  public listFlags(filters?: {
    enabled?: boolean;
    environment?: string;
    tags?: string[];
  }): FeatureFlag[] {
    let flags = Array.from(this.flags.values());

    if (filters) {
      if (filters.enabled !== undefined) {
        flags = flags.filter(flag => flag.enabled === filters.enabled);
      }

      if (filters.environment) {
        flags = flags.filter(flag => flag.metadata.environment.includes(filters.environment!));
      }

      if (filters.tags && filters.tags.length > 0) {
        flags = flags.filter(flag => 
          filters.tags!.some(tag => flag.metadata.tags.includes(tag))
        );
      }
    }

    return flags;
  }

  /**
   * Delete a feature flag
   */
  public deleteFlag(flagId: string): boolean {
    const flag = this.flags.get(flagId);
    if (!flag) {
      return false;
    }

    this.flags.delete(flagId);
    this.clearCache(flagId);

    logger.info(`Feature flag deleted: ${flag.name}`, {
      component: 'feature-flags',
      operation: 'delete_flag',
      metadata: {
        flagId,
        flagName: flag.name,
      },
    });

    return true;
  }

  /**
   * Evaluate a feature flag for a given context
   */
  public evaluateFlag(flagId: string, context: FeatureFlagContext = {}): FeatureFlagEvaluation {
    const cacheKey = this.getCacheKey(flagId, context);
    const cached = this.evaluationCache.get(cacheKey);

    if (cached && cached.expiresAt > new Date()) {
      return cached.result;
    }

    const flag = this.flags.get(flagId);
    if (!flag) {
      const result: FeatureFlagEvaluation = {
        enabled: false,
        reason: 'Flag not found',
        metadata: {
          flagId,
          evaluatedAt: new Date(),
          context,
        },
      };

      this.cacheResult(cacheKey, result);
      return result;
    }

    const result = this.performEvaluation(flag, context);
    this.cacheResult(cacheKey, result);

    return result;
  }

  /**
   * Perform the actual flag evaluation
   */
  private performEvaluation(flag: FeatureFlag, context: FeatureFlagContext): FeatureFlagEvaluation {
    const now = new Date();

    // Check if flag is globally disabled
    if (!flag.enabled) {
      return {
        enabled: false,
        reason: 'Flag is disabled',
        metadata: {
          flagId: flag.id,
          evaluatedAt: now,
          context,
        },
      };
    }

    // Check conditions
    for (const condition of flag.conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return {
          enabled: false,
          reason: `Condition not met: ${condition.type} ${condition.operator} ${condition.value}`,
          metadata: {
            flagId: flag.id,
            evaluatedAt: now,
            context,
          },
        };
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const hash = this.hashContext(flag.id, context);
      const percentage = hash % 100;
      
      if (percentage >= flag.rolloutPercentage) {
        return {
          enabled: false,
          reason: `Outside rollout percentage: ${percentage}% >= ${flag.rolloutPercentage}%`,
          metadata: {
            flagId: flag.id,
            evaluatedAt: now,
            context,
          },
        };
      }
    }

    // Select variant if available
    let selectedVariant: FeatureFlagVariant | undefined;
    if (flag.variants.length > 0) {
      selectedVariant = this.selectVariant(flag.variants, flag.id, context);
    }

    return {
      enabled: true,
      variant: selectedVariant,
      reason: 'All conditions met',
      metadata: {
        flagId: flag.id,
        evaluatedAt: now,
        context,
      },
    };
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: FeatureFlagCondition, context: FeatureFlagContext): boolean {
    let contextValue: any;

    switch (condition.type) {
      case 'user_id':
        contextValue = context.userId;
        break;
      case 'user_role':
        contextValue = context.userRole;
        break;
      case 'user_attribute':
        contextValue = context.userAttributes?.[condition.attribute!];
        break;
      case 'environment':
        contextValue = context.environment || configurationService.getEnvironment();
        break;
      case 'custom':
        contextValue = context.customAttributes?.[condition.attribute!];
        break;
      default:
        return false;
    }

    return this.evaluateOperator(condition.operator, contextValue, condition.value);
  }

  /**
   * Evaluate an operator
   */
  private evaluateOperator(operator: string, contextValue: any, conditionValue: any): boolean {
    switch (operator) {
      case 'equals':
        return contextValue === conditionValue;
      case 'not_equals':
        return contextValue !== conditionValue;
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(contextValue);
      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(contextValue);
      case 'contains':
        return typeof contextValue === 'string' && contextValue.includes(conditionValue);
      case 'greater_than':
        return typeof contextValue === 'number' && contextValue > conditionValue;
      case 'less_than':
        return typeof contextValue === 'number' && contextValue < conditionValue;
      default:
        return false;
    }
  }

  /**
   * Select a variant based on weights
   */
  private selectVariant(variants: FeatureFlagVariant[], flagId: string, context: FeatureFlagContext): FeatureFlagVariant {
    const hash = this.hashContext(flagId + '_variant', context);
    const percentage = hash % 100;
    
    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.weight;
      if (percentage < cumulativeWeight) {
        return variant;
      }
    }

    // Fallback to first variant
    return variants[0];
  }

  /**
   * Hash context for consistent evaluation
   */
  private hashContext(seed: string, context: FeatureFlagContext): number {
    const key = context.userId || context.userRole || 'anonymous';
    const str = seed + key;
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(flagId: string, context: FeatureFlagContext): string {
    const contextStr = JSON.stringify(context);
    return `${flagId}:${contextStr}`;
  }

  /**
   * Cache evaluation result
   */
  private cacheResult(cacheKey: string, result: FeatureFlagEvaluation): void {
    this.evaluationCache.set(cacheKey, {
      result,
      expiresAt: new Date(Date.now() + this.cacheTimeout),
    });
  }

  /**
   * Clear cache for a specific flag
   */
  private clearCache(flagId?: string): void {
    if (flagId) {
      // Clear cache entries for specific flag
      for (const [key] of this.evaluationCache.entries()) {
        if (key.startsWith(flagId + ':')) {
          this.evaluationCache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.evaluationCache.clear();
    }
  }

  /**
   * Start cache cleanup process
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = new Date();
      for (const [key, cached] of this.evaluationCache.entries()) {
        if (cached.expiresAt <= now) {
          this.evaluationCache.delete(key);
        }
      }
    }, 60 * 1000); // Clean up every minute
  }

  /**
   * Check if a feature is enabled (convenience method)
   */
  public isEnabled(flagId: string, context: FeatureFlagContext = {}): boolean {
    const evaluation = this.evaluateFlag(flagId, context);
    return evaluation.enabled;
  }

  /**
   * Get feature variant (convenience method)
   */
  public getVariant(flagId: string, context: FeatureFlagContext = {}): FeatureFlagVariant | null {
    const evaluation = this.evaluateFlag(flagId, context);
    return evaluation.variant || null;
  }

  /**
   * Bulk evaluate multiple flags
   */
  public evaluateFlags(flagIds: string[], context: FeatureFlagContext = {}): Record<string, FeatureFlagEvaluation> {
    const results: Record<string, FeatureFlagEvaluation> = {};
    
    for (const flagId of flagIds) {
      results[flagId] = this.evaluateFlag(flagId, context);
    }

    return results;
  }

  /**
   * Get feature flags statistics
   */
  public getStatistics(): {
    totalFlags: number;
    enabledFlags: number;
    flagsWithConditions: number;
    flagsWithVariants: number;
    cacheSize: number;
  } {
    const flags = Array.from(this.flags.values());
    
    return {
      totalFlags: flags.length,
      enabledFlags: flags.filter(f => f.enabled).length,
      flagsWithConditions: flags.filter(f => f.conditions.length > 0).length,
      flagsWithVariants: flags.filter(f => f.variants.length > 0).length,
      cacheSize: this.evaluationCache.size,
    };
  }

  /**
   * Export flags configuration
   */
  public exportFlags(): Record<string, FeatureFlag> {
    const exported: Record<string, FeatureFlag> = {};
    
    for (const [id, flag] of this.flags.entries()) {
      exported[id] = { ...flag };
    }

    return exported;
  }

  /**
   * Import flags configuration
   */
  public importFlags(flags: Record<string, Omit<FeatureFlag, 'metadata'>>, createdBy: string = 'import'): void {
    for (const [id, flag] of Object.entries(flags)) {
      this.setFlag({ ...flag, id }, createdBy);
    }

    logger.info(`Imported ${Object.keys(flags).length} feature flags`, {
      component: 'feature-flags',
      operation: 'import_flags',
      metadata: {
        flagCount: Object.keys(flags).length,
        createdBy,
      },
    });
  }
}

// Export singleton instance
export const featureFlagsService = FeatureFlagsService.getInstance();