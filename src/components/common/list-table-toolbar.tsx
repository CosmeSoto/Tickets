'use client'

/**
 * Barra estándar encima de tablas listado (Card + Table):
 * título · refrescar · vista tabla/cards · columnas · exportar · acciones extra
 *
 * Usar cuando la página NO usa `DataTable` (que ya trae toolbar propia).
 * Ejemplos: Credenciales, Familias.
 *
 * Inventario / contratos: puedes usar solo `export` + `onRefresh` y
 * poner búsqueda/selects en `endActions`, o dejar filtros en una fila aparte.
 */

import type { ReactNode } from 'react'
import { LayoutGrid, List, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExportButton } from '@/components/common/export-button'
import { TableColumnsMenu, type TableColumnDef } from '@/components/common/table-columns-menu'
import { cn } from '@/lib/utils'

type ViewMode = 'table' | 'cards'

export type ListTableToolbarProps = {
  title: ReactNode
  subtitle?: ReactNode
  loading?: boolean
  onRefresh?: () => void
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  /** false si no hay vista cards */
  showViewToggle?: boolean
  columns?: {
    defs: TableColumnDef[]
    order: string[]
    visible: string[]
    onOrderChange: (order: string[]) => void
    onVisibleChange: (visible: string[]) => void
    storageKey?: string
  }
  export?: {
    onExportCSV: () => void
    onExportExcel: () => Promise<void>
    onExportPDF: () => void
    loading?: boolean
    disabled?: boolean
  }
  /** Acciones a la derecha (filtros locales, botones extra) */
  endActions?: ReactNode
  className?: string
}

export function ListTableToolbar({
  title,
  subtitle,
  loading,
  onRefresh,
  viewMode = 'table',
  onViewModeChange,
  showViewToggle = true,
  columns,
  export: exportProps,
  endActions,
  className,
}: ListTableToolbarProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <div className='flex-1 min-w-0'>{title}</div>
        <div className='flex flex-wrap items-center gap-2'>
          {onRefresh && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          )}
          {showViewToggle && onViewModeChange && (
            <div className='flex items-center rounded-md border p-0.5'>
              <Button
                type='button'
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size='sm'
                className='h-8 px-2.5'
                onClick={() => onViewModeChange('table')}
                title='Vista tabla'
              >
                <List className='h-4 w-4' />
              </Button>
              <Button
                type='button'
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size='sm'
                className='h-8 px-2.5'
                onClick={() => onViewModeChange('cards')}
                title='Vista tarjetas'
              >
                <LayoutGrid className='h-4 w-4' />
              </Button>
            </div>
          )}
          {columns && (
            <TableColumnsMenu
              columns={columns.defs}
              order={columns.order}
              visible={columns.visible}
              onOrderChange={columns.onOrderChange}
              onVisibleChange={columns.onVisibleChange}
              storageKey={columns.storageKey}
            />
          )}
          {exportProps && (
            <ExportButton
              onExportCSV={exportProps.onExportCSV}
              onExportExcel={exportProps.onExportExcel}
              onExportPDF={exportProps.onExportPDF}
              loading={exportProps.loading}
              disabled={exportProps.disabled}
            />
          )}
          {endActions}
        </div>
      </div>
      {subtitle ? <div className='text-xs text-muted-foreground'>{subtitle}</div> : null}
    </div>
  )
}
