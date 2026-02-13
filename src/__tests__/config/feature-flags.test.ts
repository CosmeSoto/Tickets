/**
 * Feature Flags Service Tests
 */

import { FeatureFlagsService, FeatureFlagContext } from '@/lib/config/feature-flags';

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
    getEnvironment: jest.fn(() => 'test'),
  },
}));

describe('FeatureFlagsService', () => {
  let featureFlagsService: FeatureFlagsService;

  beforeEach(() => {
    featureFlagsService = FeatureFlagsService.getInstance();
    
    // Clear any existing flags for clean tests
    (featureFlagsService as any).flags.clear();
    (featureFlagsService as any).evaluationCache.clear();
    
    // Re-initialize default flags
    (featureFlagsService as any).initializeDefaultFlags();
  });

  describe('Default Flags', () => {
    it('should initialize with default feature flags', () => {
      const flags = featureFlagsService.listFlags();
      
      expect(flags.length).toBeGreaterThan(0);
      
      // Check for some expected default flags
      const flagNames = flags.map(f => f.id);
      expect(flagNames).toContain('ticket_assignment');
      expect(flagNames).toContain('email_notifications');
      expect(flagNames).toContain('file_attachments');
      expect(flagNames).toContain('advanced_reporting');
    });

    it('should have correct default flag configurations', () => {
      const ticketAssignment = featureFlagsService.getFlag('ticket_assignment');
      expect(ticketAssignment).toBeDefined();
      expect(ticketAssignment!.enabled).toBe(true);
      expect(ticketAssignment!.rolloutPercentage).toBe(100);

      const advancedReporting = featureFlagsService.getFlag('advanced_reporting');
      expect(advancedReporting).toBeDefined();
      expect(advancedReporting!.enabled).toBe(false);
      expect(advancedReporting!.conditions.length).toBeGreaterThan(0);
    });
  });

  describe('Flag Management', () => {
    it('should create new feature flags', () => {
      const newFlag = {
        id: 'test_feature',
        name: 'Test Feature',
        description: 'A test feature flag',
        enabled: true,
        rolloutPercentage: 50,
        conditions: [],
        variants: [],
      };

      featureFlagsService.setFlag(newFlag, 'test-user');

      const retrieved = featureFlagsService.getFlag('test_feature');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('Test Feature');
      expect(retrieved!.enabled).toBe(true);
      expect(retrieved!.rolloutPercentage).toBe(50);
      expect(retrieved!.metadata.createdBy).toBe('test-user');
    });

    it('should update existing feature flags', () => {
      const originalFlag = {
        id: 'test_feature',
        name: 'Test Feature',
        description: 'A test feature flag',
        enabled: false,
        rolloutPercentage: 25,
        conditions: [],
        variants: [],
      };

      featureFlagsService.setFlag(originalFlag, 'test-user');

      const updatedFlag = {
        ...originalFlag,
        enabled: true,
        rolloutPercentage: 75,
      };

      featureFlagsService.setFlag(updatedFlag, 'test-user');

      const retrieved = featureFlagsService.getFlag('test_feature');
      expect(retrieved!.enabled).toBe(true);
      expect(retrieved!.rolloutPercentage).toBe(75);
    });

    it('should delete feature flags', () => {
      const flag = {
        id: 'test_feature',
        name: 'Test Feature',
        description: 'A test feature flag',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [],
        variants: [],
      };

      featureFlagsService.setFlag(flag);
      expect(featureFlagsService.getFlag('test_feature')).toBeDefined();

      const deleted = featureFlagsService.deleteFlag('test_feature');
      expect(deleted).toBe(true);
      expect(featureFlagsService.getFlag('test_feature')).toBeNull();
    });

    it('should return false when deleting non-existent flag', () => {
      const deleted = featureFlagsService.deleteFlag('non_existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Flag Evaluation', () => {
    beforeEach(() => {
      // Create test flags
      featureFlagsService.setFlag({
        id: 'simple_enabled',
        name: 'Simple Enabled',
        description: 'A simple enabled flag',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [],
        variants: [],
      });

      featureFlagsService.setFlag({
        id: 'simple_disabled',
        name: 'Simple Disabled',
        description: 'A simple disabled flag',
        enabled: false,
        rolloutPercentage: 100,
        conditions: [],
        variants: [],
      });

      featureFlagsService.setFlag({
        id: 'rollout_50',
        name: 'Rollout 50%',
        description: 'A flag with 50% rollout',
        enabled: true,
        rolloutPercentage: 50,
        conditions: [],
        variants: [],
      });

      featureFlagsService.setFlag({
        id: 'admin_only',
        name: 'Admin Only',
        description: 'A flag only for admins',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [
          {
            type: 'user_role',
            operator: 'equals',
            value: 'ADMIN',
          },
        ],
        variants: [],
      });
    });

    it('should evaluate simple enabled flags', () => {
      const evaluation = featureFlagsService.evaluateFlag('simple_enabled');
      
      expect(evaluation.enabled).toBe(true);
      expect(evaluation.reason).toBe('All conditions met');
      expect(evaluation.metadata.flagId).toBe('simple_enabled');
    });

    it('should evaluate simple disabled flags', () => {
      const evaluation = featureFlagsService.evaluateFlag('simple_disabled');
      
      expect(evaluation.enabled).toBe(false);
      expect(evaluation.reason).toBe('Flag is disabled');
    });

    it('should return false for non-existent flags', () => {
      const evaluation = featureFlagsService.evaluateFlag('non_existent');
      
      expect(evaluation.enabled).toBe(false);
      expect(evaluation.reason).toBe('Flag not found');
    });

    it('should evaluate rollout percentage', () => {
      const context: FeatureFlagContext = { userId: 'user123' };
      
      // Test multiple evaluations to ensure consistency
      const evaluation1 = featureFlagsService.evaluateFlag('rollout_50', context);
      const evaluation2 = featureFlagsService.evaluateFlag('rollout_50', context);
      
      expect(evaluation1.enabled).toBe(evaluation2.enabled); // Should be consistent
    });

    it('should evaluate user role conditions', () => {
      const adminContext: FeatureFlagContext = { userRole: 'ADMIN' };
      const userContext: FeatureFlagContext = { userRole: 'USER' };
      
      const adminEvaluation = featureFlagsService.evaluateFlag('admin_only', adminContext);
      const userEvaluation = featureFlagsService.evaluateFlag('admin_only', userContext);
      
      expect(adminEvaluation.enabled).toBe(true);
      expect(userEvaluation.enabled).toBe(false);
      expect(userEvaluation.reason).toContain('Condition not met');
    });

    it('should evaluate user ID conditions', () => {
      featureFlagsService.setFlag({
        id: 'specific_user',
        name: 'Specific User',
        description: 'Flag for specific user',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [
          {
            type: 'user_id',
            operator: 'equals',
            value: 'user123',
          },
        ],
        variants: [],
      });

      const matchingContext: FeatureFlagContext = { userId: 'user123' };
      const nonMatchingContext: FeatureFlagContext = { userId: 'user456' };
      
      const matchingEvaluation = featureFlagsService.evaluateFlag('specific_user', matchingContext);
      const nonMatchingEvaluation = featureFlagsService.evaluateFlag('specific_user', nonMatchingContext);
      
      expect(matchingEvaluation.enabled).toBe(true);
      expect(nonMatchingEvaluation.enabled).toBe(false);
    });

    it('should evaluate user attribute conditions', () => {
      featureFlagsService.setFlag({
        id: 'beta_testers',
        name: 'Beta Testers',
        description: 'Flag for beta testers',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [
          {
            type: 'user_attribute',
            operator: 'equals',
            attribute: 'beta_tester',
            value: true,
          },
        ],
        variants: [],
      });

      const betaTesterContext: FeatureFlagContext = {
        userAttributes: { beta_tester: true },
      };
      const regularUserContext: FeatureFlagContext = {
        userAttributes: { beta_tester: false },
      };
      
      const betaEvaluation = featureFlagsService.evaluateFlag('beta_testers', betaTesterContext);
      const regularEvaluation = featureFlagsService.evaluateFlag('beta_testers', regularUserContext);
      
      expect(betaEvaluation.enabled).toBe(true);
      expect(regularEvaluation.enabled).toBe(false);
    });

    it('should evaluate environment conditions', () => {
      featureFlagsService.setFlag({
        id: 'dev_only',
        name: 'Development Only',
        description: 'Flag only for development',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [
          {
            type: 'environment',
            operator: 'equals',
            value: 'development',
          },
        ],
        variants: [],
      });

      const devContext: FeatureFlagContext = { environment: 'development' };
      const prodContext: FeatureFlagContext = { environment: 'production' };
      
      const devEvaluation = featureFlagsService.evaluateFlag('dev_only', devContext);
      const prodEvaluation = featureFlagsService.evaluateFlag('dev_only', prodContext);
      
      expect(devEvaluation.enabled).toBe(true);
      expect(prodEvaluation.enabled).toBe(false);
    });
  });

  describe('Flag Variants', () => {
    beforeEach(() => {
      featureFlagsService.setFlag({
        id: 'ab_test',
        name: 'A/B Test',
        description: 'A/B testing flag',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [],
        variants: [
          {
            id: 'variant_a',
            name: 'Variant A',
            weight: 50,
            payload: { color: 'blue', size: 'large' },
          },
          {
            id: 'variant_b',
            name: 'Variant B',
            weight: 50,
            payload: { color: 'red', size: 'small' },
          },
        ],
      });
    });

    it('should select variants based on context', () => {
      const context: FeatureFlagContext = { userId: 'user123' };
      
      const evaluation = featureFlagsService.evaluateFlag('ab_test', context);
      
      expect(evaluation.enabled).toBe(true);
      expect(evaluation.variant).toBeDefined();
      expect(['variant_a', 'variant_b']).toContain(evaluation.variant!.id);
      expect(evaluation.variant!.payload).toBeDefined();
    });

    it('should provide consistent variant selection', () => {
      const context: FeatureFlagContext = { userId: 'user123' };
      
      const evaluation1 = featureFlagsService.evaluateFlag('ab_test', context);
      const evaluation2 = featureFlagsService.evaluateFlag('ab_test', context);
      
      expect(evaluation1.variant!.id).toBe(evaluation2.variant!.id);
    });

    it('should return variant using convenience method', () => {
      const context: FeatureFlagContext = { userId: 'user123' };
      
      const variant = featureFlagsService.getVariant('ab_test', context);
      
      expect(variant).toBeDefined();
      expect(['variant_a', 'variant_b']).toContain(variant!.id);
    });
  });

  describe('Convenience Methods', () => {
    beforeEach(() => {
      featureFlagsService.setFlag({
        id: 'test_flag',
        name: 'Test Flag',
        description: 'A test flag',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [],
        variants: [],
      });
    });

    it('should check if feature is enabled', () => {
      expect(featureFlagsService.isEnabled('test_flag')).toBe(true);
      expect(featureFlagsService.isEnabled('non_existent')).toBe(false);
    });

    it('should bulk evaluate multiple flags', () => {
      const flagIds = ['test_flag', 'non_existent'];
      const context: FeatureFlagContext = { userId: 'user123' };
      
      const results = featureFlagsService.evaluateFlags(flagIds, context);
      
      expect(Object.keys(results)).toHaveLength(2);
      expect(results.test_flag.enabled).toBe(true);
      expect(results.non_existent.enabled).toBe(false);
    });
  });

  describe('Flag Filtering', () => {
    beforeEach(() => {
      featureFlagsService.setFlag({
        id: 'enabled_flag',
        name: 'Enabled Flag',
        description: 'An enabled flag',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [],
        variants: [],
      });

      featureFlagsService.setFlag({
        id: 'disabled_flag',
        name: 'Disabled Flag',
        description: 'A disabled flag',
        enabled: false,
        rolloutPercentage: 100,
        conditions: [],
        variants: [],
      });
    });

    it('should filter flags by enabled status', () => {
      const enabledFlags = featureFlagsService.listFlags({ enabled: true });
      const disabledFlags = featureFlagsService.listFlags({ enabled: false });
      
      expect(enabledFlags.every(f => f.enabled)).toBe(true);
      expect(disabledFlags.every(f => !f.enabled)).toBe(true);
      expect(enabledFlags.some(f => f.id === 'enabled_flag')).toBe(true);
      expect(disabledFlags.some(f => f.id === 'disabled_flag')).toBe(true);
    });

    it('should filter flags by environment', () => {
      const testFlags = featureFlagsService.listFlags({ environment: 'test' });
      
      expect(testFlags.every(f => f.metadata.environment.includes('test'))).toBe(true);
    });

    it('should filter flags by tags', () => {
      const defaultFlags = featureFlagsService.listFlags({ tags: ['default'] });
      
      expect(defaultFlags.every(f => f.metadata.tags.includes('default'))).toBe(true);
    });
  });

  describe('Caching', () => {
    beforeEach(() => {
      featureFlagsService.setFlag({
        id: 'cached_flag',
        name: 'Cached Flag',
        description: 'A flag for testing caching',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [],
        variants: [],
      });
    });

    it('should cache evaluation results', () => {
      const context: FeatureFlagContext = { userId: 'user123' };
      
      const evaluation1 = featureFlagsService.evaluateFlag('cached_flag', context);
      const evaluation2 = featureFlagsService.evaluateFlag('cached_flag', context);
      
      // Results should be identical (cached)
      expect(evaluation1).toEqual(evaluation2);
    });

    it('should clear cache when flag is updated', () => {
      const context: FeatureFlagContext = { userId: 'user123' };
      
      const evaluation1 = featureFlagsService.evaluateFlag('cached_flag', context);
      expect(evaluation1.enabled).toBe(true);
      
      // Update flag to disabled
      featureFlagsService.setFlag({
        id: 'cached_flag',
        name: 'Cached Flag',
        description: 'A flag for testing caching',
        enabled: false,
        rolloutPercentage: 100,
        conditions: [],
        variants: [],
      });
      
      const evaluation2 = featureFlagsService.evaluateFlag('cached_flag', context);
      expect(evaluation2.enabled).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      // Clear existing flags and add test flags
      (featureFlagsService as any).flags.clear();
      
      featureFlagsService.setFlag({
        id: 'flag1',
        name: 'Flag 1',
        description: 'First flag',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [{ type: 'user_role', operator: 'equals', value: 'ADMIN' }],
        variants: [],
      });

      featureFlagsService.setFlag({
        id: 'flag2',
        name: 'Flag 2',
        description: 'Second flag',
        enabled: false,
        rolloutPercentage: 50,
        conditions: [],
        variants: [
          { id: 'v1', name: 'Variant 1', weight: 100 },
        ],
      });

      const stats = featureFlagsService.getStatistics();
      
      expect(stats.totalFlags).toBe(2);
      expect(stats.enabledFlags).toBe(1);
      expect(stats.flagsWithConditions).toBe(1);
      expect(stats.flagsWithVariants).toBe(1);
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Import and Export', () => {
    it('should export flags configuration', () => {
      const exported = featureFlagsService.exportFlags();
      
      expect(typeof exported).toBe('object');
      expect(Object.keys(exported).length).toBeGreaterThan(0);
      
      // Check that default flags are included
      expect(exported.ticket_assignment).toBeDefined();
      expect(exported.email_notifications).toBeDefined();
    });

    it('should import flags configuration', () => {
      const flagsToImport = {
        imported_flag: {
          id: 'imported_flag',
          name: 'Imported Flag',
          description: 'An imported flag',
          enabled: true,
          rolloutPercentage: 75,
          conditions: [],
          variants: [],
        },
      };

      featureFlagsService.importFlags(flagsToImport, 'test-import');

      const importedFlag = featureFlagsService.getFlag('imported_flag');
      expect(importedFlag).toBeDefined();
      expect(importedFlag!.name).toBe('Imported Flag');
      expect(importedFlag!.rolloutPercentage).toBe(75);
      expect(importedFlag!.metadata.createdBy).toBe('test-import');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = FeatureFlagsService.getInstance();
      const instance2 = FeatureFlagsService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});