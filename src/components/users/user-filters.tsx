/**
 * Componente de filtros para usuarios
 * Utiliza constantes centralizadas para evitar duplicación
 */

'use client'

import { Search, RefreshCw, Filter, X, Users } from 'lucide-react'
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
  USER_ROLE_FILTER_OPTIONS, 
  USER_STATUS_FILTER_OPTIONS,
  USER_ROLE_ICONS,
  type UserRole
} from '@/lib/constants/user-constants'
import { cn } from '@/lib/utils'

interface UserFiltersProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  roleFilter: string
  setRoleFilter: (role: string) => void
  statusFilter: string
  setStatusFilter: (status: string) => void
  departmentFilter: string
  setDepartmentFilter: (department: string) => void
  loading: boolean
  onRefresh: () => void
  onClearFilters: () => void
  departments?: Array<{ id: string; name: string; color: string }>
}

export function UserFilters({
  searchTerm,
  setSearchTerm,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  departmentFilter,
  setDepartmentFilter,
  loading,
  onRefresh,
  onClearFilters,
  departments = []
}: UserFiltersProps) {
  // Contar filtros activos
  const activeFiltersCount = [
    roleFilter !== 'all',
    statusFilter !== 'all',
    departmentFilter !== 'all',
    searchTerm.length > 0
  ].filter(Boolean).length

  return (
    <Card>
      <CardContent className='pt-6'>
        <div className='space-y-4'>
          {/* Primera fila: Búsqueda y botones */}
          <div className='flex flex-col sm:flex-row gap-3'>
            {/* Búsqueda */}
            <div className='flex-1'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
                <Input
                  placeholder='Buscar por nombre, email o teléfono...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='pl-10'
                  disabled={loading}
                />
              </div>
            </div>
            
            {/* Botones de acción */}
            <div className='flex gap-2'>
              {activeFiltersCount > 0 && (
                <Button 
                  variant='outline' 
                  onClick={onClearFilters}
                  className='whitespace-nowrap'
                  disabled={loading}
                >
                  <X className='h-4 w-4 mr-2' />
                  Limpiar ({activeFiltersCount})
                </Button>
              )}
              
              <Button 
                variant='outline' 
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
                {loading ? 'Cargando...' : 'Actualizar'}
              </Button>
            </div>
          </div>

          {/* Segunda fila: Filtros rápidos por rol */}
          <div className='flex flex-wrap gap-2'>
            <Button
              variant={roleFilter === 'all' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setRoleFilter('all')}
              disabled={loading}
            >
              <Users className="h-4 w-4 mr-1" />
              Todos
            </Button>
            
            {USER_ROLE_FILTER_OPTIONS.slice(1).map((option) => {
              const role = option.value as UserRole
              const Icon = USER_ROLE_ICONS[role]
              const isActive = roleFilter === role
              
              return (
                <Button
                  key={option.value}
                  variant={isActive ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => setRoleFilter(role)}
                  disabled={loading}
                >
                  <Icon className="h-4 w-4 mr-1" />
                  {option.label}
                </Button>
              )
            })}
          </div>

          {/* Tercera fila: Filtros avanzados */}
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3'>
            {/* Filtro de Estado */}
            <div>
              <label className='text-xs font-medium text-muted-foreground mb-1.5 block'>
                Estado
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {USER_STATUS_FILTER_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className='flex items-center space-x-2'>
                        {option.value !== 'all' && (
                          <div
                            className={`w-3 h-3 rounded-full ${
                              option.value === 'true'
                                ? 'bg-green-500'
                                : 'bg-red-500'
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

            {/* Filtro de Departamento */}
            <div>
              <label className='text-xs font-medium text-muted-foreground mb-1.5 block'>
                Departamento
              </label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los departamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los departamentos</SelectItem>
                  {departments.map(department => (
                    <SelectItem key={department.id} value={department.id}>
                      <div className='flex items-center space-x-2'>
                        <div
                          className='w-3 h-3 rounded-full'
                          style={{ backgroundColor: department.color }}
                        />
                        <span>{department.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Indicador de filtros activos */}
          {activeFiltersCount > 0 && (
            <div className='flex items-center gap-2 pt-2 border-t'>
              <Filter className='h-4 w-4 text-muted-foreground' />
              <span className='text-sm text-muted-foreground'>
                Filtros activos:
              </span>
              <div className='flex flex-wrap gap-2'>
                {roleFilter !== 'all' && (
                  <Badge variant='secondary' className='text-xs'>
                    Rol: {USER_ROLE_FILTER_OPTIONS.find(o => o.value === roleFilter)?.label}
                  </Badge>
                )}
                {statusFilter !== 'all' && (
                  <Badge variant='secondary' className='text-xs'>
                    Estado: {USER_STATUS_FILTER_OPTIONS.find(o => o.value === statusFilter)?.label}
                  </Badge>
                )}
                {departmentFilter !== 'all' && (
                  <Badge variant='secondary' className='text-xs'>
                    Departamento: {departments.find(d => d.id === departmentFilter)?.name}
                  </Badge>
                )}
                {searchTerm && (
                  <Badge variant='secondary' className='text-xs'>
                    Búsqueda: "{searchTerm}"
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}