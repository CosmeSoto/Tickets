/**
 * Tabla de datos unificada con diseño simétrico y funcionalidad específica por rol
 * Optimizada para performance y consistencia visual
 */

'use client'

import { useState, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Tipos base
export interface ColumnConfig<T> {
  key: keyof T | string
  header: string
  width?: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  className?: string
  render?: (item: T, value: any) => React.ReactNode
  accessor?: (item: T) => any
}

export interface FilterConfig {
  type: 'search' | 'select' | 'dateRange' | 'multiSelect'
  key: string
  label: string
  options?: Array<{ value: string; label: string; color?: string }> | string
  placeholder?: string
  multiple?: boolean
  searchFields?: string[]
}

export interface ActionConfig<T> {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: (item: T) => void
  disabled?: (item: T) => boolean
  variant?: 'default' | 'destructive' | 'outline'
  show?: (item: T) => boolean
}

export interface MassActionConfig<T> {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: (items: T[]) => Promise<void>
  disabled?: (items: T[]) => boolean
  variant?: 'default' | 'destructive' | 'outline'
  confirmMessage?: string
}

export interface PaginationConfig {
  page: number
  limit: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onLimitChange?: (limit: number) => void
}

export interface DataTableAdvancedProps<T> {
  // Datos
  data: T[]
  columns: ColumnConfig<T>[]

  // Identificación
  getRowId?: (item: T) => string

  // Header
  title?: string
  description?: string

  // Filtros y búsqueda
  filters?: FilterConfig[]
  searchConfig?: {
    fields: string[]
    placeholder?: string
    debounceMs?: number
  }

  // Paginación
  pagination?: PaginationConfig

  // Interacción
  onRowClick?: (item: T) => void
  selectable?: boolean
  selectedItems?: T[]
  onSelectionChange?: (items: T[]) => void

  // Acciones
  actions?: ActionConfig<T>[]
  massActions?: MassActionConfig<T>[]

  // Estados
  loading?: boolean
  error?: string | null

  // Ordenamiento
  sortable?: boolean
  defaultSort?: { key: keyof T; direction: 'asc' | 'desc' }

  // Rol-based
  userRole?: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'

  // Estilos y variantes
  variant?: 'default' | 'detailed'
  height?: number
  className?: string

  // Callbacks
  onRefresh?: () => void
  onFiltersChange?: (filters: Record<string, any>) => void
  onSearchChange?: (search: string) => void

  // Configuración adicional
  emptyMessage?: string
  showStats?: boolean
  exportable?: boolean
}

// Temas por rol
const ROLE_THEMES = {
  ADMIN: {
    primary: 'blue',
    border: 'border-l-4 border-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    text: 'text-blue-700 dark:text-blue-300',
    accent: 'text-blue-600',
  },
  TECHNICIAN: {
    primary: 'green',
    border: 'border-l-4 border-green-500',
    bg: 'bg-green-50 dark:bg-green-950/50',
    text: 'text-green-700 dark:text-green-300',
    accent: 'text-green-600',
  },
  CLIENT: {
    primary: 'purple',
    border: 'border-l-4 border-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950/50',
    text: 'text-purple-700 dark:text-purple-300',
    accent: 'text-purple-600',
  },
}

export function DataTableAdvanced<T>({
  data,
  columns,
  getRowId = (item: any) => item.id,
  title,
  description,
  filters = [],
  searchConfig,
  pagination,
  onRowClick,
  selectable = false,
  selectedItems = [],
  onSelectionChange,
  actions = [],
  massActions = [],
  loading = false,
  error = null,
  sortable = true,
  defaultSort,
  userRole = 'CLIENT',
  variant = 'default',
  height,
  className,
  onRefresh,
  onFiltersChange,
  onSearchChange,
  emptyMessage = 'No hay datos para mostrar',
  showStats = false,
  exportable = false,
}: DataTableAdvancedProps<T>) {
  const { data: session } = useSession()
  const theme = ROLE_THEMES[userRole]

  // Estados locales
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | null
    direction: 'asc' | 'desc' | null
  }>(defaultSort || { key: null, direction: null })
  const [currentFilters, setCurrentFilters] = useState<Record<string, any>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [isPerformingMassAction, setIsPerformingMassAction] = useState(false)

  // Datos ordenados y filtrados
  const processedData = useMemo(() => {
    let result = [...data]

    // Aplicar búsqueda
    if (searchTerm && searchConfig?.fields) {
      const searchLower = searchTerm.toLowerCase()
      result = result.filter(item =>
        searchConfig.fields.some(field => {
          const value = (item as any)[field]
          return value && value.toString().toLowerCase().includes(searchLower)
        })
      )
    }

    // Aplicar ordenamiento
    if (sortConfig.key && sortConfig.direction) {
      const PRIORITY_ORDER: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
      const STATUS_ORDER: Record<string, number> = {
        OPEN: 4,
        IN_PROGRESS: 3,
        RESOLVED: 2,
        CLOSED: 1,
      }
      const dir = sortConfig.direction === 'asc' ? 1 : -1

      // Buscar el accessor de la columna activa para sort correcto en campos anidados
      const sortColumn = columns.find(c => c.key === sortConfig.key)

      result.sort((a, b) => {
        // Usar accessor si existe (para campos anidados como _count.tickets)
        const aValue = sortColumn?.accessor ? sortColumn.accessor(a) : (a as any)[sortConfig.key!]
        const bValue = sortColumn?.accessor ? sortColumn.accessor(b) : (b as any)[sortConfig.key!]

        if (sortConfig.key === 'priority')
          return ((PRIORITY_ORDER[aValue] ?? 0) - (PRIORITY_ORDER[bValue] ?? 0)) * dir
        if (sortConfig.key === 'status')
          return ((STATUS_ORDER[aValue] ?? 0) - (STATUS_ORDER[bValue] ?? 0)) * dir
        if (aValue == null) return 1
        if (bValue == null) return -1
        if (typeof aValue === 'string')
          return aValue.localeCompare(bValue, 'es', { sensitivity: 'base' }) * dir
        return (aValue < bValue ? -1 : aValue > bValue ? 1 : 0) * dir
      })
    }

    return result
  }, [data, searchTerm, searchConfig, sortConfig])

  // Manejar ordenamiento
  const handleSort = useCallback((key: keyof T) => {
    setSortConfig(prev => {
      if (prev.key !== key) {
        return { key, direction: 'asc' }
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' }
      }
      return { key: null, direction: null }
    })
  }, [])

  // Manejar selección
  const isSelected = useCallback(
    (item: T) => {
      return selectedItems.some(selected => getRowId(selected) === getRowId(item))
    },
    [selectedItems, getRowId]
  )

  const toggleSelection = useCallback(
    (item: T) => {
      if (!onSelectionChange) return

      if (isSelected(item)) {
        onSelectionChange(selectedItems.filter(selected => getRowId(selected) !== getRowId(item)))
      } else {
        onSelectionChange([...selectedItems, item])
      }
    },
    [selectedItems, onSelectionChange, isSelected, getRowId]
  )

  const toggleSelectAll = useCallback(() => {
    if (!onSelectionChange) return

    if (selectedItems.length === processedData.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(processedData)
    }
  }, [selectedItems.length, processedData, onSelectionChange])

  // Manejar acciones masivas
  const handleMassAction = useCallback(
    async (action: MassActionConfig<T>) => {
      if (selectedItems.length === 0) return

      setIsPerformingMassAction(true)
      try {
        await action.onClick(selectedItems)
        onSelectionChange?.([])
      } catch (error) {
        console.error('Error executing mass action:', error)
      } finally {
        setIsPerformingMassAction(false)
      }
    },
    [selectedItems, onSelectionChange]
  )

  // Obtener valor de celda
  const getCellValue = useCallback((item: T, column: ColumnConfig<T>) => {
    if (column.render) {
      const value = column.accessor ? column.accessor(item) : (item as any)[column.key]
      return column.render(item, value)
    }

    if (column.accessor) {
      return column.accessor(item)
    }

    return (item as any)[column.key]
  }, [])

  const isAllSelected = processedData.length > 0 && selectedItems.length === processedData.length
  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < processedData.length

  return (
    <Card className={cn('overflow-hidden', theme.border, className)} style={{ height }}>
      {(title || description) && (
        <CardHeader className='pb-4'>
          <div className='flex items-center justify-between'>
            <div>
              {title && <CardTitle className='flex items-center space-x-2'>{title}</CardTitle>}
              {description && (
                <CardDescription className='mt-1'>
                  {description}
                  {pagination && ` • ${pagination.total} elementos total`}
                </CardDescription>
              )}
            </div>
            <div className='flex items-center space-x-2'>
              {exportable && (
                <Button variant='outline' size='sm'>
                  Exportar
                </Button>
              )}
              {onRefresh && (
                <Button variant='outline' size='sm' onClick={onRefresh} disabled={loading}>
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className='p-0'>
        {/* Barra de acciones masivas */}
        {selectable && selectedItems.length > 0 && massActions.length > 0 && (
          <div className={cn('flex items-center justify-between p-4 border-b', theme.bg)}>
            <div className='flex items-center space-x-3'>
              <span className={cn('text-sm font-medium', theme.text)}>
                {selectedItems.length} elemento{selectedItems.length > 1 ? 's' : ''} seleccionado
                {selectedItems.length > 1 ? 's' : ''}
              </span>
              <Button
                variant='outline'
                size='sm'
                onClick={() => onSelectionChange?.([])}
                disabled={isPerformingMassAction}
              >
                Limpiar selección
              </Button>
            </div>
            <div className='flex items-center space-x-2'>
              {massActions.map(action => {
                const Icon = action.icon
                return (
                  <Button
                    key={action.key}
                    variant={action.variant || 'outline'}
                    size='sm'
                    onClick={() => handleMassAction(action)}
                    disabled={isPerformingMassAction || action.disabled?.(selectedItems)}
                    className='flex items-center space-x-1'
                  >
                    {Icon && <Icon className='h-4 w-4' />}
                    <span className='hidden sm:inline'>{action.label}</span>
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className='w-12'>
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label='Seleccionar todos'
                      {...(isIndeterminate ? { 'data-indeterminate': true } : {})}
                    />
                  </TableHead>
                )}
                {columns.map(column => (
                  <TableHead
                    key={column.key.toString()}
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
                        onClick={() => handleSort(column.key as keyof T)}
                        className='-ml-3 h-8'
                      >
                        {column.header}
                        {sortConfig.key === column.key && sortConfig.direction === 'asc' && (
                          <ArrowUp className='ml-2 h-4 w-4' />
                        )}
                        {sortConfig.key === column.key && sortConfig.direction === 'desc' && (
                          <ArrowDown className='ml-2 h-4 w-4' />
                        )}
                        {sortConfig.key !== column.key && (
                          <ArrowUpDown className='ml-2 h-4 w-4 opacity-50' />
                        )}
                      </Button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                ))}
                {actions.length > 0 && <TableHead className='text-right w-20'>Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                    className='text-center py-8'
                  >
                    <div className='flex items-center justify-center'>
                      <RefreshCw className='h-6 w-6 animate-spin mr-2' />
                      <div>
                        <div className='font-medium'>Cargando datos...</div>
                        <div className='text-sm text-muted-foreground mt-1'>
                          {searchTerm
                            ? `Buscando "${searchTerm}"`
                            : 'Obteniendo información del servidor'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                    className='text-center py-8'
                  >
                    <div className='flex flex-col items-center space-y-3'>
                      <div className='text-red-500 font-medium'>Error al cargar datos</div>
                      <div className='text-sm text-muted-foreground max-w-md text-center'>
                        {error}
                      </div>
                      {onRefresh && (
                        <Button variant='outline' size='sm' onClick={onRefresh} className='mt-2'>
                          <RefreshCw className='h-4 w-4 mr-2' />
                          Reintentar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : processedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                    className='text-center py-8'
                  >
                    <div className='flex flex-col items-center space-y-2'>
                      <div className='text-muted-foreground font-medium'>{emptyMessage}</div>
                      {(searchTerm || Object.keys(currentFilters).length > 0) && (
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => {
                            setSearchTerm('')
                            setCurrentFilters({})
                            onSearchChange?.('')
                            onFiltersChange?.({})
                          }}
                          className='mt-2'
                        >
                          Limpiar filtros
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                processedData.map(item => (
                  <TableRow
                    key={getRowId(item)}
                    className={cn(
                      'hover:bg-muted/50 transition-colors',
                      onRowClick && 'cursor-pointer',
                      isSelected(item) && 'bg-muted/50'
                    )}
                    onClick={() => onRowClick?.(item)}
                  >
                    {selectable && (
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected(item)}
                          onCheckedChange={() => toggleSelection(item)}
                          aria-label={`Seleccionar elemento ${getRowId(item)}`}
                        />
                      </TableCell>
                    )}
                    {columns.map(column => (
                      <TableCell
                        key={column.key.toString()}
                        className={cn(
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right',
                          column.className
                        )}
                      >
                        {getCellValue(item, column)}
                      </TableCell>
                    ))}
                    {actions.length > 0 && (
                      <TableCell className='text-right' onClick={e => e.stopPropagation()}>
                        <div className='flex items-center justify-end gap-0.5'>
                          {actions
                            .filter(action => !action.show || action.show(item))
                            .map(action => {
                              const Icon = action.icon
                              return (
                                <Button
                                  key={action.key}
                                  variant='ghost'
                                  size='sm'
                                  className={cn(
                                    'h-8 w-8 p-0',
                                    action.variant === 'destructive'
                                      ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                  )}
                                  onClick={() => action.onClick(item)}
                                  disabled={action.disabled?.(item)}
                                  title={action.label}
                                >
                                  {Icon && <Icon className='h-4 w-4' />}
                                </Button>
                              )
                            })}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginación */}
        {pagination && pagination.totalPages > 1 && !loading && !error && (
          <div className='flex flex-col sm:flex-row items-center justify-between p-4 border-t gap-4'>
            <div className='text-sm text-muted-foreground'>
              {pagination.total > 0 ? (
                <>
                  Mostrando {(pagination.page - 1) * pagination.limit + 1} a{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                  {pagination.total} elementos
                  {(searchTerm || Object.keys(currentFilters).length > 0) && (
                    <span className={cn('ml-1', theme.accent)}>(filtrados)</span>
                  )}
                </>
              ) : (
                'No hay elementos para mostrar'
              )}
            </div>
            <div className='flex items-center space-x-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Anterior
              </Button>

              {/* Paginación inteligente */}
              <div className='flex items-center space-x-1'>
                {(() => {
                  const pages = []
                  const maxVisiblePages = 5
                  let startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2))
                  const endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1)

                  if (endPage - startPage + 1 < maxVisiblePages) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1)
                  }

                  if (startPage > 1) {
                    pages.push(
                      <Button
                        key={1}
                        variant='outline'
                        size='sm'
                        onClick={() => pagination.onPageChange(1)}
                      >
                        1
                      </Button>
                    )
                    if (startPage > 2) {
                      pages.push(
                        <span key='ellipsis1' className='px-2 text-muted-foreground'>
                          ...
                        </span>
                      )
                    }
                  }

                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <Button
                        key={i}
                        variant={pagination.page === i ? 'default' : 'outline'}
                        size='sm'
                        onClick={() => pagination.onPageChange(i)}
                      >
                        {i}
                      </Button>
                    )
                  }

                  if (endPage < pagination.totalPages) {
                    if (endPage < pagination.totalPages - 1) {
                      pages.push(
                        <span key='ellipsis2' className='px-2 text-muted-foreground'>
                          ...
                        </span>
                      )
                    }
                    pages.push(
                      <Button
                        key={pagination.totalPages}
                        variant='outline'
                        size='sm'
                        onClick={() => pagination.onPageChange(pagination.totalPages)}
                      >
                        {pagination.totalPages}
                      </Button>
                    )
                  }

                  return pages
                })()}
              </div>

              <Button
                variant='outline'
                size='sm'
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
