/**
 * Componente de filtros para tickets
 */

'use client'

import { Search, RefreshCw, Filter, X, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserCombobox } from '@/components/ui/user-combobox'
import { 
  STATUS_OPTIONS, 
  PRIORITY_OPTIONS, 
  DATE_FILTER_OPTIONS,
  type StatusFilter,
  type PriorityFilter,
  type DateFilter
} from '@/lib/constants/filter-options'
import { cn } from '@/lib/utils'

interface TicketFiltersProps {
  // Valores de filtros
  searchTerm: string
  statusFilter: StatusFilter
  priorityFilter: PriorityFilter
  categoryFilter: string
  assigneeFilter?: string
  dateFilter?: DateFilter
  
  // Callbacks
  setSearchTerm: (term: string) => void
  onStatusChange: (status: StatusFilter) => void
  onPriorityChange: (priority: PriorityFilter) => void
  onCategoryChange: (category: string) => void
  onAssigneeChange?: (assignee: string) => void
  onDateChange?: (date: DateFilter) => void
  onRefresh: () => void
  onClearFilters: () => void
  
  // Datos de referencia
  categories?: Array<{ id: string; name: string }>
  
  // Configuración
  variant?: 'admin' | 'technician' | 'client'
  loading?: boolean
  className?: string
  
  // Características opcionales
  showAssigneeFilter?: boolean
  showDateFilter?: boolean
  searchPlaceholder?: string
}

export function TicketFilters({
  searchTerm,
  statusFilter,
  priorityFilter,
  categoryFilter,
  assigneeFilter = 'all',
  dateFilter = 'all',
  setSearchTerm,
  onStatusChange,
  onPriorityChange,
  onCategoryChange,
  onAssigneeChange,
  onDateChange,
  onRefresh,
  onClearFilters,
  categories = [],
  variant = 'admin',
  loading = false,
  className,
  showAssigneeFilter = true,
  showDateFilter = false,
  searchPlaceholder = 'Buscar por título, descripción o cliente...'
}: TicketFiltersProps) {
  
  // Calcular filtros activos
  const activeFilters = [
    statusFilter !== 'all',
    priorityFilter !== 'all',
    categoryFilter !== 'all',
    showAssigneeFilter && assigneeFilter !== 'all',
    showDateFilter && dateFilter !== 'all',
    searchTerm.trim().length > 0
  ].filter(Boolean).length

  const hasActiveFilters = activeFilters > 0

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          
          {/* Barra superior: Búsqueda y acciones */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="flex gap-2 shrink-0">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearFilters}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Limpiar
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Actualizar
              </Button>
            </div>
          </div>

          {/* Filtros principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Estado */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Estado</label>
              <Select value={statusFilter} onValueChange={onStatusChange} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prioridad */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Prioridad</label>
              <Select value={priorityFilter} onValueChange={onPriorityChange} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categoría */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Categoría</label>
              <Select value={categoryFilter} onValueChange={onCategoryChange} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Técnico asignado (solo para admin) */}
            {showAssigneeFilter && onAssigneeChange && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Asignado a</label>
                <UserCombobox
                  value={assigneeFilter === 'all' ? '' : assigneeFilter}
                  onValueChange={(value) => onAssigneeChange(value || 'all')}
                  role="TECHNICIAN"
                  placeholder="Todos"
                  allowClear
                  disabled={loading}
                />
              </div>
            )}

            {/* Filtro de fecha (solo para técnicos) */}
            {showDateFilter && onDateChange && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Fecha
                </label>
                <Select value={dateFilter} onValueChange={onDateChange} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Indicador de filtros activos */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="text-xs">
                {activeFilters} filtro{activeFilters !== 1 ? 's' : ''} activo{activeFilters !== 1 ? 's' : ''}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}