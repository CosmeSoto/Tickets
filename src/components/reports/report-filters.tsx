'use client'

import { useState } from 'react'
import { Calendar, Filter, RefreshCw, RotateCcw, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { type ReportFilters, ReferenceData } from '@/hooks/use-reports'

interface ReportFiltersProps {
  filters: ReportFilters
  onFiltersChange: (filters: Partial<ReportFilters>) => void
  onApplyFilters: () => void
  onResetFilters: () => void
  loading: boolean
  referenceData: ReferenceData
  hasActiveFilters: boolean
  filterCount: number
}

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Baja', color: 'bg-green-100 text-green-800' },
  { value: 'MEDIUM', label: 'Media', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'HIGH', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'URGENT', label: 'Urgente', color: 'bg-red-100 text-red-800' },
]

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Abierto', color: 'bg-blue-100 text-blue-800' },
  { value: 'IN_PROGRESS', label: 'En Progreso', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'RESOLVED', label: 'Resuelto', color: 'bg-green-100 text-green-800' },
  { value: 'CLOSED', label: 'Cerrado', color: 'bg-muted text-foreground' },
]

export function ReportFilters({
  filters,
  onFiltersChange,
  onApplyFilters,
  onResetFilters,
  loading,
  referenceData,
  hasActiveFilters,
  filterCount,
}: ReportFiltersProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    // Convertir "all" a string vacío para mantener compatibilidad
    const processedValue = value === "all" ? "" : value
    
    // Convertir strings de fecha a Date objects
    let finalValue: any = processedValue
    if (key === 'startDate' || key === 'endDate') {
      finalValue = processedValue ? new Date(processedValue) : undefined
    }
    
    onFiltersChange({ [key]: finalValue })
  }

  const getQuickDateRange = (days: number) => {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
    
    return {
      startDate: startDate,
      endDate: endDate
    }
  }

  const applyQuickDateRange = (days: number) => {
    const dateRange = getQuickDateRange(days)
    onFiltersChange(dateRange)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros de Reportes</span>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {filterCount} filtro{filterCount !== 1 ? 's' : ''} activo{filterCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResetFilters}
                disabled={loading}
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
            <Button
              onClick={onApplyFilters}
              disabled={loading}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Cargando...' : 'Aplicar'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rango de fechas */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Período de análisis</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-xs text-muted-foreground">Fecha inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate instanceof Date ? filters.startDate.toISOString().split('T')[0] : filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-xs text-muted-foreground">Fecha fin</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate instanceof Date ? filters.endDate.toISOString().split('T')[0] : filters.endDate || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          
          {/* Rangos rápidos */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyQuickDateRange(7)}
              disabled={loading}
              className="text-xs"
            >
              <Calendar className="h-3 w-3 mr-1" />
              Últimos 7 días
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyQuickDateRange(30)}
              disabled={loading}
              className="text-xs"
            >
              <Calendar className="h-3 w-3 mr-1" />
              Últimos 30 días
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyQuickDateRange(90)}
              disabled={loading}
              className="text-xs"
            >
              <Calendar className="h-3 w-3 mr-1" />
              Últimos 3 meses
            </Button>
          </div>
        </div>

        {/* Filtros de tickets */}
        <div className="space-y-4">
          <Button 
            variant="outline" 
            className="w-full justify-between"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <span className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span>Filtros Avanzados</span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {filterCount} activo{filterCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </span>
            {showAdvancedFilters ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          
          {showAdvancedFilters && (
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Estado */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Estado</Label>
            <Select
              value={filters.status || "all"}
              onValueChange={(value) => handleFilterChange('status', value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${status.color.split(' ')[0]}`} />
                      <span>{status.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prioridad */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Prioridad</Label>
            <Select
              value={filters.priority || "all"}
              onValueChange={(value) => handleFilterChange('priority', value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas las prioridades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las prioridades</SelectItem>
                {PRIORITY_OPTIONS.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${priority.color.split(' ')[0]}`} />
                      <span>{priority.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoría */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Categoría</Label>
            <Select
              value={filters.categoryId || "all"}
              onValueChange={(value) => handleFilterChange('categoryId', value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {referenceData.categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Departamento */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Departamento</Label>
            <Select
              value={filters.departmentId || "all"}
              onValueChange={(value) => handleFilterChange('departmentId', value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los departamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los departamentos</SelectItem>
                {referenceData.departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    <div className="flex items-center space-x-2">
                      <span>{department.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
              </div>

              {/* Filtros de personas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Técnico asignado */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Técnico asignado</Label>
                  <Select
                    value={filters.assigneeId || "all"}
                    onValueChange={(value) => handleFilterChange('assigneeId', value)}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los técnicos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los técnicos</SelectItem>
                      {referenceData.technicians.map((technician) => (
                        <SelectItem key={technician.id} value={technician.id}>
                          {technician.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Cliente */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cliente</Label>
                  <Select
                    value={filters.clientId || "all"}
                    onValueChange={(value) => handleFilterChange('clientId', value)}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los clientes</SelectItem>
                      {referenceData.clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Resumen de filtros activos */}
        {hasActiveFilters && (
          <div className="pt-4 border-t">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Search className="h-4 w-4" />
              <span>Filtros activos:</span>
              <div className="flex flex-wrap gap-1">
                {filters.status && (
                  <Badge variant="outline" className="text-xs">
                    Estado: {STATUS_OPTIONS.find(s => s.value === filters.status)?.label}
                  </Badge>
                )}
                {filters.priority && (
                  <Badge variant="outline" className="text-xs">
                    Prioridad: {PRIORITY_OPTIONS.find(p => p.value === filters.priority)?.label}
                  </Badge>
                )}
                {filters.categoryId && (
                  <Badge variant="outline" className="text-xs">
                    Categoría: {referenceData.categories.find(c => c.id === filters.categoryId)?.name}
                  </Badge>
                )}
                {filters.departmentId && (
                  <Badge variant="outline" className="text-xs">
                    Departamento: {referenceData.departments.find(d => d.id === filters.departmentId)?.name}
                  </Badge>
                )}
                {filters.assigneeId && (
                  <Badge variant="outline" className="text-xs">
                    Técnico: {referenceData.technicians.find(t => t.id === filters.assigneeId)?.name}
                  </Badge>
                )}
                {filters.clientId && (
                  <Badge variant="outline" className="text-xs">
                    Cliente: {referenceData.clients.find(c => c.id === filters.clientId)?.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}