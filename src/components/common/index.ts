/**
 * Exportación centralizada de todos los componentes comunes
 * Facilita la importación en otros módulos
 * 
 * @example
 * ```tsx
 * import { 
 *   FilterBar, 
 *   SearchInput, 
 *   StatsBar, 
 *   ViewToggle, 
 *   CardGrid,
 *   ActionBar,
 *   Pagination,
 *   ModuleLayout
 * } from '@/components/common'
 * ```
 */

// Componentes de filtros
export * from './filters'

// Componentes de estadísticas
export * from './stats'

// Componentes de vistas
export * from './views'

// Componentes de acciones
export * from './actions'

// Componentes de layout
export * from './layout'
