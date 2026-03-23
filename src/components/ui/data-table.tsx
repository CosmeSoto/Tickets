'use client'

import React, { useState, useEffect, ReactNode, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Input } from './input'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: keyof T | string
  label: string
  render?: (item: T) => ReactNode
  sortable?: boolean
  width?: string
}

interface Filter {
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
  filters?: Filter[]
  onFiltersChange?: (filters: Record<string, string>) => void
  
  // Control de búsqueda externa
  externalSearch?: boolean // Si true, no muestra búsqueda interna
  hideInternalFilters?: boolean // Si true, oculta filtros internos
  
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
  
  // Estados vacíos
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
  searchPlaceholder = "Buscar...",
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
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)

  const onFiltersChangeRef = useRef(onFiltersChange)
  onFiltersChangeRef.current = onFiltersChange

  // Debounce para búsqueda
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Manejar cambios de filtros
  useEffect(() => {
    if (onFiltersChangeRef.current) {
      // Limpiar timeout anterior
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }

      // Crear nuevo timeout para debounce
      searchTimeoutRef.current = setTimeout(() => {
        const allFilters = { ...filterValues }
        if (searchTerm) {
          allFilters.search = searchTerm
        }
        onFiltersChangeRef.current!(allFilters)
      }, searchTerm ? 300 : 0) // 300ms debounce para búsqueda, inmediato para filtros
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [filterValues, searchTerm])

  // Función de ordenamiento
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Datos ordenados - Validación robusta
  const safeData = React.useMemo(() => {
    if (!data) {
      return []
    }
    
    if (!Array.isArray(data)) {
      console.error('DataTable - data is not an array:', data)
      return []
    }
    
    return data
  }, [data])

  const sortedData = [...safeData].sort((a, b) => {
    if (!sortConfig) return 0
    
    const aValue = (a as any)[sortConfig.key]
    const bValue = (b as any)[sortConfig.key]
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  // Limpiar filtros
  const clearFilters = () => {
    setSearchTerm('')
    setFilterValues({})
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            {title && <CardTitle>{title}</CardTitle>}
            {description && (
              <CardDescription>
                {description} ({(data || []).length} elementos)
              </CardDescription>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Botones de acción */}
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            )}
            
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            )}
            
            {onSettings && (
              <Button variant="outline" size="sm" onClick={onSettings}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
            
            {/* Filtros */}
            {filters.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
            )}
            
            {/* Cambio de vista */}
            {onViewModeChange && cardRenderer && (
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewModeChange('table')}
                  className="rounded-r-none"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewModeChange('cards')}
                  className="rounded-l-none"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {actions}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Búsqueda y filtros */}
        {!externalSearch && (
          <div className="space-y-4 mb-6">
            {/* Búsqueda */}
            {searchable && (
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder={searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {(searchTerm || Object.keys(filterValues).length > 0) && (
                  <Button variant="outline" onClick={clearFilters}>
                    Limpiar
                  </Button>
                )}
              </div>
            )}
            
            {/* Filtros avanzados */}
            {!hideInternalFilters && showFilters && filters.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              {filters.map((filter) => (
                <div key={filter.key}>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {filter.label}
                  </label>
                  {filter.type === 'select' && filter.options ? (
                    <select
                      value={filterValues[filter.key] || ''}
                      onChange={(e) => setFilterValues(prev => ({
                        ...prev,
                        [filter.key]: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm"
                    >
                      <option value="">Todos</option>
                      {filter.options.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder={filter.placeholder}
                      value={filterValues[filter.key] || ''}
                      onChange={(e) => setFilterValues(prev => ({
                        ...prev,
                        [filter.key]: e.target.value
                      }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Contenido */}
        {error ? (
          <div className="text-center py-12">
            <div className="text-red-500 mb-2">Error al cargar datos</div>
            <div className="text-muted-foreground text-sm">{error}</div>
            {onRefresh && (
              <Button variant="outline" onClick={onRefresh} className="mt-4">
                Reintentar
              </Button>
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-muted-foreground">Cargando...</span>
          </div>
        ) : sortedData.length === 0 ? (
          <div className="text-center py-12">
            {emptyState?.icon}
            <h3 className="text-lg font-medium text-foreground mb-2">
              {emptyState?.title || 'No hay datos'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {emptyState?.description || 'No se encontraron elementos'}
            </p>
            {emptyState?.action}
          </div>
        ) : viewMode === 'cards' && cardRenderer ? (
          /* Vista de tarjetas */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedData.map(item => (
              <div key={item.id}>
                {cardRenderer(item)}
              </div>
            ))}
          </div>
        ) : (
          /* Vista de tabla */
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(column => (
                    <TableHead 
                      key={String(column.key)}
                      className={cn(
                        column.width,
                        column.sortable && "cursor-pointer hover:bg-muted"
                      )}
                      onClick={() => column.sortable && handleSort(String(column.key))}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column.label}</span>
                        {column.sortable && sortConfig?.key === column.key && (
                          <span className="text-xs">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  ))}
                  {rowActions && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map(item => (
                  <TableRow 
                    key={item.id} 
                    className={cn(
                      "hover:bg-muted transition-colors",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map(column => (
                      <TableCell key={String(column.key)}>
                        {column.render 
                          ? column.render(item)
                          : String((item as any)[column.key] || '-')
                        }
                      </TableCell>
                    ))}
                    {rowActions && (
                      <TableCell 
                        className="text-right"
                        onClick={(e) => e.stopPropagation()} // Evitar propagación en acciones
                      >
                        {rowActions(item)}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Paginación */}
        {pagination && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                {pagination.total} elementos
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <select
                value={pagination.limit}
                onChange={(e) => pagination.onLimitChange(Number(e.target.value))}
                className="px-3 py-1 border border-border rounded text-sm"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <span className="text-sm whitespace-nowrap">
                {pagination.page} / {Math.ceil(pagination.total / pagination.limit)}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}