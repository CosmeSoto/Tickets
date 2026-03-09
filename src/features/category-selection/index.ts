/**
 * Módulo de selección de categorías
 * 
 * Este módulo proporciona una experiencia mejorada de selección de categorías
 * con búsqueda inteligente, sugerencias contextuales y navegación visual.
 */

// Tipos
export type {
  Category,
  SearchResult,
  Suggestion,
  CategoryMetadata,
  CategorySearchIndex,
  FrequentCategory,
  CategoryAnalyticsEvent,
} from './types';

// Configuración
export {
  fuseOptions,
  normalizeText,
  extractKeywords,
} from './config/fuse.config';

export {
  categoryQueryKeys,
  categoryQueryOptions,
  createCategoryQueryClient,
} from './config/query.config';

// Utilidades
export {
  buildCategoryPath,
  buildSearchIndex,
  filterActiveCategories,
} from './utils/search-index';

// Hooks
export {
  useCategorySearch,
  type UseCategorySearchOptions,
  type UseCategorySearchReturn,
} from './hooks/useCategorySearch';

// Componentes
export {
  CategorySelector,
  type CategorySelectorProps,
  CategorySelectorWrapper,
  type CategorySelectorWrapperProps,
  SearchBar,
  type SearchBarProps,
  SuggestionEngine,
  type SuggestionEngineProps,
  CategoryTree,
  type CategoryTreeProps,
  StepByStepNavigator,
  type StepByStepNavigatorProps,
  FrequentCategories,
  type FrequentCategoriesProps,
  ConfirmationPanel,
  type ConfirmationPanelProps,
  RelatedArticles,
  type RelatedArticlesProps,
  ArticleViewerModal,
  type ArticleViewerModalProps,
  KnowledgeBaseSearch,
  type KnowledgeBaseSearchProps,
  CategorySelectorFallback,
} from './components';

// Feature Flags
export {
  CATEGORY_SELECTOR_FLAGS,
  initializeCategorySelectorFlags,
  isEnhancedSelectorEnabled,
  isCategorySelectorFeatureEnabled,
  getEnabledCategorySelectorFeatures,
  getCategorySelectorConfig,
  detectBrowserCapabilities,
  browserSupportsEnhancedFeatures,
  type BrowserCapabilities,
} from './config/feature-flags';

export {
  useCategorySelectorFeatureFlags,
  useCategorySelectorFeature,
  type CategorySelectorFeatureFlags,
} from './hooks/useFeatureFlags';
