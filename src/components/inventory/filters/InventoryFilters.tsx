'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface InventoryFiltersProps {
  onSearchChange: (search: string) => void
  onTypeChange: (typeId: string | null) => void
  onDepartmentChange: (departmentId: string | null) => void
  onStatusChange: (status: string | null) => void
  types?: Array<{ id: string; name: string }>
  departments?: Array<{ id: string; name: string }>
  initialSearch?: string
  initialType?: string
  initialDepartment?: string
  initialStatus?: string
}

const STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'ASSIGNED', label: 'Asignado' },
  { value: 'MAINTENANCE', label: 'En Mantenimiento' },
  { value: 'RETIRED', label: 'Retirado' },
]

export function InventoryFilters({
  onSearchChange,
  onTypeChange,
  onDepartmentChange,
  onStatusChange,
  types = [],
  departments = [],
  initialSearch = '',
  initialType,
  initialDepartment,
  initialStatus,
}: InventoryFiltersProps) {
  const [search, setSearch] = useState(initialSearch)
  const [selectedType, setSelectedType] = useState<string | null>(initialType || null)
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
    initialDepartment || null
  )
  const [selectedStatus, setSelectedStatus] = useState<string | null>(initialStatus || null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const activeFiltersCount = [selectedType, selectedDepartment, selectedStatus].filter(
    Boolean
  ).length

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onSearchChange(value)
  }

  const handleTypeChange = (value: string) => {
    const newValue = value === 'all' ? null : value
    setSelectedType(newValue)
    onTypeChange(newValue)
  }

  const handleDepartmentChange = (value: string) => {
    const newValue = value === 'all' ? null : value
    setSelectedDepartment(newValue)
    onDepartmentChange(newValue)
  }

  const handleStatusChange = (value: string) => {
    const newValue = value === 'all' ? null : value
    setSelectedStatus(newValue)
    onStatusChange(newValue)
  }

  const handleClearFilters = () => {
    setSearch('')
    setSelectedType(null)
    setSelectedDepartment(null)
    setSelectedStatus(null)
    onSearchChange('')
    onTypeChange(null)
    onDepartmentChange(null)
    onStatusChange(null)
  }

  return (
    <div className='space-y-4 mb-6'>
      {/* Búsqueda principal */}
      <div className='flex gap-2'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4' />
          <Input
            type='text'
            placeholder='Buscar por marca, modelo...'
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className='pl-10'
          />
        </div>
        <Button
          variant={showAdvanced ? 'default' : 'outline'}
          onClick={() => setShowAdvanced(!showAdvanced)}
          className='flex items-center gap-2'
        >
          <Filter className='w-4 h-4' />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant='secondary' className='ml-1'>
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
        {(search || activeFiltersCount > 0) && (
          <Button variant='ghost' onClick={handleClearFilters} className='flex items-center gap-2'>
            <X className='w-4 h-4' />
            Limpiar
          </Button>
        )}
      </div>

      {/* Filtros avanzados */}
      {showAdvanced && (
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-gray-50'>
          {/* Filtro por tipo */}
          <div>
            <label className='text-sm font-medium mb-2 block'>Tipo de Equipo</label>
            <Select value={selectedType || 'all'} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder='Todos los tipos' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los tipos</SelectItem>
                {types.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por departamento */}
          <div>
            <label className='text-sm font-medium mb-2 block'>Departamento</label>
            <Select value={selectedDepartment || 'all'} onValueChange={handleDepartmentChange}>
              <SelectTrigger>
                <SelectValue placeholder='Todos los departamentos' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los departamentos</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por estado */}
          <div>
            <label className='text-sm font-medium mb-2 block'>Estado</label>
            <Select value={selectedStatus || 'all'} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder='Todos los estados' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los estados</SelectItem>
                {STATUS_OPTIONS.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}
