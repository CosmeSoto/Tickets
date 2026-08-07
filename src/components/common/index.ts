/**
 * Componentes comunes del dashboard.
 *
 * ## Listados (patrón recomendado)
 *
 * 1. Filtros: `FilterBar` + `useFilters` (`@/components/common/filters`)
 * 2. Toolbar de tabla Card+Table: `ListTableToolbar` (refresh · vista · columnas · export)
 * 3. Export: `useExport` + `ExportButton` (o Excel multi vía `exportToExcelMulti`)
 * 4. Si ya usas `DataTable` (`@/components/ui/data-table`): pásale `actions={<ExportButton … />}`
 *    y no dupliques refresh/vista — DataTable ya los trae.
 *
 * No reescribir módulos estables de golpe; migrar al tocar cada pantalla.
 *
 * @example
 * ```tsx
 * import {
 *   FilterBar,
 *   ListTableToolbar,
 *   ExportButton,
 *   ModuleLayout,
 * } from '@/components/common'
 * ```
 */

// Filtros canónicos (carpeta filters/)
export * from './filters'

// Estadísticas
export * from './stats'

// Vistas
export * from './views'

// Acciones
export * from './actions'

// Layout
export * from './layout'

// Listados / export
export { ListTableToolbar } from './list-table-toolbar'
export type { ListTableToolbarProps } from './list-table-toolbar'
export { ExportButton } from './export-button'
export { TableColumnsMenu } from './table-columns-menu'
export type { TableColumnDef } from './table-columns-menu'
