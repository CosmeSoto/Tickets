/**
 * Exportación centralizada de hooks comunes
 * Facilita la importación en otros módulos
 * 
 * @example
 * ```tsx
 * import { useFilters, useViewMode, usePagination } from '@/hooks/common'
 * ```
 */

export { useFilters } from './use-filters'
export type { FilterConfig, UseFiltersOptions, UseFiltersReturn } from './use-filters'

export { useViewMode } from './use-view-mode'
export type { ViewMode, UseViewModeOptions, UseViewModeReturn } from './use-view-mode'

export { usePagination } from './use-pagination'
export type { UsePaginationOptions, UsePaginationReturn } from './use-pagination'

export { useModuleData } from './use-module-data'
export type { UseModuleDataOptions, UseModuleDataReturn } from './use-module-data'

export { useDebounce } from './use-debounce'
