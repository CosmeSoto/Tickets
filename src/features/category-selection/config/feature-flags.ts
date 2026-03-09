/**
 * Feature Flags Configuration for Category Selector
 * 
 * Defines feature flags for gradual rollout of new category selection features
 * with fallback support for unsupported browsers
 */

import { featureFlagsService } from '@/lib/config/feature-flags';

/**
 * Category Selector Feature Flag IDs
 */
export const CATEGORY_SELECTOR_FLAGS = {
  // Main feature flag - enables the new category selector
  ENHANCED_SELECTOR: 'enhanced_category_selector',
  
  // Individual feature flags for granular control
  SMART_SEARCH: 'category_smart_search',
  SUGGESTIONS: 'category_suggestions',
  FREQUENT_CATEGORIES: 'category_frequent',
  STEP_BY_STEP: 'category_step_by_step',
  KNOWLEDGE_BASE: 'category_knowledge_base',
  VISUAL_ENHANCEMENTS: 'category_visual_enhancements',
  ANALYTICS: 'category_analytics',
} as const;

/**
 * Initialize category selector feature flags
 */
export function initializeCategorySelectorFlags(): void {
  // Main enhanced selector flag
  featureFlagsService.setFlag({
    id: CATEGORY_SELECTOR_FLAGS.ENHANCED_SELECTOR,
    name: 'Enhanced Category Selector',
    description: 'Enable the new enhanced category selector with smart search, suggestions, and visual improvements',
    enabled: true,
    rolloutPercentage: 100, // Start with 100% for testing, can be reduced for gradual rollout
    conditions: [],
    variants: [],
  }, 'category-selector-module');

  // Smart search feature
  featureFlagsService.setFlag({
    id: CATEGORY_SELECTOR_FLAGS.SMART_SEARCH,
    name: 'Category Smart Search',
    description: 'Enable fuzzy search across category names, descriptions, and keywords',
    enabled: true,
    rolloutPercentage: 100,
    conditions: [],
    variants: [],
  }, 'category-selector-module');

  // Contextual suggestions
  featureFlagsService.setFlag({
    id: CATEGORY_SELECTOR_FLAGS.SUGGESTIONS,
    name: 'Category Suggestions',
    description: 'Enable AI-powered category suggestions based on ticket title and description',
    enabled: true,
    rolloutPercentage: 100,
    conditions: [],
    variants: [],
  }, 'category-selector-module');

  // Frequent categories
  featureFlagsService.setFlag({
    id: CATEGORY_SELECTOR_FLAGS.FREQUENT_CATEGORIES,
    name: 'Frequent Categories',
    description: 'Show frequently used categories for quick access',
    enabled: true,
    rolloutPercentage: 100,
    conditions: [],
    variants: [],
  }, 'category-selector-module');

  // Step-by-step navigation
  featureFlagsService.setFlag({
    id: CATEGORY_SELECTOR_FLAGS.STEP_BY_STEP,
    name: 'Step-by-Step Navigation',
    description: 'Enable guided step-by-step category selection mode',
    enabled: true,
    rolloutPercentage: 100,
    conditions: [],
    variants: [],
  }, 'category-selector-module');

  // Knowledge base integration
  featureFlagsService.setFlag({
    id: CATEGORY_SELECTOR_FLAGS.KNOWLEDGE_BASE,
    name: 'Knowledge Base Integration',
    description: 'Show related knowledge base articles during category selection',
    enabled: true,
    rolloutPercentage: 100,
    conditions: [],
    variants: [],
  }, 'category-selector-module');

  // Visual enhancements
  featureFlagsService.setFlag({
    id: CATEGORY_SELECTOR_FLAGS.VISUAL_ENHANCEMENTS,
    name: 'Visual Enhancements',
    description: 'Enable icons, colors, breadcrumbs, and other visual improvements',
    enabled: true,
    rolloutPercentage: 100,
    conditions: [],
    variants: [],
  }, 'category-selector-module');

  // Analytics tracking
  featureFlagsService.setFlag({
    id: CATEGORY_SELECTOR_FLAGS.ANALYTICS,
    name: 'Category Selection Analytics',
    description: 'Track user interactions with category selector for analytics',
    enabled: true,
    rolloutPercentage: 100,
    conditions: [],
    variants: [],
  }, 'category-selector-module');
}

/**
 * Check if enhanced category selector is enabled
 */
export function isEnhancedSelectorEnabled(userId?: string, userRole?: string): boolean {
  return featureFlagsService.isEnabled(CATEGORY_SELECTOR_FLAGS.ENHANCED_SELECTOR, {
    userId,
    userRole,
  });
}

/**
 * Check if a specific category selector feature is enabled
 */
export function isCategorySelectorFeatureEnabled(
  featureId: keyof typeof CATEGORY_SELECTOR_FLAGS,
  userId?: string,
  userRole?: string
): boolean {
  const flagId = CATEGORY_SELECTOR_FLAGS[featureId];
  return featureFlagsService.isEnabled(flagId, {
    userId,
    userRole,
  });
}

/**
 * Get all enabled category selector features
 */
export function getEnabledCategorySelectorFeatures(
  userId?: string,
  userRole?: string
): Record<string, boolean> {
  const features: Record<string, boolean> = {};
  
  for (const [key, flagId] of Object.entries(CATEGORY_SELECTOR_FLAGS)) {
    features[key] = featureFlagsService.isEnabled(flagId, {
      userId,
      userRole,
    });
  }
  
  return features;
}

/**
 * Browser capability detection for fallback support
 */
export interface BrowserCapabilities {
  supportsIntersectionObserver: boolean;
  supportsResizeObserver: boolean;
  supportsCustomElements: boolean;
  supportsES6: boolean;
  supportsFlexbox: boolean;
  supportsGrid: boolean;
}

/**
 * Detect browser capabilities
 */
export function detectBrowserCapabilities(): BrowserCapabilities {
  if (typeof window === 'undefined') {
    // Server-side: assume modern browser
    return {
      supportsIntersectionObserver: true,
      supportsResizeObserver: true,
      supportsCustomElements: true,
      supportsES6: true,
      supportsFlexbox: true,
      supportsGrid: true,
    };
  }

  return {
    supportsIntersectionObserver: 'IntersectionObserver' in window,
    supportsResizeObserver: 'ResizeObserver' in window,
    supportsCustomElements: 'customElements' in window,
    supportsES6: typeof Symbol !== 'undefined' && typeof Promise !== 'undefined',
    supportsFlexbox: CSS.supports('display', 'flex'),
    supportsGrid: CSS.supports('display', 'grid'),
  };
}

/**
 * Check if browser supports enhanced features
 */
export function browserSupportsEnhancedFeatures(): boolean {
  const capabilities = detectBrowserCapabilities();
  
  // Require minimum capabilities for enhanced selector
  return (
    capabilities.supportsES6 &&
    capabilities.supportsFlexbox &&
    capabilities.supportsIntersectionObserver
  );
}

/**
 * Get feature configuration with browser fallback
 */
export function getCategorySelectorConfig(
  userId?: string,
  userRole?: string
): {
  useEnhancedSelector: boolean;
  enabledFeatures: Record<string, boolean>;
  browserCapabilities: BrowserCapabilities;
  fallbackMode: boolean;
} {
  const browserCapabilities = detectBrowserCapabilities();
  const browserSupported = browserSupportsEnhancedFeatures();
  const enhancedEnabled = isEnhancedSelectorEnabled(userId, userRole);
  
  // Use enhanced selector only if both flag is enabled AND browser supports it
  const useEnhancedSelector = enhancedEnabled && browserSupported;
  
  // Get enabled features
  const enabledFeatures = getEnabledCategorySelectorFeatures(userId, userRole);
  
  // If browser doesn't support enhanced features, disable all advanced features
  if (!browserSupported) {
    Object.keys(enabledFeatures).forEach(key => {
      enabledFeatures[key] = false;
    });
  }
  
  return {
    useEnhancedSelector,
    enabledFeatures,
    browserCapabilities,
    fallbackMode: !browserSupported || !enhancedEnabled,
  };
}
