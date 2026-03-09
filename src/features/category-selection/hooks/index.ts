/**
 * Custom hooks para el módulo de selección de categorías
 */

export { useCategorySearch } from './useCategorySearch';
export type {
  UseCategorySearchOptions,
  UseCategorySearchReturn,
} from './useCategorySearch';

export { useCategorySuggestions } from './useCategorySuggestions';
export type {
  UseCategorySuggestionsOptions,
  UseCategorySuggestionsReturn,
} from './useCategorySuggestions';

export { useFrequentCategories } from './useFrequentCategories';
export type {
  UseFrequentCategoriesOptions,
  UseFrequentCategoriesReturn,
} from './useFrequentCategories';

export { useCategoriesQuery } from './useCategoriesQuery';
export type {
  UseCategoriesQueryOptions,
  UseCategoriesQueryReturn,
} from './useCategoriesQuery';

export { useCategorySelectorFeatureFlags, useCategorySelectorFeature } from './useFeatureFlags';
export type { CategorySelectorFeatureFlags } from './useFeatureFlags';
