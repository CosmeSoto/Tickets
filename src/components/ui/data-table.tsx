'use client'

import React, { useState, useEffect, ReactNode, useRef, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Input } from './input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'
import {
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  Download,
  Settings,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: keyof T | string
  label: string
  render?: (item: T) => ReactNode
  sortable?: boolean
  width?: string
}

interface FilterDef {
  key: string
  label: string
  type: 'select' | 'input' | 'date'
  options?: { value: string; label: string }[]
  placeholder?: string
}

interface DataTableProps<T> {
  title?: string
  description?: string
  data: T[] | null | undefined
  columns: Column<T>[]
  loading?: boolean
  error?: string | null

  // Filtros y búsqueda
  searchable?: boolean
  searchPlaceholder?: string
  filters?: FilterDef[]
  onFiltersChange?: (filters: Record<string, string>) => void

  // Control de búsqueda externa
  externalSearch?: boolean
  hideInternalFilters?: boolean

  // Paginación
  pagination?: {
    page: number
    limit: number
    total: number
    onPageChange: (page: number) => void
    onLimitChange: (limit: number) => void
  }

  // Acciones
  actions?: ReactNode
  rowActions?: (item: T) => ReactNode
  onRowClick?: (item: T) => void

  // Vista
  viewMode?: 'table' | 'cards'
  onViewModeChange?: (mode: 'table' | 'cards') => void
  cardRenderer?: (item: T) => ReactNode

  // Callbacks
  onRefresh?: () => void
  onExport?: () => void
  onSettings?: () => void

  // Estado vacío
  emptyState?: {
    icon?: ReactNode
    title: string
    description: string
    action?: ReactNode
  }
}

export function DataTable<T extends { id: string }>({
  title,
  description,
  data,
  columns,
  loading = false,
  error = null,
  searchable = true,
  searchPlaceholder = 'Buscar...',
  filters = [],
  onFiltersChange,
  externalSearch = false,
  hideInternalFilters = false,
  pagination,
  actions,
  rowActions,
  onRowClick,
  viewMode = 'table',
  onViewModeChange,
  cardRenderer,
  onRefresh,
  onExport,
  onSettings,
  emptyState,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    null
  )

  const onFiltersChangeRef = useRef(onFiltersChange)
  onFiltersChangeRef.current = onFiltersChange
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!onFiltersChangeRef.current) return
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(
      () => {
        const allFilters = { ...filterValues }
        if (searchTerm) allFilters.search = searchTerm
        onFiltersChangeRef.current!(allFilters)
      },
      searchTerm ? 300 : 0
    )
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [filterValues, searchTerm])

  const handleSort = (key: string) => {
    setSortConfig(prev =>
      prev?.key === key && prev.direction === 'asc'
        ? { key, direction: 'desc' }
        : { key, direction: 'asc' }
    )
  }

  const safeData = useMemo(() => {
    if (!data || !Array.isArray(data)) return []
    return data
  }, [data])

  const sortedData = useMemo(() => {
    if (!sortConfig) return safeData
    return [...safeData].sort((a, b) => {
      const aVal = (a as any)[sortConfig.key]
      const bVal = (b as any)[sortConfig.key]
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [safeData, sortConfig])

  const clearFilters = () => {
    setSearchTerm('')
    setFilterValues({})
  }

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 1

  return (
    <Card>
      {/* ── Header ── */}
      {(title ||
        description ||
        actions ||
        onRefresh ||
        onExport ||
        onSettings ||
        onViewModeChange) && (
        <CardHeader className='pb-4'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
            <div className='min-w-0'>
              {title && <CardTitle className='text-base'>{title}</CardTitle>}
              {description && <CardDescription className='mt-0.5'>{description}</CardDescription>}
            </div>
            <div className='flex flex-wrap items-center gap-2 flex-shrink-0'>
              {onRefresh && (
                <Button variant='outline' size='sm' onClick={onRefresh} disabled={loading}>
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </Button>
              )}
              {onExport && (
                <Button variant='outline' size='sm' onClick={onExport}>
                  <Download className='h-4 w-4 mr-2' />
                  Exportar
                </Button>
              )}
              {onSettings && (
                <Button variant='outline' size='sm' onClick={onSettings}>
                  <Settings className='h-4 w-4' />
                </Button>
              )}
              {filters.length > 0 && (
                <Button variant='outline' size='sm' onClick={() => setShowFilters(v => !v)}>
                  <Filter className='h-4 w-4 mr-2' />
                  Filtros
                </Button>
              )}
              {onViewModeChange && cardRenderer && (
                <div className='flex items-center border rounded-md overflow-hidden'>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size='sm'
                    onClick={() => onViewModeChange('table')}
                    className='rounded-none border-0'
                  >
                    <List className='h-4 w-4' />
                  </Button>
                  <Button
                    variant={viewMode === 'cards' ? 'default' : 'ghost'}
                    size='sm'
                    onClick={() => onViewModeChange('cards')}
                    className='rounded-none border-0 border-l'
                  >
                    <Grid3X3 className='h-4 w-4' />
                  </Button>
                </div>
              )}
              {actions}
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className={cn(!title && !description && 'pt-6')}>
        {/* ── Búsqueda interna ── */}
        {!externalSearch && (searchable || (!hideInternalFilters && filters.length > 0)) && (
          <div className='space-y-3 mb-4'>
            {searchable && (
              <div className='flex items-center gap-2'>
                <div className='relative flex-1'>
                  <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4' />
                  <Input
                    placeholder={searchPlaceholder}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className='pl-9'
                  />
                </div>
                {(searchTerm || Object.keys(filterValues).length > 0) && (
                  <Button variant='outline' size='sm' onClick={clearFilters}>
                    Limpiar
                  </Button>
                )}
              </div>
            )}
            {!hideInternalFilters && showFilters && filters.length > 0 && (
              <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg border'>
                {filters.map(filter => (
                  <div key={filter.key} className='space-y-1'>
                    <label className='text-xs font-medium text-muted-foreground'>
                      {filter.label}
                    </label>
                    {filter.type === 'select' && filter.options ? (
                      <Select
                        value={filterValues[filter.key] || ''}
                        onValueChange={v => setFilterValues(prev => ({ ...prev, [filter.key]: v }))}
                      >
                        <SelectTrigger className='h-8 text-sm'>
                          <SelectValue placeholder='Todos' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=''>Todos</SelectItem>
                          {filter.options.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder={filter.placeholder}
                        value={filterValues[filter.key] || ''}
                        onChange={e =>
                          setFilterValues(prev => ({ ...prev, [filter.key]: e.target.value }))
                        }
                        className='h-8 text-sm'
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Contenido ── */}
        {error ? (
          <div className='flex flex-col items-center justify-center py-12 text-center gap-3'>
            <AlertCircle className='h-8 w-8 text-destructive' />
            <div>
              <p className='font-medium text-destructive'>Error al cargar datos</p>
              <p className='text-sm text-muted-foreground mt-1'>{error}</p>
            </div>
            {onRefresh && (
              <Button variant='outline' size='sm' onClick={onRefresh}>
                <RefreshCw className='h-4 w-4 mr-2' />
                Reintentar
              </Button>
            )}
          </div>
        ) : loading ? (
          <div className='flex items-center justify-center py-12 gap-2 text-muted-foreground'>
            <RefreshCw className='h-5 w-5 animate-spin' />
            <span className='text-sm'>Cargando...</span>
          </div>
        ) : sortedData.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12 text-center'>
            {emptyState?.icon}
            <h3 className='text-base font-medium mt-2'>{emptyState?.title ?? 'Sin resultados'}</h3>
            <p className='text-sm text-muted-foreground mt-1 max-w-sm'>
              {emptyState?.description ?? 'No se encontraron elementos'}
            </p>
            {emptyState?.action && <div className='mt-4'>{emptyState.action}</div>}
          </div>
        ) : viewMode === 'cards' && cardRenderer ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {sortedData.map(item => (
              <div key={item.id}>{cardRenderer(item)}</div>
            ))}
          </div>
        ) : (
          <div className='rounded-md border overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(col => (
                    <TableHead
                      key={String(col.key)}
                      style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                      className={cn(col.sortable && 'cursor-pointer select-none')}
                      onClick={() => col.sortable && handleSort(String(col.key))}
                    >
                      <div className='flex items-center gap-1'>
                        <span>{col.label}</span>
                        {col.sortable &&
                          (sortConfig?.key === String(col.key) ? (
                            sortConfig.direction === 'asc' ? (
                              <ArrowUp className='h-3.5 w-3.5 text-foreground' />
                            ) : (
                              <ArrowDown className='h-3.5 w-3.5 text-foreground' />
                            )
                          ) : (
                            <ArrowUpDown className='h-3.5 w-3.5 text-muted-foreground/50' />
                          ))}
                      </div>
                    </TableHead>
                  ))}
                  {rowActions && <TableHead className='w-[70px] text-right'>Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map(item => (
                  <TableRow
                    key={item.id}
                    className={cn(onRowClick && 'cursor-pointer')}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map(col => (
                      <TableCell key={String(col.key)}>
                        {col.render ? col.render(item) : String((item as any)[col.key] ?? '—')}
                      </TableCell>
                    ))}
                    {rowActions && (
                      <TableCell className='text-right' onClick={e => e.stopPropagation()}>
                        {rowActions(item)}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ── Paginación ── */}
        {pagination && !loading && sortedData.length > 0 && (
          <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4 pt-4 border-t'>
            <p className='text-sm text-muted-foreground'>
              {pagination.total === 0
                ? 'Sin resultados'
                : `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} de ${pagination.total}`}
            </p>
            <div className='flex items-center gap-2'>
              <Select
                value={String(pagination.limit)}
                onValueChange={v => pagination.onLimitChange(Number(v))}
              >
                <SelectTrigger className='h-8 w-[70px] text-sm'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map(n => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant='outline'
                size='sm'
                className='h-8 w-8 p-0'
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <span className='text-sm text-muted-foreground tabular-nums whitespace-nowrap'>
                {pagination.page} / {totalPages}
              </span>
              <Button
                variant='outline'
                size='sm'
                className='h-8 w-8 p-0'
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= totalPages}
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
