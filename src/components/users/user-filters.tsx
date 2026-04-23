/**
 * Componente de filtros para usuarios
 * Utiliza constantes centralizadas para evitar duplicación
 */

'use client'

import { Search, RefreshCw, Filter, X, Users, Crown } from 'lucide-react'
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
  type UserRole,
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
  departments = [],
}: UserFiltersProps) {
  // Contar filtros activos
  const activeFiltersCount = [
    roleFilter !== 'all',
    statusFilter !== 'all',
    departmentFilter !== 'all',
    searchTerm.length > 0,
  ].filter(Boolean).length

  return (
    <Card>
      <CardContent className='pt-4 pb-4'>
        <div className='space-y-3'>
          {/* Fila 1: Búsqueda + botones */}
          <div className='flex flex-col sm:flex-row gap-2'>
            <div className='flex-1 relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4' />
              <Input
                placeholder='Buscar por nombre, email o teléfono...'
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className='pl-9 h-9'
                disabled={loading}
              />
            </div>
            <div className='flex gap-2 flex-shrink-0'>
              {activeFiltersCount > 0 && (
                <Button variant='outline' size='sm' onClick={onClearFilters} disabled={loading}>
                  <X className='h-3.5 w-3.5 mr-1.5' />
                  Limpiar ({activeFiltersCount})
                </Button>
              )}
              <Button variant='outline' size='sm' onClick={onRefresh} disabled={loading}>
                <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
                {loading ? 'Cargando...' : 'Actualizar'}
              </Button>
            </div>
          </div>

          {/* Fila 2: Filtros rápidos por rol */}
          <div className='flex flex-wrap gap-1.5'>
            <Button
              variant={roleFilter === 'all' ? 'default' : 'outline'}
              size='sm'
              className='h-7 text-xs px-2.5'
              onClick={() => setRoleFilter('all')}
              disabled={loading}
            >
              <Users className='h-3.5 w-3.5 mr-1' />
              Todos
            </Button>
            {USER_ROLE_FILTER_OPTIONS.slice(1).map(option => {
              const isSuperAdmin = option.value === 'SUPER_ADMIN'
              const role = isSuperAdmin ? 'ADMIN' : (option.value as UserRole)
              const Icon = isSuperAdmin ? Crown : USER_ROLE_ICONS[role as UserRole]
              const isActive = roleFilter === option.value
              return (
                <Button
                  key={option.value}
                  variant={isActive ? 'default' : 'outline'}
                  size='sm'
                  className={cn(
                    'h-7 text-xs px-2.5',
                    isSuperAdmin && isActive && 'bg-amber-500 hover:bg-amber-600 border-amber-500',
                    isSuperAdmin &&
                      !isActive &&
                      'text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                  )}
                  onClick={() => setRoleFilter(option.value)}
                  disabled={loading}
                >
                  <Icon className='h-3.5 w-3.5 mr-1' />
                  {option.label}
                </Button>
              )
            })}
          </div>

          {/* Fila 3: Estado + Departamento */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
            <Select value={statusFilter} onValueChange={setStatusFilter} disabled={loading}>
              <SelectTrigger className='h-8 text-sm'>
                <SelectValue placeholder='Todos los estados' />
              </SelectTrigger>
              <SelectContent>
                {USER_STATUS_FILTER_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className='flex items-center gap-2'>
                      {option.value !== 'all' && (
                        <div
                          className={`w-2 h-2 rounded-full ${option.value === 'true' ? 'bg-green-500' : 'bg-muted-foreground'}`}
                        />
                      )}
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={loading}>
              <SelectTrigger className='h-8 text-sm'>
                <SelectValue placeholder='Todos los departamentos' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los departamentos</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    <div className='flex items-center gap-2'>
                      <div
                        className='w-2 h-2 rounded-full'
                        style={{ backgroundColor: dept.color }}
                      />
                      {dept.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Badges de filtros activos */}
          {activeFiltersCount > 0 && (
            <div className='flex items-center gap-1.5 flex-wrap pt-1 border-t'>
              <Filter className='h-3.5 w-3.5 text-muted-foreground flex-shrink-0' />
              {roleFilter !== 'all' && (
                <Badge variant='secondary' className='text-xs h-5 px-1.5'>
                  {USER_ROLE_FILTER_OPTIONS.find(o => o.value === roleFilter)?.label}
                </Badge>
              )}
              {statusFilter !== 'all' && (
                <Badge variant='secondary' className='text-xs h-5 px-1.5'>
                  {USER_STATUS_FILTER_OPTIONS.find(o => o.value === statusFilter)?.label}
                </Badge>
              )}
              {departmentFilter !== 'all' && (
                <Badge variant='secondary' className='text-xs h-5 px-1.5'>
                  {departments.find(d => d.id === departmentFilter)?.name}
                </Badge>
              )}
              {searchTerm && (
                <Badge variant='secondary' className='text-xs h-5 px-1.5'>
                  &quot;{searchTerm}&quot;
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
