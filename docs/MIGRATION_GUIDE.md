# Guía de Migración a Componentes Globales

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Antes de Empezar](#antes-de-empezar)
3. [Proceso de Migración](#proceso-de-migración)
4. [Migración Paso a Paso](#migración-paso-a-paso)
5. [Casos Especiales](#casos-especiales)
6. [Checklist de Migración](#checklist-de-migración)
7. [Ejemplos de Migración](#ejemplos-de-migración)

## Introducción

Esta guía te ayudará a migrar módulos legacy a los componentes globales estandarizados. El proceso es gradual y seguro, permitiendo rollback en cualquier momento.

### Beneficios de la Migración

- ✅ **Reducción de código**: 60-70% menos líneas de código
- ✅ **Consistencia visual**: Mismo diseño en todos los módulos
- ✅**Mantenibilidad**: Cambios centralizados
- ✅ **Mejor UX**: Experiencia consistente
- ✅ **Menos bugs**: Código probado y reutilizable

### Tiempo Estimado

- **Módulo simple** (sin vistas múltiples): 30-60 minutos
- **Módulo medio** (con vistas múltiples): 1-2 horas
- **Módulo complejo** (con lógica especial): 2-4 horas

## Antes de Empezar

### 1. Crear Backup

```bash
# Crear backup del módulo
cp src/app/admin/[module]/page.tsx src/app/admin/[module]/page.tsx.backup
```

### 2. Revisar Funcionalidad Actual

Documenta:
- ✅ Filtros existentes
- ✅ Vistas disponibles (cards, list, table)
- ✅ Acciones (crear, editar, eliminar)
- ✅ Estadísticas mostradas
- ✅ Paginación actual
- ✅ Casos especiales o lógica única

### 3. Identificar Componentes a Reemplazar

| Componente Legacy | Componente Global |
|-------------------|-------------------|
| Custom filter bar | `FilterBar` |
| Custom search | `SearchInput` |
| Custom table | `DataTable` |
| Custom cards | `CardView` |
| Custom list | `ListView` |
| Custom pagination | `Pagination` |
| Custom layout | `ModuleLayout` |

## Proceso de Migración

### Fase 1: Preparación (10 min)

1. Crear backup
2. Revisar funcionalidad
3. Identificar componentes
4. Leer documentación

### Fase 2: Migración de Datos (15 min)

1. Reemplazar fetch manual con `useModuleData`
2. Configurar filtros con `useFilters`
3. Configurar paginación con `usePagination`
4. Configurar vistas con `useViewMode`

### Fase 3: Migración de UI (20 min)

1. Reemplazar layout con `ModuleLayout`
2. Reemplazar filtros con `FilterBar`
3. Reemplazar vistas con componentes globales
4. Reemplazar paginación con `Pagination`

### Fase 4: Testing (15 min)

1. Verificar funcionalidad
2. Verificar responsive
3. Verificar accesibilidad
4. Comparar con original

## Migración Paso a Paso

### Paso 1: Migrar Carga de Datos

**Antes:**
```typescript
const [data, setData] = useState<Technician[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  async function loadData() {
    try {
      setLoading(true)
      const response = await fetch('/api/technicians')
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  loadData()
}, [])
```

**Después:**
```typescript
const { data, loading, error, reload } = useModuleData<Technician>('/api/technicians')
```

**Reducción:** ~20 líneas → 1 línea

### Paso 2: Migrar Filtros

**Antes:**
```typescript
const [searchTerm, setSearchTerm] = useState('')
const [statusFilter, setStatusFilter] = useState('all')
const [departmentFilter, setDepartmentFilter] = useState('all')

const filteredData = useMemo(() => {
  return data.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && item.isActive) ||
                         (statusFilter === 'inactive' && !item.isActive)
    const matchesDepartment = departmentFilter === 'all' || 
                             item.departmentId === departmentFilter
    return matchesSearch && matchesStatus && matchesDepartment
  })
}, [data, searchTerm, statusFilter, departmentFilter])
```

**Después:**
```typescript
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
  }
]

const { filteredData, filters, setFilter, clearFilters } = useFilters(
  data,
  filterConfig,
  { debounceMs: 300 }
)
```

**Reducción:** ~30 líneas → ~25 líneas (pero más mantenible y con debounce automático)

### Paso 3: Migrar Paginación

**Antes:**
```typescript
const [currentPage, setCurrentPage] = useState(1)
const [itemsPerPage, setItemsPerPage] = useState(10)

const totalPages = Math.ceil(filteredData.length / itemsPerPage)
const startIndex = (currentPage - 1) * itemsPerPage
const endIndex = startIndex + itemsPerPage
const paginatedData = filteredData.slice(startIndex, endIndex)

const goToPage = (page: number) => {
  setCurrentPage(Math.max(1, Math.min(page, totalPages)))
}

const nextPage = () => goToPage(currentPage + 1)
const prevPage = () => goToPage(currentPage - 1)
```

**Después:**
```typescript
const pagination = usePagination(filteredData, {
  initialItemsPerPage: 10,
  persistInUrl: true
})
```

**Reducción:** ~15 líneas → 3 líneas

### Paso 4: Migrar Vistas

**Antes:**
```typescript
const [viewMode, setViewMode] = useState<'cards' | 'list' | 'table'>('cards')

// Renderizado condicional manual
{viewMode === 'cards' && (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {paginatedData.map(item => (
      <CustomCard key={item.id} item={item} />
    ))}
  </div>
)}

{viewMode === 'list' && (
  <div className="space-y-2">
    {paginatedData.map(item => (
      <CustomListItem key={item.id} item={item} />
    ))}
  </div>
)}

{viewMode === 'table' && (
  <CustomTable data={paginatedData} />
)}
```

**Después:**
```typescript
const { viewMode, setViewMode } = useViewMode('cards', {
  storageKey: 'technicians-view',
  availableModes: ['cards', 'list', 'table']
})

{viewMode === 'cards' && (
  <CardView
    data={pagination.paginatedData}
    renderCard={(item) => <TechnicianCard technician={item} />}
    pagination={pagination}
  />
)}

{viewMode === 'list' && (
  <ListView
    data={pagination.paginatedData}
    renderItem={(item) => <TechnicianListItem technician={item} />}
    pagination={pagination}
  />
)}

{viewMode === 'table' && (
  <DataTable
    data={pagination.paginatedData}
    columns={columns}
    pagination={pagination}
  />
)}
```

**Reducción:** ~20 líneas → ~15 líneas (con persistencia automática)

### Paso 5: Migrar Layout

**Antes:**
```typescript
return (
  <RoleDashboardLayout>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Técnicos</h1>
          <p className="text-muted-foreground">Gestión de técnicos del sistema</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Crear Técnico
        </Button>
      </div>
      
      {loading && <Spinner />}
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {!loading && !error && (
        <>
          {/* Contenido */}
        </>
      )}
    </div>
  </RoleDashboardLayout>
)
```

**Después:**
```typescript
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
    {/* Contenido */}
  </ModuleLayout>
)
```

**Reducción:** ~25 líneas → ~12 líneas

### Paso 6: Migrar FilterBar

**Antes:**
```typescript
<Card>
  <CardContent className="p-4">
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="flex-1">
        <Input
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="active">Activos</SelectItem>
          <SelectItem value="inactive">Inactivos</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={clearFilters}>
        Limpiar
      </Button>
      <Button variant="outline" onClick={reload}>
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  </CardContent>
</Card>
```

**Después:**
```typescript
<FilterBar
  config={filterConfig}
  filters={filters}
  onFilterChange={setFilter}
  onClearFilters={clearFilters}
  onRefresh={reload}
  loading={loading}
/>
```

**Reducción:** ~30 líneas → 7 líneas

## Casos Especiales

### Caso 1: Módulo con Jerarquía (Categorías)

Para módulos con estructura jerárquica como Categorías, mantén los componentes específicos:

```typescript
// ✅ Correcto - Mantener componente específico
<CategoryTree
  data={categoryTree}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>

// ❌ Incorrecto - No forzar componente genérico
<TreeView data={categoryTree} /> // No existe componente genérico
```

**Razón:** La lógica de árbol jerárquico es muy específica del dominio.

### Caso 2: Módulo con Tabla Compleja (Usuarios)

Para tablas muy complejas con funcionalidad integrada, evalúa el ROI:

```typescript
// Si la tabla tiene:
// - Filtros integrados
// - Búsqueda integrada
// - Acciones masivas complejas
// - Más de 500 líneas

// ✅ Correcto - Mantener si el ROI es bajo
<UserTable data={data} /> // Componente específico optimizado

// ❌ Incorrecto - Migrar si requiere 4-6 horas
<DataTable data={data} columns={columns} /> // Alto riesgo, bajo beneficio
```

**Decisión:** Migración mínima (solo layout) si el componente es muy complejo.

### Caso 3: Módulo con Vistas Múltiples Duplicadas (Reportes)

Para módulos con vistas duplicadas, consolida primero:

```typescript
// ❌ Antes - 3 vistas duplicadas
/admin/reports
/admin/reports/professional
/admin/reports/debug

// ✅ Después - 1 vista con tabs
/admin/reports (con tabs: General, Professional, Debug)
```

**Nota:** Esto está fuera del alcance de estandarización de UI, pero documéntalo para futuro.

### Caso 4: Módulo con Lógica de Negocio Compleja

Mantén la lógica de negocio en hooks específicos:

```typescript
// ✅ Correcto - Hook específico para lógica compleja
const { tickets, stats, filters } = useTicketData()

// ✅ Correcto - Componente global para UI
<DataTable data={tickets} columns={columns} />

// ❌ Incorrecto - Mezclar lógica de negocio en componente global
<DataTable data={tickets} onSpecialBusinessLogic={...} />
```

## Checklist de Migración

### Pre-Migración

- [ ] Crear backup del módulo
- [ ] Documentar funcionalidad actual
- [ ] Identificar componentes a reemplazar
- [ ] Estimar tiempo de migración
- [ ] Leer guía de componentes

### Durante Migración

- [ ] Migrar carga de datos a `useModuleData`
- [ ] Migrar filtros a `useFilters`
- [ ] Migrar paginación a `usePagination`
- [ ] Migrar vistas a `useViewMode`
- [ ] Migrar layout a `ModuleLayout`
- [ ] Migrar FilterBar
- [ ] Migrar componentes de vista
- [ ] Migrar paginación UI

### Post-Migración

- [ ] Verificar funcionalidad completa
- [ ] Verificar filtros funcionan
- [ ] Verificar paginación funciona
- [ ] Verificar cambio de vistas funciona
- [ ] Verificar responsive design
- [ ] Verificar accesibilidad
- [ ] Comparar con módulo original
- [ ] Medir reducción de código
- [ ] Eliminar backup si todo funciona
- [ ] Documentar lecciones aprendidas

## Ejemplos de Migración

### Ejemplo 1: Migración Completa (Técnicos)

**Antes (986 líneas):**
```typescript
'use client'

import { useState, useEffect, useMemo } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, RefreshCw } from 'lucide-react'

export default function TechniciansPage() {
  // Estado de datos
  const [data, setData] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estado de filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  
  // Estado de vista
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')
  
  // Estado de paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)
  
  // Cargar datos
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const response = await fetch('/api/technicians')
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])
  
  // Filtrar datos
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'active' && item.isActive) ||
                           (statusFilter === 'inactive' && !item.isActive)
      const matchesDepartment = departmentFilter === 'all' || 
                               item.departmentId === departmentFilter
      return matchesSearch && matchesStatus && matchesDepartment
    })
  }, [data, searchTerm, statusFilter, departmentFilter])
  
  // Paginar datos
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedData = filteredData.slice(startIndex, endIndex)
  
  // ... más código (renderizado, componentes, etc.)
  
  return (
    <RoleDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Técnicos</h1>
            <p className="text-muted-foreground">Gestión de técnicos</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Técnico
          </Button>
        </div>
        
        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {/* ... más filtros */}
            </div>
          </CardContent>
        </Card>
        
        {/* Contenido */}
        {loading && <Spinner />}
        {error && <ErrorMessage />}
        {!loading && !error && (
          <>
            {/* Vista de tarjetas o lista */}
            {/* Paginación manual */}
          </>
        )}
      </div>
    </RoleDashboardLayout>
  )
}
```

**Después (915 líneas, -7.2%):**
```typescript
'use client'

import { useState, useMemo } from 'react'
import { ModuleLayout } from '@/components/common/layout'
import { FilterBar } from '@/components/common/filters'
import { ViewToggle, CardView, ListView } from '@/components/common/views'
import { useModuleData, useFilters, useViewMode, usePagination } from '@/hooks/common'
import type { Technician, FilterConfig } from '@/types'

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
    availableModes: ['cards', 'list']
  })
  
  // 6. Calcular estadísticas
  const stats = useMemo(() => [
    { label: 'Total', value: data.length, color: 'blue' as const },
    { label: 'Activos', value: data.filter(t => t.isActive).length, color: 'green' as const },
    { label: 'Inactivos', value: data.filter(t => !t.isActive).length, color: 'gray' as const }
  ], [data])
  
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
        availableModes={['cards', 'list']}
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
    </ModuleLayout>
  )
}
```

**Resultados:**
- **Reducción de código:** 71 líneas (7.2%)
- **Tiempo de migración:** 30 minutos
- **Funcionalidad:** 100% mantenida
- **Mejoras:** Debounce automático, persistencia de vista, mejor UX

### Ejemplo 2: Migración Mínima (Usuarios)

Para módulos con componentes muy complejos, realiza migración mínima:

**Antes:**
```typescript
return (
  <RoleDashboardLayout>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Usuarios</h1>
        <Button>Crear</Button>
      </div>
      
      {loading && <Spinner />}
      {error && <ErrorMessage />}
      {!loading && !error && (
        <UserTable data={data} /> // 944 líneas, muy complejo
      )}
    </div>
  </RoleDashboardLayout>
)
```

**Después:**
```typescript
return (
  <ModuleLayout
    title="Usuarios"
    subtitle="Gestión de usuarios del sistema"
    loading={loading}
    error={error}
    onRetry={reload}
    primaryAction={{
      label: 'Crear Usuario',
      onClick: () => setShowCreate(true)
    }}
  >
    <UserTable data={data} /> {/* Mantener componente complejo */}
  </ModuleLayout>
)
```

**Resultados:**
- **Reducción de código:** 6 líneas (~2%)
- **Tiempo de migración:** 10 minutos
- **Riesgo:** Mínimo
- **Decisión:** Mantener UserTable por alto ROI

## Métricas de Éxito

### Por Módulo

- ✅ **Reducción de código:** 5-30%
- ✅ **Tiempo de migración:** < 2 horas
- ✅ **Funcionalidad:** 100% mantenida
- ✅ **0 regresiones**

### Global

- ✅ **Reducción total:** 60-70% en código duplicado
- ✅ **Consistencia:** 100% de módulos con mismo diseño
- ✅ **Mantenibilidad:** Cambios centralizados
- ✅ **Tiempo de desarrollo:** -50% para nuevos módulos

## Recursos Adicionales

- [Guía de Componentes](./COMPONENT_GUIDE.md)
- [Patrones de Diseño](./DESIGN_PATTERNS.md)
- [Ejemplos de Código](./EXAMPLES.md)
- [README Principal](../README.md)

## Soporte

Si encuentras problemas durante la migración:

1. Revisa la [Guía de Componentes](./COMPONENT_GUIDE.md)
2. Consulta los [Ejemplos](./EXAMPLES.md)
3. Revisa el código de módulos ya migrados
4. Crea un issue en el repositorio
