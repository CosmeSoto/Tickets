/**
 * Componente unificado de filtros para categorías
 * Utiliza constantes centralizadas para evitar duplicación
 */

'use client'

import { Search, Filter, X, RefreshCw, FolderTree } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { 
  CATEGORY_LEVEL_FILTER_OPTIONS,
  getCategoryLevelColor,
  getCategoryLevelIcon,
  type CategoryLevel
} from '@/lib/constants/category-constants'
import { cn } from '@/lib/utils'

interface CategoryFiltersProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  levelFilter: CategoryLevel
  setLevelFilter: (level: CategoryLevel) => void
  loading: boolean
  onRefresh: () => void
  className?: string
}

export function CategoryFilters({
  searchTerm,
  setSearchTerm,
  levelFilter,
  setLevelFilter,
  loading,
  onRefresh,
  className
}: CategoryFiltersProps) {
  // Contar filtros activos
  const activeFiltersCount = [
    searchTerm.trim().length > 0,
    levelFilter !== 'all'
  ].filter(Boolean).length

  // Obtener badges de filtros activos
  const getActiveFilterBadges = () => {
    const badges = []
    
    if (searchTerm) {
      badges.push({
        label: `Búsqueda: ${searchTerm}`,
        onRemove: () => setSearchTerm('')
      })
    }
    
    if (levelFilter !== 'all') {
      const levelOption = CATEGORY_LEVEL_FILTER_OPTIONS.find(o => o.value === levelFilter)
      badges.push({
        label: `Nivel: ${levelOption?.label || levelFilter}`,
        onRemove: () => setLevelFilter('all')
      })
    }
    
    return badges
  }

  const activeFilterBadges = getActiveFilterBadges()

  const clearFilters = () => {
    setSearchTerm('')
    setLevelFilter('all')
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="p-6 space-y-4">
        {/* Fila principal de filtros */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Búsqueda */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          {/* Filtros rápidos por nivel */}
          <div className="flex items-center space-x-2">
            {CATEGORY_LEVEL_FILTER_OPTIONS.map((option) => {
              const Icon = getCategoryLevelIcon(option.value)
              const isActive = levelFilter === option.value
              const colorClass = option.value !== 'all' ? getCategoryLevelColor(option.value) : ''
              
              return (
                <Button
                  key={option.value}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLevelFilter(option.value as CategoryLevel)}
                  className="flex items-center space-x-1"
                  disabled={loading}
                >
                  {option.value !== 'all' && (
                    <div className={cn("w-2 h-2 rounded-full mr-1", colorClass)} />
                  )}
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {option.value === 'all' ? 'Todos' : `Nivel ${option.value}`}
                  </span>
                </Button>
              )
            })}
          </div>

          {/* Botones de acción */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center space-x-1"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              <span>Actualizar</span>
            </Button>
            
            {activeFiltersCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                disabled={loading}
              >
                <X className="h-4 w-4" />
                <span>Limpiar ({activeFiltersCount})</span>
              </Button>
            )}
          </div>
        </div>

        {/* Badges de filtros activos */}
        {activeFilterBadges.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <span className="text-sm text-muted-foreground flex items-center">
              <Filter className="h-4 w-4 mr-1" />
              Filtros activos:
            </span>
            {activeFilterBadges.map((badge, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center space-x-1 pr-1"
              >
                <span className="text-xs">{badge.label}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={badge.onRemove}
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  disabled={loading}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}