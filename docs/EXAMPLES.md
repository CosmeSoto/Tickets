# Ejemplos de Código - Sistema de Estandarización de UI

## Tabla de Contenidos

1. [Módulo Básico](#módulo-básico)
2. [Módulo con Múltiples Vistas](#módulo-con-múltiples-vistas)
3. [Módulo con Filtros Avanzados](#módulo-con-filtros-avanzados)
4. [Módulo con Estadísticas](#módulo-con-estadísticas)
5. [Componentes Personalizados](#componentes-personalizados)
6. [Hooks Personalizados](#hooks-personalizados)
7. [Casos de Uso Comunes](#casos-de-uso-comunes)

## Módulo Básico

### Ejemplo 1: Lista Simple

```typescript
'use client'

import { ModuleLayout } from '@/components/common/layout'
import { ListView } from '@/components/common/views'
import { useModuleData, usePagination } from '@/hooks/common'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Technician } from '@/types'

export default function TechniciansPage() {
  // 1. Cargar datos
  const { data, loading, error, reload } = useModuleData<Technician>('/api/technicians')
  
  // 2. Aplicar paginación
  const pagination = usePagination(data, { initialItemsPerPage: 10 })
  
  return (
    <ModuleLayout
      title="Técnicos"
      subtitle="Lista de técnicos del sistema"
      loading={loading}
      error={error}
      onRetry={reload}
    >
      <ListView
        data={pagination.paginatedData}
        renderItem={(tech) => (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarFallback>{tech.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{tech.name}</p>
                <p className="text-sm text-muted-foreground">{tech.email}</p>
              </div>
            </div>
            <Badge variant={tech.isActive ? 'default' : 'secondary'}>
              {tech.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        )}
        pagination={pagination}
      />
    </ModuleLayout>
  )
}
```

### Ejemplo 2: Tabla Simple

```typescript
'use client'

import { ModuleLayout } from '@/components/common/layout'
import { DataTable } from '@/components/common/views'
import { useModuleData, usePagination } from '@/hooks/common'
import { Badge } from '@/components/ui/badge'
import type { Technician, ColumnConfig } from '@/types'

export default function TechniciansPage() {
  const { data, loading, error, reload } = useModuleData<Technician>('/api/technicians')
  const pagination = usePagination(data, { initialItemsPerPage: 20 })
  
  const columns: ColumnConfig<Technician>[] = [
    {
      id: 'name',
      header: 'Nombre',
      accessor: 'name',
      sortable: true
    },
    {
      id: 'email',
      header: 'Email',
      accessor: 'email'
    },
    {
      id: 'department',
      header: 'Departamento',
      accessor: (tech) => tech.department?.name || 'Sin departamento'
    },
    {
      id: 'status',
      header: 'Estado',
      accessor: (tech) => (
        <Badge variant={tech.isActive ? 'default' : 'secondary'}>
          {tech.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    }
  ]
  
  return (
    <ModuleLayout
      title="Técnicos"
      subtitle="Tabla de técnicos del sistema"
      loading={loading}
      error={error}
      onRetry={reload}
    >
      <DataTable
        data={pagination.paginatedData}
        columns={columns}
        sortable
        pagination={pagination}
      />
    </ModuleLayout>
  )
}
```

## Módulo con Múltiples Vistas

### Ejemplo 3: Cards, List y Table

```typescript
'use client'

import { useState, useMemo } from 'react'
import { ModuleLayout } from '@/components/common/layout'
import { ViewToggle, CardView, ListView, DataTable } from '@/components/common/views'
import { useModuleData, useViewMode, usePagination } from '@/hooks/common'
import { TechnicianCard } from '@/components/technicians/technician-card'
import { TechnicianListItem } from '@/components/technicians/technician-list-item'
import type { Technician, ColumnConfig } from '@/types'

export default function TechniciansPage() {
  const [showCreate, setShowCreate] = useState(false)
  
  // 1. Cargar datos
  const { data, loading, error, reload } = useModuleData<Technician>('/api/technicians')
  
  // 2. Manejar vista
  const { viewMode, setViewMode } = useViewMode('cards', {
    storageKey: 'technicians-view',
    availableModes: ['cards', 'list', 'table']
  })
  
  // 3. Aplicar paginación
  const pagination = usePagination(data, {
    initialItemsPerPage: viewMode === 'table' ? 20 : 12
  })
  
  // 4. Configurar columnas para tabla
  const columns: ColumnConfig<Technician>[] = useMemo(() => [
    { id: 'name', header: 'Nombre', accessor: 'name', sortable: true },
    { id: 'email', header: 'Email', accessor: 'email' },
    { id: 'phone', header: 'Teléfono', accessor: 'phone' },
    { id: 'department', header: 'Departamento', accessor: (t) => t.department?.name || '-' },
    {
      id: 'status',
      header: 'Estado',
      accessor: (t) => (
        <Badge variant={t.isActive ? 'default' : 'secondary'}>
          {t.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    }
  ], [])
  
  return (
    <ModuleLayout
      title="Técnicos"
      subtitle="Gestión de técnicos del sistema"
      loading={loading}
      error={error}
      onRetry={reload}
      primaryAction={{
        label: 'Crear Técnico',
        onClick: () => setShowCreate(true)
      }}
    >
      <ViewToggle
        mode={viewMode}
        availableModes={['cards', 'list', 'table']}
        onChange={setViewMode}
      />
      
      {viewMode === 'cards' && (
        <CardView
          data={pagination.paginatedData}
          renderCard={(tech) => <TechnicianCard technician={tech} />}
          columns={{ sm: 1, md: 2, lg: 3, xl: 4 }}
          pagination={pagination}
        />
      )}
      
      {viewMode === 'list' && (
        <ListView
          data={pagination.paginatedData}
          renderItem={(tech) => <TechnicianListItem technician={tech} />}
          pagination={pagination}
        />
      )}
      
      {viewMode === 'table' && (
        <DataTable
          data={pagination.paginatedData}
          columns={columns}
          sortable
          pagination={pagination}
        />
      )}
    </ModuleLayout>
  )
}
```

## Módulo con Filtros Avanzados

### Ejemplo 4: Filtros Múltiples

```typescript
'use client'

import { useMemo } from 'react'
import { ModuleLayout } from '@/components/common/layout'
import { FilterBar } from '@/components/common/filters'
import { ListView } from '@/components/common/views'
import { useModuleData, useFilters, usePagination } from '@/hooks/common'
import { useDepartments } from '@/hooks/use-departments'
import type { Technician, FilterConfig } from '@/types'

export default function TechniciansPage() {
  // 1. Cargar datos
  const { data, loading, error, reload } = useModuleData<Technician>('/api/technicians')
  const { departments } = useDepartments()
  
  // 2. Configurar filtros
  const filterConfig: FilterConfig<Technician>[] = useMemo(() => [
    {
      id: 'search',
      type: 'search',
      label: 'Buscar',
      searchFields: ['name', 'email', 'phone'],
      placeholder: 'Buscar por nombre, email o teléfono...'
    },
    {
      id: 'department',
      type: 'select',
      label: 'Departamento',
      field: 'departmentId',
      options: [
        { value: 'all', label: 'Todos los departamentos' },
        ...departments.map(d => ({ value: d.id, label: d.name }))
      ]
    },
    {
      id: 'status',
      type: 'select',
      label: 'Estado',
      field: 'isActive',
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'true', label: 'Activos' },
        { value: 'false', label: 'Inactivos' }
      ]
    }
  ], [departments])
  
  // 3. Aplicar filtros
  const { filteredData, filters, setFilter, clearFilters, activeFiltersCount } = useFilters(
    data,
    filterConfig,
    { debounceMs: 300 }
  )
  
  // 4. Aplicar paginación
  const pagination = usePagination(filteredData, { initialItemsPerPage: 10 })
  
  // 5. Calcular estadísticas
  const stats = useMemo(() => [
    {
      label: 'Total',
      value: data.length,
      color: 'blue' as const,
      icon: <Users className="h-4 w-4" />
    },
    {
      label: 'Activos',
      value: data.filter(t => t.isActive).length,
      color: 'green' as const,
      icon: <CheckCircle className="h-4 w-4" />
    },
    {
      label: 'Inactivos',
      value: data.filter(t => !t.isActive).length,
      color: 'gray' as const,
      icon: <XCircle className="h-4 w-4" />
    },
    {
      label: 'Filtrados',
      value: filteredData.length,
      color: 'purple' as const,
      icon: <Filter className="h-4 w-4" />
    }
  ], [data, filteredData])
  
  return (
    <ModuleLayout
      title="Técnicos"
      subtitle="Gestión de técnicos del sistema"
      loading={loading}
      error={error}
      onRetry={reload}
    >
      <FilterBar
        config={filterConfig}
        filters={filters}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
        onRefresh={reload}
        loading={loading}
        stats={stats}
      />
      
      <div className="text-sm text-muted-foreground mb-4">
        Mostrando {filteredData.length} de {data.length} técnicos
        {activeFiltersCount > 0 && ` (${activeFiltersCount} filtros activos)`}
      </div>
      
      <ListView
        data={pagination.paginatedData}
        renderItem={(tech) => <TechnicianListItem technician={tech} />}
        pagination={pagination}
      />
    </ModuleLayout>
  )
}
```

## Módulo con Estadísticas

### Ejemplo 5: StatsBar Completo

```typescript
'use client'

import { useMemo } from 'react'
import { ModuleLayout } from '@/components/common/layout'
import { StatsBar } from '@/components/common/stats'
import { CardView } from '@/components/common/views'
import { useModuleData, usePagination } from '@/hooks/common'
import { Users, CheckCircle, XCircle, Building, TrendingUp } from 'lucide-react'
import type { Technician, Stat } from '@/types'

export default function TechniciansPage() {
  const { data, loading, error, reload } = useModuleData<Technician>('/api/technicians')
  const pagination = usePagination(data, { initialItemsPerPage: 12 })
  
  // Calcular estadísticas avanzadas
  const stats: Stat[] = useMemo(() => {
    const total = data.length
    const active = data.filter(t => t.isActive).length
    const inactive = total - active
    const withDepartment = data.filter(t => t.departmentId).length
    const avgTickets = data.reduce((sum, t) => sum + (t._count?.tickets || 0), 0) / total || 0
    
    return [
      {
        label: 'Total Técnicos',
        value: total,
        color: 'blue',
        icon: <Users className="h-4 w-4" />
      },
      {
        label: 'Activos',
        value: active,
        color: 'green',
        icon: <CheckCircle className="h-4 w-4" />,
        onClick: () => console.log('Filtrar activos')
      },
      {
        label: 'Inactivos',
        value: inactive,
        color: 'gray',
        icon: <XCircle className="h-4 w-4" />,
        onClick: () => console.log('Filtrar inactivos')
      },
      {
        label: 'Con Departamento',
        value: withDepartment,
        color: 'purple',
        icon: <Building className="h-4 w-4" />
      },
      {
        label: 'Promedio Tickets',
        value: avgTickets.toFixed(1),
        color: 'orange',
        icon: <TrendingUp className="h-4 w-4" />
      }
    ]
  }, [data])
  
  return (
    <ModuleLayout
      title="Técnicos"
      subtitle="Dashboard de técnicos"
      loading={loading}
      error={error}
      onRetry={reload}
    >
      <StatsBar stats={stats} columns={5} />
      
      <CardView
        data={pagination.paginatedData}
        renderCard={(tech) => <TechnicianCard technician={tech} />}
        pagination={pagination}
      />
    </ModuleLayout>
  )
}
```

## Componentes Personalizados

### Ejemplo 6: TechnicianCard

```typescript
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building, Phone, Mail, Edit, Trash } from 'lucide-react'
import type { Technician } from '@/types'

interface TechnicianCardProps {
  technician: Technician
  onEdit?: (tech: Technician) => void
  onDelete?: (tech: Technician) => void
}

export function TechnicianCard({ technician, onEdit, onDelete }: TechnicianCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg">
                {technician.name[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">{technician.name}</h3>
              <Badge variant={technician.isActive ? 'default' : 'secondary'}>
                {technician.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </div>
        </div>
        
        {/* Info */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center text-sm text-muted-foreground">
            <Mail className="h-4 w-4 mr-2" />
            {technician.email}
          </div>
          {technician.phone && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Phone className="h-4 w-4 mr-2" />
              {technician.phone}
            </div>
          )}
          {technician.department && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Building className="h-4 w-4 mr-2" />
              {technician.department.name}
            </div>
          )}
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-muted rounded-md">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {technician._count?.tickets || 0}
            </div>
            <div className="text-xs text-muted-foreground">Tickets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {technician._count?.categories || 0}
            </div>
            <div className="text-xs text-muted-foreground">Categorías</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {technician.rating?.toFixed(1) || 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">Rating</div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center justify-end space-x-2 pt-3 border-t">
          {onEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(technician)
              }}
            >
              <Edit className="h-4 w-4 mr-1" />
              Editar
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(technician)
              }}
            >
              <Trash className="h-4 w-4 mr-1" />
              Eliminar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

### Ejemplo 7: TechnicianListItem

```typescript
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Building, Phone, Mail, Edit, Trash } from 'lucide-react'
import type { Technician } from '@/types'

interface TechnicianListItemProps {
  technician: Technician
  onEdit?: (tech: Technician) => void
  onDelete?: (tech: Technician) => void
}

export function TechnicianListItem({ technician, onEdit, onDelete }: TechnicianListItemProps) {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors">
      {/* Left: Info */}
      <div className="flex items-center space-x-3 flex-1">
        <Avatar>
          <AvatarFallback>{technician.name[0]}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="font-medium">{technician.name}</h4>
            <Badge variant={technician.isActive ? 'default' : 'secondary'} className="text-xs">
              {technician.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span className="flex items-center">
              <Mail className="h-3 w-3 mr-1" />
              {technician.email}
            </span>
            {technician.phone && (
              <span className="flex items-center">
                <Phone className="h-3 w-3 mr-1" />
                {technician.phone}
              </span>
            )}
            {technician.department && (
              <span className="flex items-center">
                <Building className="h-3 w-3 mr-1" />
                {technician.department.name}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Right: Stats & Actions */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3 text-sm">
          <div className="text-center">
            <div className="font-bold text-blue-600">{technician._count?.tickets || 0}</div>
            <div className="text-xs text-muted-foreground">Tickets</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-green-600">{technician._count?.categories || 0}</div>
            <div className="text-xs text-muted-foreground">Categorías</div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {onEdit && (
            <Button size="sm" variant="ghost" onClick={() => onEdit(technician)}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="ghost" onClick={() => onDelete(technician)}>
              <Trash className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
```

## Hooks Personalizados

### Ejemplo 8: Hook Específico de Módulo

```typescript
// hooks/use-technicians.ts
import { useState, useCallback } from 'react'
import { useModuleData } from '@/hooks/common'
import { toast } from '@/hooks/use-toast'
import type { Technician } from '@/types'

export function useTechnicians() {
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [selectedTech, setSelectedTech] = useState<Technician | null>(null)
  
  const { data, loading, error, reload, create, update, delete: deleteTech } = 
    useModuleData<Technician>('/api/technicians')
  
  const handleCreate = useCallback(async (values: Partial<Technician>) => {
    const result = await create(values)
    if (result.success) {
      toast({ title: 'Técnico creado exitosamente' })
      setShowCreate(false)
      reload()
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }, [create, reload])
  
  const handleEdit = useCallback((tech: Technician) => {
    setSelectedTech(tech)
    setShowEdit(true)
  }, [])
  
  const handleUpdate = useCallback(async (values: Partial<Technician>) => {
    if (!selectedTech) return
    
    const result = await update(selectedTech.id, values)
    if (result.success) {
      toast({ title: 'Técnico actualizado exitosamente' })
      setShowEdit(false)
      setSelectedTech(null)
      reload()
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }, [selectedTech, update, reload])
  
  const handleDelete = useCallback(async (tech: Technician) => {
    if (!confirm(`¿Eliminar técnico ${tech.name}?`)) return
    
    const result = await deleteTech(tech.id)
    if (result.success) {
      toast({ title: 'Técnico eliminado exitosamente' })
      reload()
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    }
  }, [deleteTech, reload])
  
  return {
    // Data
    technicians: data,
    loading,
    error,
    reload,
    
    // Create
    showCreate,
    setShowCreate,
    handleCreate,
    
    // Edit
    showEdit,
    setShowEdit,
    selectedTech,
    handleEdit,
    handleUpdate,
    
    // Delete
    handleDelete
  }
}

// Uso en componente
export default function TechniciansPage() {
  const {
    technicians,
    loading,
    error,
    reload,
    showCreate,
    setShowCreate,
    handleCreate,
    showEdit,
    setShowEdit,
    selectedTech,
    handleEdit,
    handleUpdate,
    handleDelete
  } = useTechnicians()
  
  return (
    <ModuleLayout
      title="Técnicos"
      loading={loading}
      error={error}
      onRetry={reload}
      primaryAction={{
        label: 'Crear Técnico',
        onClick: () => setShowCreate(true)
      }}
    >
      <CardView
        data={technicians}
        renderCard={(tech) => (
          <TechnicianCard
            technician={tech}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      />
      
      <CreateTechnicianDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSubmit={handleCreate}
      />
      
      <EditTechnicianDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        technician={selectedTech}
        onSubmit={handleUpdate}
      />
    </ModuleLayout>
  )
}
```

## Casos de Uso Comunes

### Caso 1: Búsqueda con Debounce

```typescript
import { useState, useEffect } from 'react'
import { useDebounce } from '@/hooks/common'

function SearchExample() {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  
  useEffect(() => {
    if (debouncedSearch) {
      // Realizar búsqueda
      console.log('Buscando:', debouncedSearch)
    }
  }, [debouncedSearch])
  
  return (
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Buscar..."
    />
  )
}
```

### Caso 2: Filtros con URL Persistence

```typescript
import { useFilters } from '@/hooks/common'

function FiltersWithURLExample() {
  const { filteredData, filters, setFilter } = useFilters(
    data,
    filterConfig,
    { persistInUrl: true } // Guarda filtros en URL
  )
  
  // Los filtros se mantienen al recargar la página
  // URL: /technicians?search=john&status=active
  
  return <ListView data={filteredData} />
}
```

### Caso 3: Paginación con Items por Página Dinámicos

```typescript
import { usePagination } from '@/hooks/common'

function DynamicPaginationExample() {
  const pagination = usePagination(data, {
    initialItemsPerPage: 10,
    persistInUrl: true
  })
  
  return (
    <div>
      <ListView data={pagination.paginatedData} />
      
      <div className="flex items-center justify-between">
        <select
          value={pagination.itemsPerPage}
          onChange={(e) => pagination.setItemsPerPage(Number(e.target.value))}
        >
          <option value={10}>10 por página</option>
          <option value={20}>20 por página</option>
          <option value={50}>50 por página</option>
          <option value={100}>100 por página</option>
        </select>
        
        <Pagination {...pagination} />
      </div>
    </div>
  )
}
```

### Caso 4: Vista con Persistencia

```typescript
import { useViewMode } from '@/hooks/common'

function ViewPersistenceExample() {
  const { viewMode, setViewMode } = useViewMode('cards', {
    storageKey: 'technicians-view', // Guarda en localStorage
    responsive: true // Auto-switch en mobile
  })
  
  // La vista se mantiene entre sesiones
  // En mobile siempre usa 'list'
  
  return (
    <div>
      <ViewToggle mode={viewMode} onChange={setViewMode} />
      
      {viewMode === 'cards' && <CardView data={data} />}
      {viewMode === 'list' && <ListView data={data} />}
      {viewMode === 'table' && <DataTable data={data} />}
    </div>
  )
}
```

### Caso 5: Estadísticas Clickeables

```typescript
import { StatsBar } from '@/components/common/stats'

function ClickableStatsExample() {
  const [statusFilter, setStatusFilter] = useState('all')
  
  const stats = [
    {
      label: 'Total',
      value: data.length,
      color: 'blue' as const,
      onClick: () => setStatusFilter('all')
    },
    {
      label: 'Activos',
      value: activeCount,
      color: 'green' as const,
      onClick: () => setStatusFilter('active')
    },
    {
      label: 'Inactivos',
      value: inactiveCount,
      color: 'gray' as const,
      onClick: () => setStatusFilter('inactive')
    }
  ]
  
  return (
    <div>
      <StatsBar stats={stats} />
      <ListView data={filteredByStatus} />
    </div>
  )
}
```

### Caso 6: Empty States Personalizados

```typescript
import { ListView } from '@/components/common/views'
import { FileX } from 'lucide-react'

function CustomEmptyStateExample() {
  return (
    <ListView
      data={data}
      renderItem={(item) => <ItemComponent item={item} />}
      emptyState={
        <div className="text-center py-12">
          <FileX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay técnicos</h3>
          <p className="text-muted-foreground mb-4">
            Comienza creando tu primer técnico
          </p>
          <Button onClick={() => setShowCreate(true)}>
            Crear Técnico
          </Button>
        </div>
      }
    />
  )
}
```

### Caso 7: Loading Skeletons

```typescript
import { Skeleton } from '@/components/ui/skeleton'

function LoadingSkeletonExample() {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  return <ListView data={data} renderItem={renderItem} />
}
```

### Caso 8: Acciones Masivas

```typescript
import { useState } from 'react'
import { DataTable } from '@/components/common/views'
import { Button } from '@/components/ui/button'

function BulkActionsExample() {
  const [selected, setSelected] = useState<Technician[]>([])
  
  const handleBulkDelete = async () => {
    if (!confirm(`¿Eliminar ${selected.length} técnicos?`)) return
    
    await Promise.all(selected.map(tech => deleteTech(tech.id)))
    setSelected([])
    reload()
  }
  
  const handleBulkActivate = async () => {
    await Promise.all(selected.map(tech => 
      update(tech.id, { isActive: true })
    ))
    setSelected([])
    reload()
  }
  
  return (
    <div>
      {selected.length > 0 && (
        <div className="flex items-center space-x-2 mb-4 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selected.length} seleccionados
          </span>
          <Button size="sm" onClick={handleBulkActivate}>
            Activar
          </Button>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
            Eliminar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelected([])}>
            Cancelar
          </Button>
        </div>
      )}
      
      <DataTable
        data={data}
        columns={columns}
        selectable
        onSelectionChange={setSelected}
      />
    </div>
  )
}
```

## Recursos Adicionales

- [Guía de Componentes](./COMPONENT_GUIDE.md)
- [Guía de Migración](./MIGRATION_GUIDE.md)
- [Patrones de Diseño](./DESIGN_PATTERNS.md)
- [README Principal](../README.md)
