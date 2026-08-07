/**
 * Filtros canónicos del dashboard.
 *
 * Preferir siempre este paquete:
 *   import { FilterBar, SearchInput } from '@/components/common/filters'
 *   import { useFilters } from '@/hooks/common/use-filters'
 *
 * No confundir con `legacy-role-filters.tsx` (obsoleto, sin consumidores).
 */

export { FilterBar } from './filter-bar'
export type { FilterBarProps } from './filter-bar'

export { SearchInput } from './search-input'
export type { SearchInputProps } from './search-input'

export { SelectFilter } from './select-filter'
export type { SelectFilterProps, SelectOption } from './select-filter'
