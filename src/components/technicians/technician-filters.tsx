/**
 * Componente unificado de filtros para técnicos
 * Maneja tanto filtros de técnicos como filtros de tickets de técnicos
 * Elimina duplicación entre technician-filters y technician-ticket-filters
 */

'use client'

import { Search, RefreshCw, Filter, X, Users, Building, Calendar } from 'lucide-react'
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
import { 
  TECHNICIAN_STATUS_FILTER_OPTIONS,
  TECHNICIAN_STATUS_ICONS,
  getTechnicianStatusIcon,
  type TechnicianStatus
} from '@/lib/constants/technician-constants'
import { 
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  DATE_FILTER_OPTIONS
} from '@/lib/constants/filter-options'
import { cn } from '@/lib/utils'

interface Department {
  id: string
  name: string
  color: string
}

interface Category {
  id: string
  name: string
}

// Props para filtros de técnicos
interface TechnicianFiltersProps {
  mode: 'technicians'
  searchTerm: string
  setSearchTerm: (term: string) => void
  statusFilter: TechnicianStatus
  setStatusFilter: (status: TechnicianStatus) => void
  departmentFilter: string
  setDepartmentFilter: (department: string) => void
  loading: boolean
  onRefresh: () => void
  onClearFilters: () => void
  departments?: Department[]
  className?: string
  showDepartmentFilter?: boolean
  showStatusButtons?: boolean
  searchPlaceholder?: string
}

// Props para filtros de tickets de técnicos
interface TechnicianTicketFiltersProps {
  mode: 'tickets'
  searchTerm: string
  setSearchTerm: (term: string) => void
  statusFilter: string
  setStatusFilter: (status: string) => void
  priorityFilter: string
  setPriorityFilter: (priority: string) => void
  categoryFilter: string
  setCategoryFilter: (category: string) => void
  dateFilter: string
  setDateFilter: (date: string) => void
  loading: boolean
  onRefresh: () => void
  onClearFilters: () => void
  categories?: Category[]
  className?: string
  searchPlaceholder?: string
}

type UnifiedTechnicianFiltersProps = TechnicianFiltersProps | TechnicianTicketFiltersProps

export function TechnicianFilters(props: UnifiedTechnicianFiltersProps) {
  const {
    mode,
    searchTerm,
    setSearchTerm,
    loading,
    onRefresh,
    onClearFilters,
    className,
    searchPlaceholder
  } = props

  // Calcular filtros activos según el modo
  const activeFiltersCount = mode === 'technicians' 
    ? [
        (props as TechnicianFiltersProps).statusFilter !== 'all',
        (props as TechnicianFiltersProps).departmentFilter !== 'all',
        searchTerm.trim().length > 0
      ].filter(Boolean).length
    : [
        (props as TechnicianTicketFiltersProps).statusFilter !== 'all',
        (props as TechnicianTicketFiltersProps).priorityFilter !== 'all',
        (props as TechnicianTicketFiltersProps).categoryFilter !== 'all',
        (props as TechnicianTicketFiltersProps).dateFilter !== 'all',
        searchTerm.length > 0
      ].filter(Boolean).length

  const hasActiveFilters = activeFiltersCount > 0

  // Placeholder por defecto según el modo
  const defaultPlaceholder = mode === 'technicians' 
    ? 'Buscar por nombre, email o teléfono...'
    : 'Buscar por título, descripción o cliente...'

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          
          {/* Búsqueda y acciones */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={searchPlaceholder || defaultPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
            
            <div className="flex gap-2 shrink-0">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearFilters}
                  disabled={loading}
                  className="whitespace-nowrap"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpiar {activeFiltersCount > 0 && `(${activeFiltersCount})`}
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
                {loading ? 'Cargando...' : 'Actualizar'}
              </Button>
            </div>
          </div>

          {/* Botones rápidos según el modo */}
          {mode === 'technicians' ? (
            // Botones rápidos para técnicos
            (props as TechnicianFiltersProps).showStatusButtons !== false && (
              <div className="flex flex-wrap gap-2">
                {TECHNICIAN_STATUS_FILTER_OPTIONS.map((option) => {
                  const Icon = getTechnicianStatusIcon(option.value)
                  const isActive = (props as TechnicianFiltersProps).statusFilter === option.value
                  
                  return (
                    <Button
                      key={option.value}
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => (props as TechnicianFiltersProps).setStatusFilter(option.value as TechnicianStatus)}
                      disabled={loading}
                    >
                      <Icon className="h-4 w-4 mr-1" />
                      {option.label}
                    </Button>
                  )
                })}
              </div>
            )
          ) : (
            // Botones rápidos para tickets
            <div className="flex flex-wrap gap-2">
              <Button
                variant={(props as TechnicianTicketFiltersProps).statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => (props as TechnicianTicketFiltersProps).setStatusFilter('all')}
                disabled={loading}
              >
                Todos
              </Button>
              <Button
                variant={(props as TechnicianTicketFiltersProps).statusFilter === 'OPEN' ? 'default' : 'outline'}
                size="sm"
                onClick={() => (props as TechnicianTicketFiltersProps).setStatusFilter('OPEN')}
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
                disabled={loading}
              >
                <span className="w-2 h-2 rounded-full bg-orange-500 mr-2"></span>
                Abiertos
              </Button>
              <Button
                variant={(props as TechnicianTicketFiltersProps).statusFilter === 'IN_PROGRESS' ? 'default' : 'outline'}
                size="sm"
                onClick={() => (props as TechnicianTicketFiltersProps).setStatusFilter('IN_PROGRESS')}
                className="border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                disabled={loading}
              >
                <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
                En Progreso
              </Button>
              <Button
                variant={(props as TechnicianTicketFiltersProps).statusFilter === 'RESOLVED' ? 'default' : 'outline'}
                size="sm"
                onClick={() => (props as TechnicianTicketFiltersProps).setStatusFilter('RESOLVED')}
                className="border-green-200 text-green-700 hover:bg-green-50"
                disabled={loading}
              >
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                Resueltos
              </Button>
            </div>
          )}

          {/* Filtros avanzados según el modo */}
          {mode === 'technicians' ? (
            // Filtros para técnicos
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Estado */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Estado</label>
                <Select 
                  value={(props as TechnicianFiltersProps).statusFilter} 
                  onValueChange={(value) => (props as TechnicianFiltersProps).setStatusFilter(value as TechnicianStatus)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TECHNICIAN_STATUS_FILTER_OPTIONS.map((option) => {
                      const Icon = getTechnicianStatusIcon(option.value)
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Departamento */}
              {(props as TechnicianFiltersProps).showDepartmentFilter !== false && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Departamento</label>
                  <Select 
                    value={(props as TechnicianFiltersProps).departmentFilter} 
                    onValueChange={(props as TechnicianFiltersProps).setDepartmentFilter}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Todos los departamentos
                        </div>
                      </SelectItem>
                      {((props as TechnicianFiltersProps).departments || []).map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: department.color }}
                            />
                            {department.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ) : (
            // Filtros para tickets
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Prioridad */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Prioridad
                </label>
                <Select 
                  value={(props as TechnicianTicketFiltersProps).priorityFilter} 
                  onValueChange={(props as TechnicianTicketFiltersProps).setPriorityFilter} 
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center space-x-2">
                          {option.value !== 'all' && (
                            <div
                              className={`w-3 h-3 rounded-full ${
                                option.value === 'URGENT'
                                  ? 'bg-red-500'
                                  : option.value === 'HIGH'
                                    ? 'bg-orange-500'
                                    : option.value === 'MEDIUM'
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                              }`}
                            />
                          )}
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Categoría */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Categoría
                </label>
                <Select 
                  value={(props as TechnicianTicketFiltersProps).categoryFilter} 
                  onValueChange={(props as TechnicianTicketFiltersProps).setCategoryFilter} 
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {((props as TechnicianTicketFiltersProps).categories || []).map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Fecha de creación
                </label>
                <Select 
                  value={(props as TechnicianTicketFiltersProps).dateFilter} 
                  onValueChange={(props as TechnicianTicketFiltersProps).setDateFilter} 
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las fechas" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FILTER_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Indicador de filtros activos */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {mode === 'technicians' ? (
                <Badge variant="secondary" className="text-xs">
                  {activeFiltersCount} filtro{activeFiltersCount !== 1 ? 's' : ''} activo{activeFiltersCount !== 1 ? 's' : ''}
                </Badge>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">Filtros activos:</span>
                  <div className="flex flex-wrap gap-2">
                    {(props as TechnicianTicketFiltersProps).statusFilter !== 'all' && (
                      <Badge variant="secondary" className="text-xs">
                        Estado: {STATUS_OPTIONS.find(o => o.value === (props as TechnicianTicketFiltersProps).statusFilter)?.label}
                      </Badge>
                    )}
                    {(props as TechnicianTicketFiltersProps).priorityFilter !== 'all' && (
                      <Badge variant="secondary" className="text-xs">
                        Prioridad: {PRIORITY_OPTIONS.find(o => o.value === (props as TechnicianTicketFiltersProps).priorityFilter)?.label}
                      </Badge>
                    )}
                    {(props as TechnicianTicketFiltersProps).categoryFilter !== 'all' && (
                      <Badge variant="secondary" className="text-xs">
                        Categoría: {((props as TechnicianTicketFiltersProps).categories || []).find(c => c.id === (props as TechnicianTicketFiltersProps).categoryFilter)?.name}
                      </Badge>
                    )}
                    {(props as TechnicianTicketFiltersProps).dateFilter !== 'all' && (
                      <Badge variant="secondary" className="text-xs">
                        Fecha: {DATE_FILTER_OPTIONS.find(o => o.value === (props as TechnicianTicketFiltersProps).dateFilter)?.label}
                      </Badge>
                    )}
                    {searchTerm && (
                      <Badge variant="secondary" className="text-xs">
                        Búsqueda: "{searchTerm}"
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}