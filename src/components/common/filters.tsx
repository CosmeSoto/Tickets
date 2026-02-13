/**
 * Sistema de filtros unificado con diseño simétrico y configuración por rol
 * Optimizado para consistencia visual y funcionalidad específica por usuario
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import { Calendar, Filter, RefreshCw, RotateCcw, ChevronDown, ChevronUp, X } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// Tipos de configuración
export interface FilterOption {
  value: string
  label: string
  color?: string
  icon?: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

export interface FilterConfig {
  type: 'select' | 'multiSelect' | 'dateRange' | 'text' | 'number'
  key: string
  label: string
  placeholder?: string
  options?: FilterOption[] | string // string para referencias dinámicas como 'departments'
  multiple?: boolean
  searchable?: boolean
  clearable?: boolean
  width?: string
  roles?: ('ADMIN' | 'TECHNICIAN' | 'CLIENT')[] // Roles que pueden ver este filtro
  defaultValue?: any
  validation?: (value: any) => boolean
  transform?: (value: any) => any
}

export interface FiltersProps {
  // Configuración
  filterConfigs: FilterConfig[]
  
  // Estado
  values: Record<string, any>
  onChange: (filters: Record<string, any>) => void
  
  // Datos de referencia
  referenceData?: {
    departments?: Array<{ id: string; name: string; color?: string }>
    categories?: Array<{ id: string; name: string; color?: string }>
    technicians?: Array<{ id: string; name: string }>
    clients?: Array<{ id: string; name: string }>
    [key: string]: any
  }
  
  // Rol-based
  userRole?: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
  
  // UI
  variant?: 'horizontal' | 'vertical' | 'collapsible'
  showActiveCount?: boolean
  showClearAll?: boolean
  loading?: boolean
  
  // Callbacks
  onApply?: () => void
  onReset?: () => void
  
  // Estilos
  className?: string
  height?: number
}

// Temas por rol
const ROLE_THEMES = {
  ADMIN: {
    primary: 'blue',
    border: 'border-l-4 border-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    text: 'text-blue-700 dark:text-blue-300',
    accent: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-800'
  },
  TECHNICIAN: {
    primary: 'green',
    border: 'border-l-4 border-green-500',
    bg: 'bg-green-50 dark:bg-green-950/50',
    text: 'text-green-700 dark:text-green-300',
    accent: 'text-green-600',
    badge: 'bg-green-100 text-green-800'
  },
  CLIENT: {
    primary: 'purple',
    border: 'border-l-4 border-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950/50',
    text: 'text-purple-700 dark:text-purple-300',
    accent: 'text-purple-600',
    badge: 'bg-purple-100 text-purple-800'
  }
}

export function Filters({
  filterConfigs,
  values,
  onChange,
  referenceData = {},
  userRole = 'CLIENT',
  variant = 'horizontal',
  showActiveCount = true,
  showClearAll = true,
  loading = false,
  onApply,
  onReset,
  className,
  height = 60
}: FiltersProps) {
  const theme = ROLE_THEMES[userRole]
  const [isCollapsed, setIsCollapsed] = useState(variant === 'collapsible')

  // Filtrar configuraciones por rol
  const visibleFilters = useMemo(() => {
    return filterConfigs.filter(config => 
      !config.roles || config.roles.includes(userRole)
    )
  }, [filterConfigs, userRole])

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    return Object.entries(values).filter(([key, value]) => {
      if (!value) return false
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'string') return value !== '' && value !== 'all'
      return true
    }).length
  }, [values])

  // Obtener opciones para un filtro
  const getFilterOptions = useCallback((config: FilterConfig): FilterOption[] => {
    if (Array.isArray(config.options)) {
      return config.options
    }
    
    if (typeof config.options === 'string' && referenceData[config.options]) {
      return referenceData[config.options].map((item: any) => ({
        value: item.id,
        label: item.name,
        color: item.color
      }))
    }
    
    return []
  }, [referenceData])

  // Manejar cambio de filtro
  const handleFilterChange = useCallback((key: string, value: any, config: FilterConfig) => {
    let processedValue = value
    
    // Aplicar transformación si existe
    if (config.transform) {
      processedValue = config.transform(value)
    }
    
    // Validar si existe validación
    if (config.validation && !config.validation(processedValue)) {
      return
    }
    
    onChange({
      ...values,
      [key]: processedValue
    })
  }, [values, onChange])

  // Limpiar todos los filtros
  const handleClearAll = useCallback(() => {
    const clearedValues = Object.keys(values).reduce((acc, key) => {
      acc[key] = ''
      return acc
    }, {} as Record<string, any>)
    
    onChange(clearedValues)
    onReset?.()
  }, [values, onChange, onReset])

  // Renderizar filtro individual
  const renderFilter = useCallback((config: FilterConfig) => {
    const value = values[config.key] || config.defaultValue || ''
    const options = getFilterOptions(config)

    switch (config.type) {
      case 'select':
        return (
          <div key={config.key} className="space-y-2" style={{ width: config.width }}>
            <Label className="text-sm font-medium">{config.label}</Label>
            <Select
              value={value}
              onValueChange={(newValue) => handleFilterChange(config.key, newValue, config)}
              disabled={loading}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder={config.placeholder || `Seleccionar ${config.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                    <div className="flex items-center space-x-2">
                      {option.color && (
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: option.color }}
                        />
                      )}
                      {option.icon && <option.icon className="h-4 w-4" />}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )

      case 'multiSelect':
        const selectedValues = Array.isArray(value) ? value : []
        return (
          <div key={config.key} className="space-y-2" style={{ width: config.width }}>
            <Label className="text-sm font-medium">{config.label}</Label>
            <div className="space-y-2">
              <Select
                value=""
                onValueChange={(newValue) => {
                  if (newValue && !selectedValues.includes(newValue)) {
                    handleFilterChange(config.key, [...selectedValues, newValue], config)
                  }
                }}
                disabled={loading}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={config.placeholder || `Seleccionar ${config.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {options
                    .filter(option => !selectedValues.includes(option.value))
                    .map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center space-x-2">
                          {option.color && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: option.color }}
                            />
                          )}
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              
              {selectedValues.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedValues.map((selectedValue) => {
                    const option = options.find(opt => opt.value === selectedValue)
                    return (
                      <Badge
                        key={selectedValue}
                        variant="secondary"
                        className="text-xs flex items-center space-x-1"
                      >
                        <span>{option?.label || selectedValue}</span>
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => {
                            const newValues = selectedValues.filter(v => v !== selectedValue)
                            handleFilterChange(config.key, newValues, config)
                          }}
                        />
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )

      case 'dateRange':
        const dateValue = value || { start: '', end: '' }
        return (
          <div key={config.key} className="space-y-2" style={{ width: config.width }}>
            <Label className="text-sm font-medium">{config.label}</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <Input
                  type="date"
                  value={dateValue.start || ''}
                  onChange={(e) => handleFilterChange(config.key, { ...dateValue, start: e.target.value }, config)}
                  disabled={loading}
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hasta</Label>
                <Input
                  type="date"
                  value={dateValue.end || ''}
                  onChange={(e) => handleFilterChange(config.key, { ...dateValue, end: e.target.value }, config)}
                  disabled={loading}
                  className="h-10"
                />
              </div>
            </div>
          </div>
        )

      case 'text':
        return (
          <div key={config.key} className="space-y-2" style={{ width: config.width }}>
            <Label className="text-sm font-medium">{config.label}</Label>
            <Input
              type="text"
              value={value}
              onChange={(e) => handleFilterChange(config.key, e.target.value, config)}
              placeholder={config.placeholder}
              disabled={loading}
              className="h-10"
            />
          </div>
        )

      case 'number':
        return (
          <div key={config.key} className="space-y-2" style={{ width: config.width }}>
            <Label className="text-sm font-medium">{config.label}</Label>
            <Input
              type="number"
              value={value}
              onChange={(e) => handleFilterChange(config.key, e.target.value, config)}
              placeholder={config.placeholder}
              disabled={loading}
              className="h-10"
            />
          </div>
        )

      default:
        return null
    }
  }, [values, getFilterOptions, handleFilterChange, loading])

  if (visibleFilters.length === 0) {
    return null
  }

  // Renderizado según variante
  if (variant === 'horizontal') {
    return (
      <div className={cn('flex items-center space-x-2 p-2 rounded-lg border', theme.border, className)}>
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="flex items-center space-x-2 flex-1">
          {visibleFilters.slice(0, 3).map(renderFilter)}
        </div>
        {showActiveCount && activeFiltersCount > 0 && (
          <Badge className={theme.badge}>
            {activeFiltersCount}
          </Badge>
        )}
        {showClearAll && activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearAll}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  if (variant === 'collapsible') {
    return (
      <Card className={cn(theme.border, className)} style={{ height: isCollapsed ? 60 : 'auto' }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filtros</span>
              {showActiveCount && activeFiltersCount > 0 && (
                <Badge className={theme.badge}>
                  {activeFiltersCount} activo{activeFiltersCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {showClearAll && activeFiltersCount > 0 && (
                <Button variant="outline" size="sm" onClick={handleClearAll} disabled={loading}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              )}
              {onApply && (
                <Button size="sm" onClick={onApply} disabled={loading}>
                  <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
                  {loading ? 'Aplicando...' : 'Aplicar'}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        
        {!isCollapsed && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {visibleFilters.map(renderFilter)}
            </div>
            
            {/* Resumen de filtros activos */}
            {activeFiltersCount > 0 && (
              <>
                <Separator className="my-4" />
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span>Filtros activos:</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(values)
                      .filter(([_, value]) => {
                        if (!value) return false
                        if (Array.isArray(value)) return value.length > 0
                        if (typeof value === 'string') return value !== '' && value !== 'all'
                        return true
                      })
                      .map(([key, value]) => {
                        const config = visibleFilters.find(f => f.key === key)
                        if (!config) return null
                        
                        let displayValue = value
                        if (Array.isArray(value)) {
                          displayValue = `${value.length} seleccionados`
                        } else if (typeof value === 'object' && value.start && value.end) {
                          displayValue = `${value.start} - ${value.end}`
                        } else if (typeof value === 'string' && value !== 'all') {
                          const options = getFilterOptions(config)
                          const option = options.find(opt => opt.value === value)
                          displayValue = option?.label || value
                        }
                        
                        return (
                          <Badge key={key} variant="outline" className="text-xs">
                            {config.label}: {displayValue}
                          </Badge>
                        )
                      })}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>
    )
  }

  // Variantes horizontal y vertical
  const isHorizontal = (variant as string) === 'horizontal'
  
  return (
    <div className={cn(
      'p-4 rounded-lg border space-y-4',
      theme.border,
      className
    )} style={{ height }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
          {showActiveCount && activeFiltersCount > 0 && (
            <Badge className={theme.badge}>
              {activeFiltersCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {showClearAll && activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll} disabled={loading}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          )}
          {onApply && (
            <Button size="sm" onClick={onApply} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
              {loading ? 'Aplicando...' : 'Aplicar'}
            </Button>
          )}
        </div>
      </div>
      
      <div className={cn(
        'gap-4',
        isHorizontal ? 'flex flex-wrap items-end' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      )}>
        {visibleFilters.map(renderFilter)}
      </div>
    </div>
  )
}