# Guía de Uso de Componentes Globales

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Hooks Globales](#hooks-globales)
3. [Componentes de Vista](#componentes-de-vista)
4. [Componentes de Filtros](#componentes-de-filtros)
5. [Componentes de Acciones](#componentes-de-acciones)
6. [Componentes de Layout](#componentes-de-layout)
7. [Componentes de Estadísticas](#componentes-de-estadísticas)
8. [Ejemplos Completos](#ejemplos-completos)

## Introducción

Este documento describe cómo usar los componentes globales del sistema de estandarización de UI. Estos componentes están diseñados para ser reutilizables, consistentes y fáciles de mantener.

### Principios de Diseño

- **Reutilizabilidad**: Todos los componentes son genéricos y configurables
- **Consistencia**: Mismo diseño visual en todos los módulos
- **Simplicidad**: API clara y fácil de usar
- **TypeScript**: Tipos estrictos para mejor DX
- **Accesibilidad**: Cumple con WCAG 2.1 AA

### Ubicación de Componentes

```
src/
├── components/common/       # Componentes globales
│   ├── views/              # ListView, DataTable, CardView, ViewContainer
│   ├── filters/            # FilterBar, SearchInput, SelectFilter
│   ├── actions/            # ActionBar, Pagination
│   ├── layout/             # ModuleLayout
│   └── stats/              # StatsBar
├── hooks/common/           # Hooks globales
│   ├── useFilters.ts
│   ├── useViewMode.ts
│   ├── usePagination.ts
│   └── useModuleData.ts
└── types/                  # Tipos compartidos
    ├── views.ts
    └── common.ts
```

## Hooks Globales

### useFilters

Hook para filtrar datos de forma genérica.

**Importación:**
```typescript
import { useFilters } from '@/hooks/common'
```

**Firma:**
```typescript
function useFilters<T>(
  data: T[],
  config: FilterConfig<T>[],
  options?: {
    debounceMs?: number
    persistInUrl?: boolean
    onFilterChange?: (filters: Record<string, any>) => void
  }
): {
  filteredData: T[]
  filters: Record<string, any>
  setFilter: (id: string, value: any) => void
  clearFilters: () => void
  clearFilter: (id: string) => void
  activeFiltersCount: number
}
```

**Ejemplo:**
```typescript
const filterConfig: FilterConfig<Technician>[] = [
  {
    id: 'search',
    type: 'search',
    label: 'Buscar',
    searchFields: ['name', 'email', 'phone'],
    placeholder: 'Buscar técnico...'
  },
  {
    id: 'department',
    type: 'select',
    label: 'Departamento',
    field: 'departmentId',
    options: departments.map(d => ({ value: d.id, label: d.name }))
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
]

const { filteredData, filters, setFilter, clearFilters } = useFilters(
  technicians,
  filterConfig,
  { debounceMs: 300 }
)
```

### useViewMode

Hook para manejar el cambio entre vistas (cards, list, table).

**Importación:**
```typescript
import { useViewMode } from '@/hooks/common'
```

**Firma:**
```typescript
function useViewMode(
  defaultMode: ViewMode = 'list',
  options?: {
    storageKey?: string
    availableModes?: ViewMode[]
    responsive?: boolean
  }
): {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  availableModes: ViewMode[]
}
```

**Ejemplo:**
```typescript
const { viewMode, setViewMode } = useViewMode('cards', {
  storageKey: 'technicians-view',
  availableModes: ['cards', 'list'],
  responsive: true
})
```

### usePagination

Hook para paginar datos.

**Importación:**
```typescript
import { usePagination } from '@/hooks/common'
```

**Firma:**
```typescript
function usePagination<T>(
  data: T[],
  options?: {
    initialPage?: number
    initialItemsPerPage?: number
    persistInUrl?: boolean
  }
): {
  paginatedData: T[]
  currentPage: number
  totalPages: number
  itemsPerPage: number
  totalItems: number
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  setItemsPerPage: (count: number) => void
  hasNextPage: boolean
  hasPrevPage: boolean
}
```

**Ejemplo:**
```typescript
const pagination = usePagination(filteredData, {
  initialItemsPerPage: 12,
  persistInUrl: true
})
```

### useModuleData

Hook genérico para cargar y gestionar datos de un módulo.

**Importación:**
```typescript
import { useModuleData } from '@/hooks/common'
```

**Firma:**
```typescript
function useModuleData<T>(
  endpoint: string,
  options?: {
    autoLoad?: boolean
    onSuccess?: (data: T[]) => void
    onError?: (error: string) => void
  }
): {
  data: T[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (item: Partial<T>) => Promise<{ success: boolean; data?: T; error?: string }>
  update: (id: string, item: Partial<T>) => Promise<{ success: boolean; data?: T; error?: string }>
  delete: (id: string) => Promise<{ success: boolean; error?: string }>
}
```

**Ejemplo:**
```typescript
const { data, loading, error, reload, create, update, delete: deleteTech } = 
  useModuleData<Technician>('/api/technicians')
```

## Componentes de Vista

### ListView

Componente para mostrar datos en formato de lista compacta.

**Importación:**
```typescript
import { ListView } from '@/components/common/views'
```

**Props:**
```typescript
interface ListViewProps<T> {
  data: T[]
  renderItem: (item: T) => React.ReactNode
  onItemClick?: (item: T) => void
  emptyState?: React.ReactNode
  loading?: boolean
  header?: ViewHeader
  pagination?: PaginationConfig
}
```

**Ejemplo:**
```typescript
<ListView
  data={paginatedData}
  header={{
    title: 'Vista de Lista',
    description: 'Información compacta de técnicos'
  }}
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
      <Badge>{tech.department?.name}</Badge>
    </div>
  )}
  onItemClick={(tech) => router.push(`/admin/technicians/${tech.id}`)}
  pagination={pagination}
/>
```

### DataTable

Componente para mostrar datos en formato de tabla con ordenamiento.

**Importación:**
```typescript
import { DataTable } from '@/components/common/views'
```

**Props:**
```typescript
interface DataTableProps<T> {
  data: T[]
  columns: ColumnConfig<T>[]
  onRowClick?: (item: T) => void
  selectable?: boolean
  onSelectionChange?: (selected: T[]) => void
  sortable?: boolean
  emptyState?: React.ReactNode
  loading?: boolean
  header?: ViewHeader
  pagination?: PaginationConfig
}
```

**Ejemplo:**
```typescript
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

<DataTable
  data={paginatedData}
  columns={columns}
  header={{
    title: 'Vista de Tabla',
    description: 'Información detallada de técnicos'
  }}
  sortable
  onRowClick={(tech) => router.push(`/admin/technicians/${tech.id}`)}
  pagination={pagination}
/>
```

### CardView

Componente para mostrar datos en formato de tarjetas (grid).

**Importación:**
```typescript
import { CardView } from '@/components/common/views'
```

**Props:**
```typescript
interface CardViewProps<T> {
  data: T[]
  renderCard: (item: T) => React.ReactNode
  columns?: GridConfig
  gap?: number
  emptyState?: React.ReactNode
  loading?: boolean
  header?: ViewHeader
  pagination?: PaginationConfig
}
```

**Ejemplo:**
```typescript
<CardView
  data={paginatedData}
  header={{
    title: 'Vista de Tarjetas',
    description: 'Información visual de técnicos'
  }}
  columns={{ sm: 1, md: 2, lg: 3, xl: 4 }}
  renderCard={(tech) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center space-x-3 mb-3">
          <Avatar>
            <AvatarFallback>{tech.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{tech.name}</h3>
            <p className="text-sm text-muted-foreground">{tech.email}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center text-sm">
            <Building className="h-4 w-4 mr-2" />
            {tech.department?.name}
          </div>
          <div className="flex items-center text-sm">
            <Phone className="h-4 w-4 mr-2" />
            {tech.phone}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t">
          <Badge variant={tech.isActive ? 'default' : 'secondary'}>
            {tech.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )}
  pagination={pagination}
/>
```

### ViewContainer

Contenedor unificado que maneja automáticamente headers y paginación.

**Importación:**
```typescript
import { ViewContainer } from '@/components/common/views'
```

**Props:**
```typescript
interface ViewContainerProps {
  header?: ViewHeader
  pagination?: PaginationConfig
  children: React.ReactNode
}
```

**Ejemplo:**
```typescript
<ViewContainer
  header={{
    title: 'Vista de Lista',
    description: 'Información compacta'
  }}
  pagination={pagination}
>
  {/* Contenido de la vista */}
</ViewContainer>
```

## Componentes de Filtros

### FilterBar

Barra de filtros reutilizable con búsqueda y filtros configurables.

**Importación:**
```typescript
import { FilterBar } from '@/components/common/filters'
```

**Props:**
```typescript
interface FilterBarProps<T> {
  config: FilterConfig<T>[]
  filters: Record<string, any>
  onFilterChange: (id: string, value: any) => void
  onClearFilters: () => void
  loading?: boolean
  onRefresh?: () => void
  stats?: Stat[]
}
```

**Ejemplo:**
```typescript
<FilterBar
  config={filterConfig}
  filters={filters}
  onFilterChange={setFilter}
  onClearFilters={clearFilters}
  onRefresh={reload}
  loading={loading}
  stats={[
    { label: 'Total', value: data.length, color: 'blue' },
    { label: 'Activos', value: activeCount, color: 'green' },
    { label: 'Inactivos', value: inactiveCount, color: 'gray' }
  ]}
/>
```

### SearchInput

Input de búsqueda con debounce y botón de limpiar.

**Importación:**
```typescript
import { SearchInput } from '@/components/common/filters'
```

**Props:**
```typescript
interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
}
```

### SelectFilter

Select estilizado para filtros.

**Importación:**
```typescript
import { SelectFilter } from '@/components/common/filters'
```

**Props:**
```typescript
interface SelectFilterProps {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  label?: string
  placeholder?: string
}
```

## Componentes de Acciones

### ActionBar

Barra de acciones consistente con botón primario y secundarios.

**Importación:**
```typescript
import { ActionBar } from '@/components/common/actions'
```

**Props:**
```typescript
interface ActionBarProps {
  primaryAction?: {
    label: string
    icon?: React.ReactNode
    onClick: () => void
  }
  secondaryActions?: Array<{
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: 'default' | 'outline' | 'ghost'
  }>
}
```

**Ejemplo:**
```typescript
<ActionBar
  primaryAction={{
    label: 'Crear Técnico',
    icon: <Plus className="h-4 w-4" />,
    onClick: () => setShowCreate(true)
  }}
  secondaryActions={[
    {
      label: 'Exportar',
      icon: <Download className="h-4 w-4" />,
      onClick: handleExport,
      variant: 'outline'
    }
  ]}
/>
```

### Pagination

Componente de paginación consistente.

**Importación:**
```typescript
import { Pagination } from '@/components/common/actions'
```

**Props:**
```typescript
interface PaginationProps {
  currentPage: number
  totalPages: number
  itemsPerPage: number
  totalItems: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (count: number) => void
  showItemsPerPage?: boolean
  showInfo?: boolean
}
```

**Ejemplo:**
```typescript
<Pagination
  currentPage={pagination.currentPage}
  totalPages={pagination.totalPages}
  itemsPerPage={pagination.itemsPerPage}
  totalItems={pagination.totalItems}
  onPageChange={pagination.goToPage}
  onItemsPerPageChange={pagination.setItemsPerPage}
  showItemsPerPage
  showInfo
/>
```

## Componentes de Layout

### ModuleLayout

Layout estándar para módulos administrativos.

**Importación:**
```typescript
import { ModuleLayout } from '@/components/common/layout'
```

**Props:**
```typescript
interface ModuleLayoutProps {
  title: string
  subtitle?: string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  primaryAction?: {
    label: string
    onClick: () => void
  }
  children: React.ReactNode
}
```

**Ejemplo:**
```typescript
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
  {/* Contenido del módulo */}
</ModuleLayout>
```

## Componentes de Estadísticas

### StatsBar

Barra de estadísticas con badges de colores.

**Importación:**
```typescript
import { StatsBar } from '@/components/common/stats'
```

**Props:**
```typescript
interface StatsBarProps {
  stats: Stat[]
  columns?: number
}

interface Stat {
  label: string
  value: number | string
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'red' | 'gray'
  icon?: React.ReactNode
  onClick?: () => void
}
```

**Ejemplo:**
```typescript
<StatsBar
  stats={[
    {
      label: 'Total',
      value: data.length,
      color: 'blue',
      icon: <Users className="h-4 w-4" />
    },
    {
      label: 'Activos',
      value: activeCount,
      color: 'green',
      icon: <CheckCircle className="h-4 w-4" />
    },
    {
      label: 'Inactivos',
      value: inactiveCount,
      color: 'gray',
      icon: <XCircle className="h-4 w-4" />
    },
    {
      label: 'Por Departamento',
      value: departmentCount,
      color: 'purple',
      icon: <Building className="h-4 w-4" />
    }
  ]}
  columns={4}
/>
```

## Ejemplos Completos

### Ejemplo 1: Módulo Básico con Lista

```typescript
'use client'

import { useState } from 'react'
import { ModuleLayout } from '@/components/common/layout'
import { FilterBar } from '@/components/common/filters'
import { ListView } from '@/components/common/views'
import { useModuleData, useFilters, usePagination } from '@/hooks/common'
import type { Technician, FilterConfig } from '@/types'

export default function TechniciansPage() {
  // 1. Cargar datos
  const { data, loading, error, reload } = useModuleData<Technician>('/api/technicians')
  
  // 2. Configurar filtros
  const filterConfig: FilterConfig<Technician>[] = [
    {
      id: 'search',
      type: 'search',
      label: 'Buscar',
      searchFields: ['name', 'email'],
      placeholder: 'Buscar técnico...'
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
  ]
  
  // 3. Aplicar filtros
  const { filteredData, filters, setFilter, clearFilters } = useFilters(
    data,
    filterConfig
  )
  
  // 4. Aplicar paginación
  const pagination = usePagination(filteredData, { initialItemsPerPage: 10 })
  
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
      />
      
      <ListView
        data={pagination.paginatedData}
        renderItem={(tech) => (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{tech.name}</p>
              <p className="text-sm text-muted-foreground">{tech.email}</p>
            </div>
            <Badge>{tech.department?.name}</Badge>
          </div>
        )}
        pagination={pagination}
      />
    </ModuleLayout>
  )
}
```

### Ejemplo 2: Módulo Completo con Múltiples Vistas

```typescript
'use client'

import { useState, useMemo } from 'react'
import { ModuleLayout } from '@/components/common/layout'
import { FilterBar } from '@/components/common/filters'
import { ViewToggle } from '@/components/common/views'
import { ListView, DataTable, CardView } from '@/components/common/views'
import { StatsBar } from '@/components/common/stats'
import { useModuleData, useFilters, useViewMode, usePagination } from '@/hooks/common'
import type { Technician, FilterConfig, ColumnConfig } from '@/types'

export default function TechniciansPage() {
  const [showCreate, setShowCreate] = useState(false)
  
  // 1. Cargar datos
  const { data, loading, error, reload } = useModuleData<Technician>('/api/technicians')
  
  // 2. Configurar filtros
  const filterConfig: FilterConfig<Technician>[] = [
    {
      id: 'search',
      type: 'search',
      label: 'Buscar',
      searchFields: ['name', 'email', 'phone'],
      placeholder: 'Buscar técnico...'
    },
    {
      id: 'department',
      type: 'select',
      label: 'Departamento',
      field: 'departmentId',
      options: [
        { value: 'all', label: 'Todos' },
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
  ]
  
  // 3. Aplicar filtros
  const { filteredData, filters, setFilter, clearFilters } = useFilters(
    data,
    filterConfig,
    { debounceMs: 300 }
  )
  
  // 4. Aplicar paginación
  const pagination = usePagination(filteredData, { initialItemsPerPage: 12 })
  
  // 5. Manejar vista
  const { viewMode, setViewMode } = useViewMode('cards', {
    storageKey: 'technicians-view',
    availableModes: ['cards', 'list', 'table']
  })
  
  // 6. Calcular estadísticas
  const stats = useMemo(() => [
    { label: 'Total', value: data.length, color: 'blue' as const },
    { label: 'Activos', value: data.filter(t => t.isActive).length, color: 'green' as const },
    { label: 'Inactivos', value: data.filter(t => !t.isActive).length, color: 'gray' as const }
  ], [data])
  
  // 7. Configurar columnas para tabla
  const columns: ColumnConfig<Technician>[] = [
    { id: 'name', header: 'Nombre', accessor: 'name', sortable: true },
    { id: 'email', header: 'Email', accessor: 'email' },
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
  ]
  
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
      <FilterBar
        config={filterConfig}
        filters={filters}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
        onRefresh={reload}
        stats={stats}
      />
      
      <ViewToggle
        mode={viewMode}
        availableModes={['cards', 'list', 'table']}
        onChange={setViewMode}
      />
      
      {viewMode === 'cards' && (
        <CardView
          data={pagination.paginatedData}
          renderCard={(tech) => <TechnicianCard technician={tech} />}
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

## Mejores Prácticas

### 1. Siempre usa TypeScript

```typescript
// ✅ Bueno
const { data, loading } = useModuleData<Technician>('/api/technicians')

// ❌ Malo
const { data, loading } = useModuleData('/api/technicians')
```

### 2. Memoiza configuraciones

```typescript
// ✅ Bueno
const filterConfig = useMemo(() => [...], [dependencies])

// ❌ Malo
const filterConfig = [...] // Se recrea en cada render
```

### 3. Usa debounce para búsquedas

```typescript
// ✅ Bueno
const { filteredData } = useFilters(data, config, { debounceMs: 300 })

// ❌ Malo
const { filteredData } = useFilters(data, config) // Sin debounce
```

### 4. Persiste preferencias del usuario

```typescript
// ✅ Bueno
const { viewMode } = useViewMode('cards', { storageKey: 'module-view' })

// ❌ Malo
const [viewMode, setViewMode] = useState('cards') // Se pierde al recargar
```

### 5. Maneja estados de carga y error

```typescript
// ✅ Bueno
<ModuleLayout loading={loading} error={error} onRetry={reload}>
  {/* contenido */}
</ModuleLayout>

// ❌ Malo
{loading ? <Spinner /> : <Content />} // Inconsistente
```

## Solución de Problemas

### Problema: Los filtros no funcionan

**Solución:** Verifica que los `searchFields` coincidan con las propiedades del tipo:

```typescript
// ✅ Correcto
searchFields: ['name', 'email'] as (keyof Technician)[]

// ❌ Incorrecto
searchFields: ['nombre', 'correo'] // Propiedades no existen
```

### Problema: La paginación no se actualiza

**Solución:** Asegúrate de pasar los datos filtrados a `usePagination`:

```typescript
// ✅ Correcto
const pagination = usePagination(filteredData)

// ❌ Incorrecto
const pagination = usePagination(data) // Ignora filtros
```

### Problema: La vista no persiste

**Solución:** Proporciona un `storageKey` único:

```typescript
// ✅ Correcto
useViewMode('cards', { storageKey: 'technicians-view' })

// ❌ Incorrecto
useViewMode('cards') // Sin persistencia
```

## Recursos Adicionales

- [Guía de Migración](./MIGRATION_GUIDE.md)
- [Patrones de Diseño](./DESIGN_PATTERNS.md)
- [Ejemplos de Código](./EXAMPLES.md)
- [README Principal](../README.md)
