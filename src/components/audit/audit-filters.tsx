/**
 * Audit Filters Component
 * Handles all filter controls for audit logs
 */

import { Filter, Search, Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AuditFilters } from './utils/audit-types'
import type { Family } from '@/components/reports/utils/report-types'

interface AuditFiltersProps {
  filters: AuditFilters
  families: Family[]
  hasActiveFilters: boolean
  loading: boolean
  onFilterChange: (key: keyof AuditFilters, value: string) => void
  onClearFilters: () => void
  onExportCSV: () => void
  onExportJSON: () => void | Promise<void>
  onExportPDF?: () => void
}

export function AuditFiltersComponent({
  filters,
  families,
  hasActiveFilters,
  loading,
  onFilterChange,
  onClearFilters,
  onExportCSV,
  onExportJSON,
  onExportPDF,
}: AuditFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Filter className='h-5 w-5' />
          Filtros de Auditoría
        </CardTitle>
        <CardDescription>
          Filtra los logs de auditoría por diferentes criterios. Máximo 50,000 registros por
          exportación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4'>
          {/* Búsqueda */}
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Búsqueda</label>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
              <Input
                placeholder='Buscar en logs...'
                value={filters.search}
                onChange={e => onFilterChange('search', e.target.value)}
                className='pl-10'
              />
            </div>
          </div>

          {/* Tipo de Entidad */}
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Módulo</label>
            <Select
              value={filters.entityType}
              onValueChange={value => onFilterChange('entityType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los Módulos</SelectItem>
                <SelectItem value='ticket'>🎫 Tickets</SelectItem>
                <SelectItem value='user'>👥 Usuarios</SelectItem>
                <SelectItem value='category'>📂 Categorías</SelectItem>
                <SelectItem value='department'>🏢 Departamentos</SelectItem>
                <SelectItem value='technician'>🔧 Técnicos</SelectItem>
                <SelectItem value='system'>⚙️ Sistema</SelectItem>
                <SelectItem value='report'>📊 Reportes</SelectItem>
                <SelectItem value='settings'>🛠️ Configuración</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Período */}
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Período</label>
            <Select value={filters.days} onValueChange={value => onFilterChange('days', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='1'>Último día</SelectItem>
                <SelectItem value='7'>Última semana</SelectItem>
                <SelectItem value='30'>Último mes</SelectItem>
                <SelectItem value='90'>Últimos 3 meses</SelectItem>
                <SelectItem value='180'>Últimos 6 meses</SelectItem>
                <SelectItem value='365'>Último año</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Acción */}
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Acción</label>
            <Input
              placeholder='Ej: created, updated...'
              value={filters.action}
              onChange={e => onFilterChange('action', e.target.value)}
            />
          </div>

          {/* Familia */}
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Familia</label>
            <Select
              value={filters.familyId || 'all'}
              onValueChange={value => onFilterChange('familyId', value === 'all' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Todas las familias' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todas las familias</SelectItem>
                {families.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    <div className='flex items-center space-x-2'>
                      {f.color && (
                        <div
                          className='w-2 h-2 rounded-full'
                          style={{ backgroundColor: f.color }}
                        />
                      )}
                      <span>{f.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Exportar y Acciones */}
          <div className='space-y-2 lg:col-span-2'>
            <label className='text-sm font-medium'>Exportar y Acciones</label>
            <div className='flex flex-wrap gap-2'>
              <Button
                onClick={onExportCSV}
                variant='outline'
                size='sm'
                disabled={loading}
                className='min-h-9 flex-1 min-w-[calc(33%-0.25rem)] sm:min-w-0 sm:flex-initial'
              >
                <Download className='h-4 w-4 mr-1' />
                CSV
              </Button>
              <Button
                onClick={onExportJSON}
                variant='outline'
                size='sm'
                disabled={loading}
                className='min-h-9 flex-1 min-w-[calc(33%-0.25rem)] sm:min-w-0 sm:flex-initial'
              >
                <Download className='h-4 w-4 mr-1' />
                Excel
              </Button>
              {onExportPDF && (
                <Button
                  onClick={onExportPDF}
                  variant='outline'
                  size='sm'
                  disabled={loading}
                  className='min-h-9 flex-1 min-w-[calc(33%-0.25rem)] sm:min-w-0 sm:flex-initial'
                >
                  <Download className='h-4 w-4 mr-1' />
                  PDF
                </Button>
              )}
              <Button
                onClick={onClearFilters}
                variant='outline'
                size='sm'
                className='min-h-9 w-full sm:w-auto'
              >
                Limpiar
              </Button>
            </div>
            <p className='text-xs text-muted-foreground'>
              Exporta los registros según los filtros aplicados
            </p>
          </div>
        </div>

        {/* Información de filtros activos */}
        {hasActiveFilters && (
          <div className='mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg'>
            <div className='text-sm text-blue-800 dark:text-blue-200 break-words'>
              <strong>Filtros activos:</strong>
              {filters.search && ` Búsqueda: "${filters.search}"`}
              {filters.entityType !== 'all' && ` | Módulo: ${filters.entityType}`}
              {filters.action && ` | Acción: "${filters.action}"`}
              {filters.familyId && ` | Familia filtrada`}
              {filters.days !== '30' && ` | Período: ${filters.days} días`}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
