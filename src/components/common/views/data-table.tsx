/**
 * Tabla avanzada con ordenamiento y selección
 * Incluye columnas configurables, empty state, loading, header y paginación
 * Fase 13.3 - Mejorado con estándares unificados
 */

'use client'

import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ViewContainer } from './view-container'
import type { ViewHeader, PaginationConfig, EmptyState, SortConfig, SelectionProps } from '@/types/views'
import type { ColumnConfig } from '@/types/common'

export interface DataTableProps<T> extends SelectionProps<T> {
  // Datos
  data: T[]
  columns: ColumnConfig<T>[]
  
  // Header (NUEVO)
  header?: ViewHeader
  
  // Interacción
  onRowClick?: (item: T, index: number) => void
  
  // Ordenamiento
  sortable?: boolean
  defaultSort?: SortConfig<T>
  
  // Estilos
  className?: string
  
  // Estados
  loading?: boolean
  loadingRows?: number
  emptyState?: EmptyState
  
  // Paginación (NUEVO)
  pagination?: PaginationConfig
  
  // Callbacks
  onRefresh?: () => void
  
  // Utilidades
  getRowId?: (item: T) => string
}

export function DataTable<T>({
  data,
  columns,
  header,
  onRowClick,
  selectable = false,
  selectedItems = [],
  onSelectionChange,
  sortable = true,
  defaultSort,
  className,
  emptyState,
  loading = false,
  loadingRows = 5,
  pagination,
  onRefresh,
  getRowId = (item: any) => item.id
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(
    defaultSort || { key: null, direction: null }
  )

  // Ordenar datos
  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data
    }

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key!]
      const bValue = b[sortConfig.key!]

      if (aValue === bValue) return 0

      const comparison = aValue < bValue ? -1 : 1
      return sortConfig.direction === 'asc' ? comparison : -comparison
    })
  }, [data, sortConfig])

  // Manejar ordenamiento
  const handleSort = (key: keyof T) => {
    setSortConfig(prev => {
      if (prev.key !== key) {
        return { key, direction: 'asc' }
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' }
      }
      return { key: null, direction: null }
    })
  }

  // Manejar selección
  const isSelected = (item: T) => {
    return selectedItems.some(selected => getRowId(selected) === getRowId(item))
  }

  const toggleSelection = (item: T) => {
    if (!onSelectionChange) return

    if (isSelected(item)) {
      onSelectionChange(selectedItems.filter(selected => getRowId(selected) !== getRowId(item)))
    } else {
      onSelectionChange([...selectedItems, item])
    }
  }

  const toggleSelectAll = () => {
    if (!onSelectionChange) return

    if (selectedItems.length === data.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(data)
    }
  }

  // Obtener valor de celda
  const getCellValue = (item: T, column: ColumnConfig<T>) => {
    if (typeof column.accessor === 'function') {
      return column.accessor(item)
    }
    return item[column.accessor] as any
  }

  // Si hay header o paginación, usar ViewContainer
  if (header || pagination) {
    return (
      <ViewContainer
        header={header}
        loading={loading}
        isEmpty={data.length === 0}
        emptyState={emptyState}
        pagination={pagination}
        onRefresh={onRefresh}
        className={className}
      >
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className='w-12'>
                    <Checkbox
                      checked={selectedItems.length === data.length && data.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label='Seleccionar todos'
                    />
                  </TableHead>
                )}
                {columns.map((column) => (
                  <TableHead
                    key={column.id}
                    style={{ width: column.width }}
                    className={cn(
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.className
                    )}
                  >
                    {column.sortable && sortable ? (
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => handleSort(column.accessor as keyof T)}
                        className='-ml-3 h-8'
                      >
                        {column.header}
                        {sortConfig.key === column.accessor && sortConfig.direction === 'asc' && (
                          <ArrowUp className='ml-2 h-4 w-4' />
                        )}
                        {sortConfig.key === column.accessor && sortConfig.direction === 'desc' && (
                          <ArrowDown className='ml-2 h-4 w-4' />
                        )}
                        {sortConfig.key !== column.accessor && (
                          <ArrowUpDown className='ml-2 h-4 w-4 opacity-50' />
                        )}
                      </Button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((item, index) => (
                <TableRow
                  key={getRowId(item)}
                  className={cn(
                    onRowClick && 'cursor-pointer',
                    isSelected(item) && 'bg-muted/50'
                  )}
                  onClick={() => onRowClick?.(item, index)}
                >
                  {selectable && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected(item)}
                        onCheckedChange={() => toggleSelection(item)}
                        aria-label={`Seleccionar item ${index + 1}`}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        column.className
                      )}
                    >
                      {getCellValue(item, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ViewContainer>
    )
  }

  // Versión legacy sin ViewContainer (para compatibilidad)
  // Loading skeleton
  if (loading) {
    return (
      <Card className={className}>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                {selectable && <TableHead className='w-12' />}
                {columns.map((column) => (
                  <TableHead key={column.id} style={{ width: column.width }}>
                    <div className='h-4 bg-muted rounded w-20 animate-pulse' />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: loadingRows }).map((_, i) => (
                <TableRow key={i}>
                  {selectable && (
                    <TableCell>
                      <div className='h-4 w-4 bg-muted rounded animate-pulse' />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.id}>
                      <div className='h-4 bg-muted rounded animate-pulse' />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    )
  }

  // Empty state
  if (data.length === 0) {
    if (emptyState) {
      return <>{emptyState}</>
    }
    
    return (
      <Card className={cn('p-12', className)}>
        <div className='text-center text-muted-foreground'>
          <p>No hay datos para mostrar</p>
        </div>
      </Card>
    )
  }

  // Tabla
  return (
    <Card className={className}>
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className='w-12'>
                  <Checkbox
                    checked={selectedItems.length === data.length && data.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label='Seleccionar todos'
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  style={{ width: column.width }}
                  className={cn(
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.className
                  )}
                >
                  {column.sortable && sortable ? (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handleSort(column.accessor as keyof T)}
                      className='-ml-3 h-8'
                    >
                      {column.header}
                      {sortConfig.key === column.accessor && sortConfig.direction === 'asc' && (
                        <ArrowUp className='ml-2 h-4 w-4' />
                      )}
                      {sortConfig.key === column.accessor && sortConfig.direction === 'desc' && (
                        <ArrowDown className='ml-2 h-4 w-4' />
                      )}
                      {sortConfig.key !== column.accessor && (
                        <ArrowUpDown className='ml-2 h-4 w-4 opacity-50' />
                      )}
                    </Button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((item, index) => (
              <TableRow
                key={getRowId(item)}
                className={cn(
                  onRowClick && 'cursor-pointer',
                  isSelected(item) && 'bg-muted/50'
                )}
                onClick={() => onRowClick?.(item, index)}
              >
                {selectable && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected(item)}
                      onCheckedChange={() => toggleSelection(item)}
                      aria-label={`Seleccionar item ${index + 1}`}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.className
                    )}
                  >
                    {getCellValue(item, column)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
