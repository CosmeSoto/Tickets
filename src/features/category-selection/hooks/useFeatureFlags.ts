/**
 * Hook for accessing category selector feature flags
 */

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
  getCategorySelectorConfig,
  CATEGORY_SELECTOR_FLAGS,
  type BrowserCapabilities,
} from '../config/feature-flags';

export interface CategorySelectorFeatureFlags {
  // Main flag
  useEnhancedSelector: boolean;
  
  // Individual features
  smartSearch: boolean;
  suggestions: boolean;
  frequentCategories: boolean;
  stepByStep: boolean;
  knowledgeBase: boolean;
  visualEnhancements: boolean;
  analytics: boolean;
  
  // Browser support
  browserCapabilities: BrowserCapabilities;
  fallbackMode: boolean;
}

/**
 * Hook to get category selector feature flags
 */
export function useCategorySelectorFeatureFlags(): CategorySelectorFeatureFlags {
  const { data: session } = useSession();
  
  const flags = useMemo(() => {
    const userId = session?.user?.id;
    const userRole = session?.user?.role;
    
    const config = getCategorySelectorConfig(userId, userRole);
    
    return {
      useEnhancedSelector: config.useEnhancedSelector,
      smartSearch: config.enabledFeatures.SMART_SEARCH ?? false,
      suggestions: config.enabledFeatures.SUGGESTIONS ?? false,
      frequentCategories: config.enabledFeatures.FREQUENT_CATEGORIES ?? false,
      stepByStep: config.enabledFeatures.STEP_BY_STEP ?? false,
      knowledgeBase: config.enabledFeatures.KNOWLEDGE_BASE ?? false,
      visualEnhancements: config.enabledFeatures.VISUAL_ENHANCEMENTS ?? false,
      analytics: config.enabledFeatures.ANALYTICS ?? false,
      browserCapabilities: config.browserCapabilities,
      fallbackMode: config.fallbackMode,
    };
  }, [session?.user?.id, session?.user?.role]);
  
  return flags;
}

/**
 * Hook to check if a specific feature is enabled
 */
export function useCategorySelectorFeature(
  feature: keyof typeof CATEGORY_SELECTOR_FLAGS
): boolean {
  const flags = useCategorySelectorFeatureFlags();
  
  const featureMap: Record<string, boolean> = {
    ENHANCED_SELECTOR: flags.useEnhancedSelector,
    SMART_SEARCH: flags.smartSearch,
    SUGGESTIONS: flags.suggestions,
    FREQUENT_CATEGORIES: flags.frequentCategories,
    STEP_BY_STEP: flags.stepByStep,
    KNOWLEDGE_BASE: flags.knowledgeBase,
    VISUAL_ENHANCEMENTS: flags.visualEnhancements,
    ANALYTICS: flags.analytics,
  };
  
  return featureMap[feature] ?? false;
}
