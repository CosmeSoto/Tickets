'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { X } from 'lucide-react'

interface IncidentFiltersProps {
  families: { id: string; name: string }[]
  agents: { id: string; name: string }[]
  filters: {
    familyId: string
    severity: string
    status: string
    dateFrom: string
    dateTo: string
    agentId: string
  }
  onFilterChange: (key: string, value: string) => void
  onClear: () => void
}

// Radix Select no permite value="" — usamos un sentinel para "todos"
const ALL = '__all__'

export function IncidentFilters({
  families,
  agents,
  filters,
  onFilterChange,
  onClear,
}: IncidentFiltersProps) {
  const hasActiveFilters =
    filters.familyId !== '' ||
    filters.severity !== '' ||
    filters.status !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.agentId !== ''

  // Convierte '' ↔ ALL para compatibilidad con Radix Select
  const handleChange = (key: string, v: string) => {
    onFilterChange(key, v === ALL ? '' : v)
  }

  return (
    <Card>
      <CardContent className='pt-4 pb-4'>
        <div className='flex flex-wrap items-end gap-3'>
          {/* Familia */}
          <div className='space-y-1 min-w-[160px] flex-1'>
            <label className='text-sm font-medium text-muted-foreground'>Familia</label>
            <Select
              value={filters.familyId || ALL}
              onValueChange={(v) => handleChange('familyId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Todas las áreas' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas las áreas</SelectItem>
                {families.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severidad */}
          <div className='space-y-1 min-w-[140px] flex-1'>
            <label className='text-sm font-medium text-muted-foreground'>Severidad</label>
            <Select
              value={filters.severity || ALL}
              onValueChange={(v) => handleChange('severity', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Todas' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                <SelectItem value='LOW'>Baja</SelectItem>
                <SelectItem value='MEDIUM'>Media</SelectItem>
                <SelectItem value='HIGH'>Alta</SelectItem>
                <SelectItem value='CRITICAL'>Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Estado */}
          <div className='space-y-1 min-w-[140px] flex-1'>
            <label className='text-sm font-medium text-muted-foreground'>Estado</label>
            <Select
              value={filters.status || ALL}
              onValueChange={(v) => handleChange('status', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Todos' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value='OPEN'>Abierta</SelectItem>
                <SelectItem value='RESOLVED'>Resuelta</SelectItem>
                <SelectItem value='ESCALATED'>Escalada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Agente */}
          <div className='space-y-1 min-w-[160px] flex-1'>
            <label className='text-sm font-medium text-muted-foreground'>Agente</label>
            <Select
              value={filters.agentId || ALL}
              onValueChange={(v) => handleChange('agentId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Todos los agentes' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los agentes</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha desde */}
          <div className='space-y-1 min-w-[160px] flex-1'>
            <label className='text-sm font-medium text-muted-foreground'>Fecha desde</label>
            <DateTimePicker
              value={filters.dateFrom}
              onChange={(v) => onFilterChange('dateFrom', v)}
              placeholder='Desde'
            />
          </div>

          {/* Fecha hasta */}
          <div className='space-y-1 min-w-[160px] flex-1'>
            <label className='text-sm font-medium text-muted-foreground'>Fecha hasta</label>
            <DateTimePicker
              value={filters.dateTo}
              onChange={(v) => onFilterChange('dateTo', v)}
              placeholder='Hasta'
            />
          </div>

          {/* Limpiar filtros */}
          {hasActiveFilters && (
            <Button variant='ghost' size='sm' onClick={onClear} className='flex items-center gap-1'>
              <X className='h-4 w-4' />
              Limpiar filtros
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
