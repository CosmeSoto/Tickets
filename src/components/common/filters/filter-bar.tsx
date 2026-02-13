/**
 * Barra de filtros completa con búsqueda, selects y estadísticas
 * Componente principal que integra SearchInput, SelectFilter y StatsBar
 */

'use client'

import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SearchInput } from './search-input'
import { SelectFilter, SelectOption } from './select-filter'
import { StatsBar } from '../stats/stats-bar'
import { cn } from '@/lib/utils'
import type { FilterConfig } from '@/hooks/common'
import type { Stat } from '@/types/common'

export interface FilterBarProps<T = any> {
  // Configuración de filtros
  config: FilterConfig<T>[]
  
  // Estado de filtros
  filters: Record<string, any>
  onFilterChange: (id: string, value: any) => void
  onClearFilters: () => void
  
  // Acciones
  onRefresh?: () => void
  
  // Estados
  loading?: boolean
  activeFiltersCount?: number
  
  // Estadísticas (opcional)
  stats?: Stat[]
  statsColumns?: number
  
  // Estilos
  className?: string
}

export function FilterBar<T>({
  config,
  filters,
  onFilterChange,
  onClearFilters,
  onRefresh,
  loading = false,
  activeFiltersCount = 0,
  stats,
  statsColumns = 4,
  className
}: FilterBarProps<T>) {
  // Separar filtros por tipo
  const searchFilters = config.filter(f => f.type === 'search')
  const selectFilters = config.filter(f => f.type === 'select' || f.type === 'multiselect')
  const otherFilters = config.filter(f => f.type !== 'search' && f.type !== 'select' && f.type !== 'multiselect')

  return (
    <Card className={className}>
      <CardContent className="space-y-4 p-6">
        {/* Fila de filtros */}
        <div className='flex flex-col lg:flex-row gap-4'>
          {/* Búsqueda */}
          {searchFilters.map(filter => (
            <SearchInput
              key={filter.id}
              value={filters[filter.id] || ''}
              onChange={(value) => onFilterChange(filter.id, value)}
              placeholder={filter.placeholder}
              disabled={loading}
              className='flex-1'
            />
          ))}
          
          {/* Filtros select */}
          {selectFilters.map(filter => (
            <SelectFilter
              key={filter.id}
              id={filter.id}
              label={filter.label}
              value={filters[filter.id] || filter.defaultValue || 'all'}
              onChange={(value) => onFilterChange(filter.id, value)}
              options={filter.options || []}
              placeholder={filter.placeholder}
              disabled={loading}
            />
          ))}
          
          {/* Otros filtros (checkbox, range, etc) */}
          {otherFilters.map(filter => (
            <div key={filter.id} className='flex items-center space-x-2'>
              {/* Aquí se pueden agregar más tipos de filtros en el futuro */}
              <span className='text-sm text-muted-foreground'>
                {filter.label}: {String(filters[filter.id])}
              </span>
            </div>
          ))}
          
          {/* Botones de acción */}
          <div className='flex items-end space-x-2'>
            {activeFiltersCount > 0 && (
              <Button
                type='button'
                variant='outline'
                onClick={onClearFilters}
                disabled={loading}
                className='whitespace-nowrap'
              >
                <X className='h-4 w-4 mr-2' />
                Limpiar
                <Badge variant='secondary' className='ml-2 h-5 px-1.5'>
                  {activeFiltersCount}
                </Badge>
              </Button>
            )}
            
            {onRefresh && (
              <Button
                type='button'
                variant='outline'
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw className={cn(
                  'h-4 w-4 mr-2',
                  loading && 'animate-spin'
                )} />
                Actualizar
              </Button>
            )}
          </div>
        </div>
        
        {/* Estadísticas */}
        {stats && stats.length > 0 && (
          <StatsBar 
            stats={stats} 
            columns={statsColumns}
            loading={loading}
          />
        )}
      </CardContent>
    </Card>
  )
}
