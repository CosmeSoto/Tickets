# Fase 13.2: Diseño de Sistema Unificado de Vistas

**Estado**: En Progreso  
**Fecha Inicio**: 2026-01-23  
**Estimación**: 2-3 días

---

## 🎯 Objetivo

Diseñar un sistema de componentes globales que unifique TODAS las vistas (Lista, Tabla, Tarjetas, Árbol) eliminando código duplicado y estableciendo un estándar profesional consistente.

**Referencia**: Módulo Tickets (⭐⭐⭐⭐⭐)

---

## 📊 Análisis de Componentes Actuales

### ✅ Componentes que FUNCIONAN BIEN

#### 1. **DataTable UI** (`src/components/ui/data-table.tsx`)
- ✅ Paginación integrada DENTRO del Card
- ✅ Búsqueda con debounce
- ✅ Filtros avanzados
- ✅ Cambio de vista (tabla/tarjetas)
- ✅ Estados: loading, error, empty
- ✅ Acciones por fila
- ✅ Ordenamiento
- **Problema**: Demasiado específico, difícil de reutilizar

#### 2. **DataTable Common** (`src/components/common/views/data-table.tsx`)
- ✅ Ordenamiento con iconos
- ✅ Selección múltiple
- ✅ Loading skeleton
- ✅ Empty state
- **Problema**: NO tiene paginación, NO tiene búsqueda

#### 3. **ListView Common** (`src/components/common/views/list-view.tsx`)
- ✅ Loading skeleton
- ✅ Empty state
- ✅ Dividers opcionales
- **Problema**: NO tiene headers, NO tiene paginación

#### 4. **CardGrid Common** (`src/components/common/views/card-grid.tsx`)
- ✅ Grid responsive
- ✅ Loading skeleton
- ✅ Empty state
- **Problema**: NO tiene headers, NO tiene paginación

### ❌ Componentes DUPLICADOS (a eliminar)

1. **CategoryListView** - Reimplementa ListView con lógica específica
2. **CategoryTableCompact** - Reimplementa DataTable con HTML table
3. **DepartmentList** - Reimplementa ListView
4. **DepartmentTable** - Reimplementa DataTable

---

## 🏗️ Arquitectura del Sistema Unificado

```
┌─────────────────────────────────────────────────────────────┐
│                      ViewContainer                          │
│  - Estructura automática (Card + Header + Content)         │
│  - Paginación integrada                                     │
│  - Estados globales (loading, error, empty)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ usa
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Componentes de Vista                      │
├─────────────────┬─────────────────┬─────────────────────────┤
│   DataTable     │    ListView     │      CardView           │
│   (mejorado)    │   (mejorado)    │      (NUEVO)            │
│                 │                 │                         │
│ - Columnas      │ - Vertical      │ - Grid responsive       │
│ - Ordenamiento  │ - Compacto      │ - Renderizado custom    │
│ - Selección     │ - Dividers      │ - Estadísticas          │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## 🎨 Diseño de Componentes

### 1. **ViewContainer** (NUEVO)

**Propósito**: Contenedor unificado que proporciona estructura automática

```typescript
interface ViewContainerProps<T> {
  // Datos
  data: T[]
  loading?: boolean
  error?: string | null
  
  // Header
  title?: string
  description?: string
  icon?: ReactNode
  actions?: ReactNode
  
  // Vista
  viewType: 'table' | 'list' | 'cards' | 'tree'
  viewMode?: 'table' | 'cards' // Para cambio de vista
  onViewModeChange?: (mode: 'table' | 'cards') => void
  
  // Renderizado
  renderTable?: (data: T[]) => ReactNode
  renderList?: (data: T[]) => ReactNode
  renderCards?: (data: T[]) => ReactNode
  renderTree?: (data: T[]) => ReactNode
  
  // Paginación
  pagination?: {
    page: number
    limit: number
    total: number
    onPageChange: (page: number) => void
    onLimitChange: (limit: number) => void
  }
  
  // Búsqueda y filtros
  searchable?: boolean
  searchPlaceholder?: string
  filters?: Filter[]
  onFiltersChange?: (filters: Record<string, string>) => void
  
  // Empty state
  emptyState?: {
    icon?: ReactNode
    title: string
    description: string
    action?: ReactNode
  }
  
  // Callbacks
  onRefresh?: () => void
}
```

**Características**:
- ✅ Header descriptivo SIEMPRE visible
- ✅ Paginación DENTRO del Card con `border-t pt-4`
- ✅ Estructura `space-y-4` consistente
- ✅ Estados automáticos (loading, error, empty)
- ✅ Búsqueda y filtros integrados

**Ejemplo de uso**:
```tsx
<ViewContainer
  data={categories}
  loading={loading}
  title="Categorías"
  description="Gestión de categorías del sistema"
  icon={<FolderTree />}
  viewType="list"
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  renderList={(data) => (
    <ListView
      data={data}
      renderItem={(cat) => <CategoryListItem category={cat} />}
    />
  )}
  renderCards={(data) => (
    <CardView
      data={data}
      renderCard={(cat) => <CategoryCard category={cat} />}
    />
  )}
  pagination={pagination}
  searchable
  onRefresh={loadCategories}
/>
```

---

### 2. **DataTable Mejorado**

**Cambios**:
1. ✅ Agregar header descriptivo obligatorio
2. ✅ Paginación DENTRO del Card
3. ✅ Simplificar props (eliminar duplicados)
4. ✅ Mejor tipado TypeScript

```typescript
interface DataTableProps<T> {
  // Datos
  data: T[]
  columns: Column<T>[]
  
  // Header (NUEVO - obligatorio)
  header: {
    title: string
    description?: string
    icon?: ReactNode
  }
  
  // Interacción
  onRowClick?: (item: T) => void
  rowActions?: (item: T) => ReactNode
  
  // Selección
  selectable?: boolean
  selectedItems?: T[]
  onSelectionChange?: (selected: T[]) => void
  
  // Ordenamiento
  sortable?: boolean
  defaultSort?: { key: keyof T; direction: 'asc' | 'desc' }
  
  // Estados
  loading?: boolean
  emptyState?: EmptyState
  
  // Paginación (DENTRO del Card)
  pagination?: PaginationConfig
}
```

---

### 3. **ListView Mejorado**

**Cambios**:
1. ✅ Agregar header descriptivo
2. ✅ Agregar paginación integrada
3. ✅ Mejor manejo de eventos

```typescript
interface ListViewProps<T> {
  // Datos
  data: T[]
  renderItem: (item: T, index: number) => ReactNode
  
  // Header (NUEVO)
  header: {
    title: string
    description?: string
    icon?: ReactNode
  }
  
  // Interacción
  onItemClick?: (item: T) => void
  
  // Estilo
  dividers?: boolean
  compact?: boolean
  
  // Estados
  loading?: boolean
  emptyState?: EmptyState
  
  // Paginación (NUEVO)
  pagination?: PaginationConfig
}
```

---

### 4. **CardView** (NUEVO - Unifica TicketStatsCard + TechnicianStatsCard)

**Propósito**: Grid de tarjetas con renderizado personalizado

```typescript
interface CardViewProps<T> {
  // Datos
  data: T[]
  renderCard: (item: T, index: number) => ReactNode
  
  // Header (NUEVO)
  header: {
    title: string
    description?: string
    icon?: ReactNode
  }
  
  // Grid
  columns?: 1 | 2 | 3 | 4
  gap?: 2 | 3 | 4 | 6
  
  // Interacción
  onCardClick?: (item: T) => void
  
  // Estados
  loading?: boolean
  loadingCount?: number
  emptyState?: EmptyState
  
  // Paginación (NUEVO)
  pagination?: PaginationConfig
}
```

**Características**:
- ✅ Grid responsive automático
- ✅ Loading skeleton inteligente
- ✅ Paginación integrada
- ✅ Header descriptivo

---

## 📐 Estándares de Diseño

### Headers Consistentes

**Formato estándar**:
```tsx
<div className="border-b pb-2 mb-4">
  <div className="flex items-center space-x-2 mb-1">
    {icon && <div className="text-muted-foreground">{icon}</div>}
    <h3 className="text-sm font-medium text-foreground">{title}</h3>
  </div>
  {description && (
    <p className="text-xs text-muted-foreground">{description}</p>
  )}
</div>
```

**Ejemplos por vista**:
- **Lista**: "Vista de Lista - Información compacta y vertical"
- **Tabla**: "Vista de Tabla - Datos en columnas con ordenamiento"
- **Tarjetas**: "Vista de Tarjetas - Información visual destacada"
- **Árbol**: "Vista de Árbol - Jerarquía con niveles de indentación"

### Paginación Integrada

**Estructura estándar**:
```tsx
<Card>
  <CardHeader>
    {/* Header descriptivo */}
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Contenido de la vista */}
    <div>{/* Lista, Tabla, Tarjetas, etc. */}</div>
    
    {/* Paginación DENTRO del Card */}
    {pagination && (
      <div className="border-t pt-4">
        <Pagination {...pagination} />
      </div>
    )}
  </CardContent>
</Card>
```

### Espaciado Consistente

- **Entre secciones**: `space-y-4`
- **Separador paginación**: `border-t pt-4`
- **Header**: `border-b pb-2 mb-4`
- **Padding Card**: `p-4` o `p-6` (según densidad)

---

## 🎯 Tipos Compartidos

```typescript
// src/types/views.ts

export interface ViewHeader {
  title: string
  description?: string
  icon?: ReactNode
}

export interface PaginationConfig {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  options?: number[] // [10, 20, 50, 100]
}

export interface EmptyState {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export interface Column<T> {
  key: keyof T | string
  label: string
  render?: (item: T) => ReactNode
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
}

export interface Filter {
  key: string
  label: string
  type: 'select' | 'input' | 'date'
  options?: { value: string; label: string }[]
  placeholder?: string
}
```

---

## 📋 Plan de Implementación

### Paso 1: Crear tipos compartidos
- [ ] Crear `src/types/views.ts`
- [ ] Definir interfaces comunes
- [ ] Exportar tipos

### Paso 2: Crear ViewContainer
- [ ] Implementar `src/components/common/views/view-container.tsx`
- [ ] Agregar header automático
- [ ] Integrar paginación
- [ ] Manejar estados (loading, error, empty)

### Paso 3: Mejorar DataTable
- [ ] Actualizar `src/components/common/views/data-table.tsx`
- [ ] Agregar header obligatorio
- [ ] Integrar paginación dentro del Card
- [ ] Simplificar props

### Paso 4: Mejorar ListView
- [ ] Actualizar `src/components/common/views/list-view.tsx`
- [ ] Agregar header
- [ ] Integrar paginación
- [ ] Mejorar accesibilidad

### Paso 5: Crear CardView
- [ ] Implementar `src/components/common/views/card-view.tsx`
- [ ] Grid responsive
- [ ] Header integrado
- [ ] Paginación integrada

### Paso 6: Crear prototipos
- [ ] Prototipo Categorías con ViewContainer
- [ ] Prototipo Departamentos con ViewContainer
- [ ] Comparar con implementación actual

---

## ✅ Criterios de Éxito

1. ✅ Todos los componentes tienen headers descriptivos
2. ✅ Paginación DENTRO del Card en todos los módulos
3. ✅ Estructura `space-y-4` consistente
4. ✅ Código duplicado reducido en ~550 LOC
5. ✅ TypeScript sin errores
6. ✅ Tests unitarios para componentes nuevos
7. ✅ Documentación con ejemplos

---

## 📝 Notas

- **Referencia**: Módulo Tickets es el estándar
- **No romper**: Mantener compatibilidad con módulos existentes
- **Migración gradual**: Implementar primero, migrar después
- **Testing**: Probar cada componente antes de migrar

---

**Siguiente**: Fase 13.3 - Implementación de Componentes
