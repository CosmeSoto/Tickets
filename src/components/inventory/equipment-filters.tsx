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
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { EquipmentStatus, EquipmentCondition } from '@prisma/client'
import type { EquipmentFilters as EquipmentFiltersType, EquipmentTypeInfo } from '@/types/inventory/equipment'
import { useInventoryFamilies } from '@/contexts/families-context'

interface FamilyOption {
  id: string
  name: string
  code: string
  color?: string | null
}

interface DepartmentOption {
  id: string
  name: string
  familyId: string | null
}

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
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  const [allDepartments, setAllDepartments] = useState<DepartmentOption[]>([])
  const [loadingDepartments, setLoadingDepartments] = useState(true)

  // Familias de inventario desde el contexto global (cache Redis, sin peticion extra)
  const { families: rawFamilies } = useInventoryFamilies()
  const families = rawFamilies.map(f => ({ id: f.id, name: f.name, code: f.code ?? f.name.slice(0, 3).toUpperCase(), color: f.color }))

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

  // Cargar familias desde la API de inventario
  useEffect(() => {
    async function fetchFamilies() {
      try {
        const response = await fetch('/api/inventory/families')
        if (response.ok) {
          const data = await response.json()
          // families from context
        }
      } catch (error) {
        console.error('Error cargando familias:', error)
      } finally {
        setLoadingFamilies(false)
      }
    }
    fetchFamilies()
  }, [])

  // Cargar todos los departamentos activos
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const response = await fetch('/api/departments?isActive=true')
        if (response.ok) {
          const data = await response.json()
          setAllDepartments(data.data ?? [])
        }
      } catch (error) {
        console.error('Error cargando departamentos:', error)
      } finally {
        setLoadingDepartments(false)
      }
    }
    fetchDepartments()
  }, [])

  // Departamentos filtrados según la familia seleccionada
  const filteredDepartments = filters.familyId
    ? allDepartments.filter(d => d.familyId === filters.familyId)
    : allDepartments

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

  const handleFamilyChange = (value: string) => {
    if (value === 'all') {
      // Al limpiar familia, también limpiar departamento
      onFiltersChange({ ...filters, familyId: undefined, departmentId: undefined })
    } else {
      // Al cambiar familia, limpiar departamento
      onFiltersChange({ ...filters, familyId: value, departmentId: undefined })
    }
  }

  const handleDepartmentChange = (value: string) => {
    if (value === 'all') {
      onFiltersChange({ ...filters, departmentId: undefined })
    } else {
      onFiltersChange({ ...filters, departmentId: value })
    }
  }

  const activeFiltersCount = [
    filters.search,
    filters.typeId?.length,
    filters.status?.length,
    filters.condition?.length,
    filters.familyId,
    filters.departmentId,
  ].filter(Boolean).length

  const getTypeName = (typeId: string) =>
    equipmentTypes.find(t => t.id === typeId)?.name || typeId

  const getFamilyName = (familyId: string) =>
    families.find(f => f.id === familyId)?.name || familyId

  const getDepartmentName = (departmentId: string) =>
    allDepartments.find(d => d.id === departmentId)?.name || departmentId

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
        <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Familia */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Área / Familia</label>
            <FamilyCombobox
              families={families.map(f => ({ ...f, color: (f as any).color ?? null }))}
              value={filters.familyId ?? 'all'}
              onValueChange={handleFamilyChange}
              allowAll
              allowClear
              disabled={loadingFamilies}
              popoverWidth="240px"
            />
          </div>

          {/* Departamento */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Departamento</label>
            <Select
              value={filters.departmentId || 'all'}
              onValueChange={handleDepartmentChange}
              disabled={loadingDepartments}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingDepartments
                      ? 'Cargando...'
                      : filters.familyId
                      ? 'Todos los departamentos'
                      : 'Todos los departamentos'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los departamentos</SelectItem>
                {filteredDepartments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo */}
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

          {/* Estado */}
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

          {/* Condición */}
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
          {filters.familyId && (
            <Badge variant="secondary" className="gap-1">
              Familia: {getFamilyName(filters.familyId)}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleFamilyChange('all')}
              />
            </Badge>
          )}
          {filters.departmentId && (
            <Badge variant="secondary" className="gap-1">
              Departamento: {getDepartmentName(filters.departmentId)}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleDepartmentChange('all')}
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
