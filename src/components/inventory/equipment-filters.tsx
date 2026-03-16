'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EquipmentStatus, EquipmentCondition } from '@prisma/client'
import type { EquipmentFilters as EquipmentFiltersType, EquipmentTypeInfo } from '@/types/inventory/equipment'

interface EquipmentFiltersProps {
  filters: EquipmentFiltersType
  onFiltersChange: (filters: EquipmentFiltersType) => void
  onReset: () => void
}

const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  MAINTENANCE: 'Mantenimiento',
  DAMAGED: 'Dañado',
  RETIRED: 'Retirado',
}

const EQUIPMENT_CONDITION_LABELS: Record<EquipmentCondition, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como Nuevo',
  GOOD: 'Bueno',
  FAIR: 'Regular',
  POOR: 'Malo',
}

export function EquipmentFilters({
  filters,
  onFiltersChange,
  onReset,
}: EquipmentFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentTypeInfo[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)

  // Cargar tipos de equipo desde la API
  useEffect(() => {
    async function fetchTypes() {
      try {
        const response = await fetch('/api/admin/equipment-types')
        if (response.ok) {
          const types = await response.json()
          setEquipmentTypes(types)
        }
      } catch (error) {
        console.error('Error cargando tipos de equipo:', error)
      } finally {
        setLoadingTypes(false)
      }
    }
    fetchTypes()
  }, [])

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value || undefined })
  }

  const handleTypeChange = (value: string) => {
    if (value === 'all') {
      onFiltersChange({ ...filters, typeId: undefined })
    } else {
      onFiltersChange({ ...filters, typeId: [value] })
    }
  }

  const handleStatusChange = (value: string) => {
    if (value === 'all') {
      onFiltersChange({ ...filters, status: undefined })
    } else {
      onFiltersChange({ ...filters, status: [value as EquipmentStatus] })
    }
  }

  const handleConditionChange = (value: string) => {
    if (value === 'all') {
      onFiltersChange({ ...filters, condition: undefined })
    } else {
      onFiltersChange({ ...filters, condition: [value as EquipmentCondition] })
    }
  }

  const activeFiltersCount = [
    filters.search,
    filters.typeId?.length,
    filters.status?.length,
    filters.condition?.length,
  ].filter(Boolean).length

  // Obtener nombre del tipo seleccionado
  const getTypeName = (typeId: string) => {
    return equipmentTypes.find(t => t.id === typeId)?.name || typeId
  }

  return (
    <div className="space-y-4">
      {/* Búsqueda principal */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, serie, marca o modelo..."
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={showAdvanced ? 'bg-accent' : ''}
        >
          <Filter className="h-4 w-4" />
        </Button>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="icon" onClick={onReset}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filtros avanzados */}
      {showAdvanced && (
        <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo</label>
            <Select
              value={filters.typeId?.[0] || 'all'}
              onValueChange={handleTypeChange}
              disabled={loadingTypes}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingTypes ? 'Cargando...' : 'Todos los tipos'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {equipmentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Estado</label>
            <Select
              value={filters.status?.[0] || 'all'}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(EQUIPMENT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Condición</label>
            <Select
              value={filters.condition?.[0] || 'all'}
              onValueChange={handleConditionChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas las condiciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las condiciones</SelectItem>
                {Object.entries(EQUIPMENT_CONDITION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Badges de filtros activos */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Búsqueda: {filters.search}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleSearchChange('')}
              />
            </Badge>
          )}
          {filters.typeId?.map((typeId) => (
            <Badge key={typeId} variant="secondary" className="gap-1">
              Tipo: {getTypeName(typeId)}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleTypeChange('all')}
              />
            </Badge>
          ))}
          {filters.status?.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              Estado: {EQUIPMENT_STATUS_LABELS[status]}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleStatusChange('all')}
              />
            </Badge>
          ))}
          {filters.condition?.map((condition) => (
            <Badge key={condition} variant="secondary" className="gap-1">
              Condición: {EQUIPMENT_CONDITION_LABELS[condition]}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleConditionChange('all')}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
