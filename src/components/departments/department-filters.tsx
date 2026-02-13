/**
 * Componente unificado de filtros para departamentos
 * Utiliza constantes centralizadas para evitar duplicación
 */

'use client'

import { Search, RefreshCw, Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  DEPARTMENT_STATUS_FILTER_OPTIONS,
  type DepartmentStatus
} from '@/lib/constants/department-constants'
import { cn } from '@/lib/utils'

interface DepartmentFiltersProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  statusFilter: DepartmentStatus
  setStatusFilter: (status: DepartmentStatus) => void
  loading: boolean
  onRefresh: () => void
  className?: string
}

export function DepartmentFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  loading,
  onRefresh,
  className
}: DepartmentFiltersProps) {
  // Contar filtros activos
  const activeFiltersCount = [
    searchTerm.trim().length > 0,
    statusFilter !== 'all'
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
    
    if (statusFilter !== 'all') {
      const statusOption = DEPARTMENT_STATUS_FILTER_OPTIONS.find(o => o.value === statusFilter)
      badges.push({
        label: `Estado: ${statusOption?.label || statusFilter}`,
        onRemove: () => setStatusFilter('all')
      })
    }
    
    return badges
  }

  const activeFilterBadges = getActiveFilterBadges()

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="p-6 space-y-4">
        {/* Fila principal de filtros */}
        <div className='flex flex-col lg:flex-row gap-4'>
          {/* Búsqueda */}
          <div className='flex-1'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
              <Input
                placeholder='Buscar por nombre o descripción...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-10'
                disabled={loading}
              />
            </div>
          </div>
          
          {/* Filtro por estado */}
          <div className='w-48'>
            <Select value={statusFilter} onValueChange={setStatusFilter} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENT_STATUS_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Botones de acción */}
          <div className="flex items-center space-x-2">
            <Button
              variant='outline'
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center space-x-1"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              <span>{loading ? 'Cargando...' : 'Actualizar'}</span>
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