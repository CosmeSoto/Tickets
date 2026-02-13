# Guía de Vistas Estandarizadas

**Fecha**: 2026-01-23  
**Versión**: 1.0  
**Estado**: ✅ Completado

---

## 📋 Índice

1. [Introducción](#introducción)
2. [ListView - Vista de Lista](#listview---vista-de-lista)
3. [DataTable - Vista de Tabla](#datatable---vista-de-tabla)
4. [CardView - Vista de Tarjetas](#cardview---vista-de-tarjetas)
5. [TreeView - Vista de Árbol](#treeview---vista-de-árbol)
6. [ViewContainer - Contenedor Unificado](#viewcontainer---contenedor-unificado)
7. [Guía de Selección](#guía-de-selección-cuándo-usar-cada-vista)
8. [Mejores Prácticas](#mejores-prácticas)

---

## 🎯 Introducción

Este documento describe los componentes de vista estandarizados del sistema, proporcionando ejemplos de uso, mejores prácticas y guías para seleccionar la vista apropiada según el caso de uso.

### Componentes Disponibles

| Componente | Propósito | Casos de Uso |
|------------|-----------|--------------|
| **ListView** | Lista vertical compacta | Información simple, navegación rápida |
| **DataTable** | Tabla con columnas | Datos tabulares, comparación, ordenamiento |
| **CardView** | Grid de tarjetas | Información visual, estadísticas, imágenes |
| **TreeView** | Jerarquía de árbol | Datos jerárquicos, categorías multinivel |
| **ViewContainer** | Contenedor unificado | Wrapper para cualquier vista con funcionalidad común |

---

## 📝 ListView - Vista de Lista

### Descripción

Componente para mostrar datos en formato de lista vertical compacta. Ideal para información simple que no requiere múltiples columnas.

### Ubicación

```
src/components/common/views/list-view.tsx
```

### Props

```typescript
interface ListViewProps<T> {
  // Datos
  data: T[]
  renderItem: (item: T, index: number) => ReactNode
  
  // Header
  header?: {
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
  
  // Paginación
  pagination?: PaginationConfig
}
```


### Ejemplo Básico

```tsx
import { ListView } from '@/components/common/views/list-view'

<ListView
  data={categories}
  header={{
    title: "Vista de Lista - Categorías",
    description: "Información compacta de categorías",
    icon: <FolderTree className="h-4 w-4" />
  }}
  renderItem={(category) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div 
          className="w-3 h-3 rounded-full" 
          style={{ backgroundColor: category.color }}
        />
        <div>
          <p className="font-medium">{category.name}</p>
          <p className="text-sm text-muted-foreground">
            {category.description}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Badge variant="outline">
          {category._count.tickets} tickets
        </Badge>
        <Button size="sm" variant="ghost">
          <Edit className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )}
  onItemClick={(category) => handleEdit(category)}
  dividers={true}
  pagination={paginationConfig}
/>
```

### Ejemplo con Selección Múltiple

```tsx
<ListView
  data={departments}
  header={{
    title: "Vista de Lista - Departamentos",
    description: "Selecciona múltiples departamentos"
  }}
  renderItem={(dept, index) => (
    <div className="flex items-center space-x-3">
      <Checkbox
        checked={selectedItems.includes(dept.id)}
        onCheckedChange={() => toggleSelection(dept.id)}
      />
      <Avatar className="h-8 w-8">
        <AvatarFallback style={{ backgroundColor: dept.color }}>
          {dept.name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="font-medium">{dept.name}</p>
        <p className="text-sm text-muted-foreground">
          {dept._count.technicians} técnicos
        </p>
      </div>
    </div>
  )}
  dividers={true}
/>
```

### Características

- ✅ **Header descriptivo** integrado
- ✅ **Paginación** dentro del Card con `border-t pt-4`
- ✅ **Loading skeleton** automático
- ✅ **Empty state** configurable
- ✅ **Dividers** opcionales entre items
- ✅ **Click handler** para navegación
- ✅ **Responsive** por defecto

### Cuándo Usar

✅ **Usar cuando**:
- Información simple (1-3 campos principales)
- Navegación rápida entre items
- Espacio vertical disponible
- Mobile-first design

❌ **No usar cuando**:
- Necesitas comparar múltiples campos
- Datos tabulares complejos
- Ordenamiento por columnas requerido
- Información visual destacada (usar CardView)

---

## 📊 DataTable - Vista de Tabla

### Descripción

Componente para mostrar datos en formato tabular con columnas configurables, ordenamiento y selección múltiple.

### Ubicación

```
src/components/common/views/data-table.tsx
```

### Props

```typescript
interface DataTableProps<T> {
  // Datos
  data: T[]
  columns: ColumnConfig<T>[]
  
  // Header
  header?: {
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
  
  // Paginación
  pagination?: PaginationConfig
}
```


### Ejemplo Básico

```tsx
import { DataTable } from '@/components/common/views/data-table'
import type { ColumnConfig } from '@/types/common'

const columns: ColumnConfig<Category>[] = [
  {
    key: 'name',
    label: 'Categoría',
    sortable: true,
    render: (category) => (
      <div className="flex items-center space-x-2">
        <div 
          className="w-3 h-3 rounded-full" 
          style={{ backgroundColor: category.color }}
        />
        <div>
          <p className="font-medium">{category.name}</p>
          <p className="text-xs text-muted-foreground">
            {category.description}
          </p>
        </div>
      </div>
    )
  },
  {
    key: 'level',
    label: 'Nivel',
    sortable: true,
    render: (category) => (
      <Badge variant="outline">
        Nivel {category.level}
      </Badge>
    )
  },
  {
    key: 'isActive',
    label: 'Estado',
    sortable: true,
    render: (category) => (
      <Badge variant={category.isActive ? 'default' : 'secondary'}>
        {category.isActive ? 'Activa' : 'Inactiva'}
      </Badge>
    )
  },
  {
    key: '_count',
    label: 'Tickets',
    sortable: true,
    render: (category) => (
      <div className="flex items-center space-x-1">
        <Ticket className="h-4 w-4 text-muted-foreground" />
        <span>{category._count.tickets}</span>
      </div>
    )
  },
  {
    key: 'actions',
    label: 'Acciones',
    render: (category) => (
      <div className="flex space-x-2">
        <Button size="sm" variant="ghost" onClick={() => handleEdit(category)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(category)}>
          <Trash className="h-4 w-4" />
        </Button>
      </div>
    )
  }
]

<DataTable
  data={categories}
  columns={columns}
  header={{
    title: "Vista de Tabla - Categorías",
    description: "Información detallada en columnas"
  }}
  sortable={true}
  defaultSort={{ key: 'name', direction: 'asc' }}
  onRowClick={(category) => handleEdit(category)}
  pagination={paginationConfig}
/>
```

### Ejemplo con Selección Múltiple

```tsx
<DataTable
  data={departments}
  columns={departmentColumns}
  header={{
    title: "Vista de Tabla - Departamentos",
    description: "Selecciona múltiples departamentos"
  }}
  selectable={true}
  selectedItems={selectedDepartments}
  onSelectionChange={setSelectedDepartments}
  sortable={true}
  pagination={paginationConfig}
/>
```

### Características

- ✅ **Columnas configurables** con render personalizado
- ✅ **Ordenamiento** por columnas (asc/desc)
- ✅ **Selección múltiple** con checkboxes
- ✅ **Header descriptivo** integrado
- ✅ **Paginación** dentro del Card
- ✅ **Loading skeleton** automático
- ✅ **Empty state** configurable
- ✅ **Click en fila** para navegación
- ✅ **Responsive** con scroll horizontal

### Cuándo Usar

✅ **Usar cuando**:
- Datos tabulares con múltiples campos
- Necesitas comparar valores entre filas
- Ordenamiento por columnas requerido
- Selección múltiple necesaria
- Información densa y estructurada

❌ **No usar cuando**:
- Información simple (usar ListView)
- Contenido visual destacado (usar CardView)
- Datos jerárquicos (usar TreeView)
- Mobile-first (considerar ListView)

---

## 🎴 CardView - Vista de Tarjetas

### Descripción

Componente para mostrar datos en formato de grid de tarjetas. Ideal para información visual con estadísticas e imágenes.

### Ubicación

```
src/components/common/views/card-view.tsx
```

### Props

```typescript
interface CardViewProps<T> {
  // Datos
  data: T[]
  renderCard: (item: T, index: number) => ReactNode
  
  // Header
  header?: {
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
  
  // Paginación
  pagination?: PaginationConfig
}
```


### Ejemplo Básico

```tsx
import { CardView } from '@/components/common/views/card-view'
import { TechnicianStatsCard } from '@/components/ui/technician-stats-card'

<CardView
  data={technicians}
  header={{
    title: "Técnicos",
    description: "Información visual con estadísticas",
    icon: <Users className="h-4 w-4" />
  }}
  columns={3}
  gap={6}
  renderCard={(technician) => (
    <TechnicianStatsCard
      technician={technician}
      onEdit={() => handleEdit(technician)}
      onDelete={() => handleDelete(technician)}
    />
  )}
  onCardClick={(technician) => handleView(technician)}
  pagination={paginationConfig}
/>
```

### Ejemplo con Tarjeta Personalizada

```tsx
<CardView
  data={tickets}
  header={{
    title: "Vista de Tarjetas - Tickets",
    description: "Tickets en formato visual"
  }}
  columns={2}
  renderCard={(ticket) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">
              #{ticket.id} - {ticket.title}
            </CardTitle>
            <CardDescription className="text-xs">
              {ticket.client.name}
            </CardDescription>
          </div>
          <Badge variant={getPriorityVariant(ticket.priority)}>
            {ticket.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center text-sm">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            {formatDate(ticket.createdAt)}
          </div>
          <div className="flex items-center text-sm">
            <User className="h-4 w-4 mr-2 text-muted-foreground" />
            {ticket.assignedTo?.name || 'Sin asignar'}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Badge variant={getStatusVariant(ticket.status)}>
          {ticket.status}
        </Badge>
        <div className="flex space-x-2">
          <Button size="sm" variant="ghost">
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost">
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )}
  pagination={paginationConfig}
/>
```

### Características

- ✅ **Grid responsive** automático (1-4 columnas)
- ✅ **Gap configurable** entre tarjetas
- ✅ **Header descriptivo** integrado
- ✅ **Paginación** dentro del Card
- ✅ **Loading skeleton** inteligente
- ✅ **Empty state** configurable
- ✅ **Click handler** para navegación
- ✅ **Renderizado personalizado** completo

### Cuándo Usar

✅ **Usar cuando**:
- Información visual destacada
- Estadísticas por item
- Imágenes o avatares importantes
- Diseño tipo dashboard
- Información agrupada por item

❌ **No usar cuando**:
- Necesitas comparar valores (usar DataTable)
- Información muy simple (usar ListView)
- Datos jerárquicos (usar TreeView)
- Espacio limitado

---

## 🌳 TreeView - Vista de Árbol

### Descripción

Componente específico para mostrar datos jerárquicos en formato de árbol con expand/collapse. **Nota**: Actualmente solo existe `CategoryTree` como implementación específica.

### Ubicación

```
src/components/ui/category-tree.tsx (específico)
```

### Decisión de Diseño

**NO se creó un TreeView global** porque:
- CategoryTree es muy específico del dominio de categorías
- Maneja 4 niveles jerárquicos con lógica de negocio única
- Colores y badges específicos por nivel
- Información de tickets y técnicos asignados
- Ya está optimizado con memoización
- Funcionalidad única del módulo de categorías

Si en el futuro se necesita un TreeView genérico para otros módulos, se puede extraer la lógica común de CategoryTree.

### Ejemplo (CategoryTree)

```tsx
import { CategoryTree } from '@/components/ui/category-tree'

<Card>
  <CardHeader>
    <CardTitle>Vista de Árbol - Jerarquía Completa</CardTitle>
    <CardDescription>
      Explora la estructura jerárquica de categorías
    </CardDescription>
  </CardHeader>
  <CardContent>
    <CategoryTree
      categories={categories}
      onEdit={handleEdit}
      onDelete={handleDelete}
      searchTerm={searchTerm}
    />
  </CardContent>
</Card>
```

### Características de CategoryTree

- ✅ **4 niveles jerárquicos** (N1 → N2 → N3 → N4)
- ✅ **Expand/collapse** con animación
- ✅ **Búsqueda** con auto-expand
- ✅ **Indicadores visuales** por nivel (colores, iconos)
- ✅ **Contador de hijos** en cada nodo
- ✅ **Estadísticas** (tickets, técnicos)
- ✅ **Persistencia** del estado en localStorage
- ✅ **Performance** optimizada con memoización

### Cuándo Usar

✅ **Usar cuando**:
- Datos jerárquicos multinivel
- Relaciones padre-hijo importantes
- Navegación por estructura de árbol
- Visualización de taxonomías

❌ **No usar cuando**:
- Datos planos (usar ListView o DataTable)
- Solo 1 nivel de profundidad
- Información visual destacada (usar CardView)

---

## 📦 ViewContainer - Contenedor Unificado

### Descripción

Contenedor que proporciona estructura automática con header, paginación y estados para cualquier vista.

### Ubicación

```
src/components/common/views/view-container.tsx
```

### Props

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
  viewMode?: 'table' | 'cards'
  onViewModeChange?: (mode: 'table' | 'cards') => void
  
  // Renderizado
  renderTable?: (data: T[]) => ReactNode
  renderList?: (data: T[]) => ReactNode
  renderCards?: (data: T[]) => ReactNode
  renderTree?: (data: T[]) => ReactNode
  
  // Paginación
  pagination?: PaginationConfig
  
  // Empty state
  emptyState?: EmptyState
  
  // Callbacks
  onRefresh?: () => void
}
```


### Ejemplo Completo

```tsx
import { ViewContainer } from '@/components/common/views/view-container'

<ViewContainer
  data={categories}
  loading={loading}
  title="Categorías"
  description="Gestión de categorías del sistema"
  icon={<FolderTree />}
  actions={
    <Button onClick={handleNew}>
      <Plus className="h-4 w-4 mr-2" />
      Nueva Categoría
    </Button>
  }
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
  pagination={paginationConfig}
  emptyState={{
    icon: <FolderTree className="h-12 w-12" />,
    title: "No hay categorías",
    description: "Crea tu primera categoría para comenzar",
    action: <Button onClick={handleNew}>Crear Categoría</Button>
  }}
  onRefresh={loadCategories}
/>
```

### Características

- ✅ **Header automático** con título, descripción e icono
- ✅ **Paginación integrada** dentro del Card
- ✅ **Estados automáticos** (loading, error, empty)
- ✅ **Cambio de vista** integrado
- ✅ **Estructura consistente** (space-y-4)
- ✅ **Refresh** opcional
- ✅ **Acciones** en header

### Cuándo Usar

✅ **Usar cuando**:
- Necesitas estructura completa automática
- Múltiples vistas para los mismos datos
- Quieres consistencia garantizada
- Desarrollo rápido de nuevos módulos

❌ **No usar cuando**:
- Necesitas control total del layout
- Vista única sin cambios
- Casos muy específicos

---

## 🎯 Guía de Selección: Cuándo Usar Cada Vista

### Matriz de Decisión

| Criterio | ListView | DataTable | CardView | TreeView |
|----------|----------|-----------|----------|----------|
| **Complejidad de datos** | Baja | Alta | Media | Alta |
| **Campos visibles** | 1-3 | 4+ | 3-6 | Variable |
| **Comparación** | ❌ | ✅ | ⚠️ | ❌ |
| **Ordenamiento** | ❌ | ✅ | ❌ | ❌ |
| **Selección múltiple** | ✅ | ✅ | ⚠️ | ❌ |
| **Información visual** | ⚠️ | ❌ | ✅ | ⚠️ |
| **Jerarquía** | ❌ | ❌ | ❌ | ✅ |
| **Mobile-friendly** | ✅ | ⚠️ | ✅ | ⚠️ |
| **Densidad** | Alta | Muy Alta | Media | Variable |

### Casos de Uso por Módulo

#### Técnicos
- **CardView**: ✅ Vista principal (estadísticas destacadas)
- **ListView**: ✅ Vista alternativa (información compacta)
- **DataTable**: ⚠️ Opcional (comparación de métricas)

#### Categorías
- **ListView**: ✅ Navegación rápida
- **DataTable**: ✅ Comparación de datos
- **TreeView**: ✅ Visualización de jerarquía

#### Departamentos
- **ListView**: ✅ Vista principal (información simple)
- **DataTable**: ✅ Vista alternativa (datos tabulares)
- **CardView**: ⚠️ Opcional (si hay estadísticas)

#### Tickets
- **DataTable**: ✅ Vista principal (muchos campos)
- **CardView**: ✅ Vista alternativa (información visual)
- **ListView**: ⚠️ Opcional (mobile)

#### Usuarios
- **DataTable**: ✅ Vista única (datos complejos)
- **CardView**: ⚠️ Opcional (perfiles con avatar)
- **ListView**: ⚠️ Opcional (mobile)

#### Reportes
- **Gráficos**: ✅ Vista principal (análisis visual)
- **DataTable**: ✅ Vista detallada (datos raw)
- **CardView**: ⚠️ Opcional (KPIs)

### Flujo de Decisión

```
¿Datos jerárquicos?
  ├─ Sí → TreeView
  └─ No → ¿Información visual importante?
      ├─ Sí → CardView
      └─ No → ¿Múltiples campos para comparar?
          ├─ Sí → DataTable
          └─ No → ListView
```

---

## ✨ Mejores Prácticas

### 1. Headers Descriptivos

**Siempre incluir**:
```tsx
header={{
  title: "Vista de [Tipo] - [Módulo]",
  description: "Descripción clara del contenido",
  icon: <IconoRelevante />
}}
```

**Formato estándar**:
- Lista: "Vista de Lista - Información compacta"
- Tabla: "Vista de Tabla - Información detallada"
- Tarjetas: "Vista de Tarjetas - Información visual"
- Árbol: "Vista de Árbol - Jerarquía completa"

### 2. Paginación

**Siempre configurar**:
```tsx
const paginationConfig: PaginationConfig = {
  page: pagination.currentPage,
  limit: pagination.pageSize,
  total: filteredData.length,
  onPageChange: (page) => pagination.goToPage(page),
  onLimitChange: (limit) => pagination.setPageSize(limit),
  options: [10, 20, 50, 100]  // Estándar
}
```

**Ubicación**: Siempre dentro del Card con `border-t pt-4`

### 3. Empty States

**Siempre personalizar**:
```tsx
emptyState={{
  icon: <IconoRelevante className="h-12 w-12" />,
  title: "No hay [items]",
  description: filtrosActivos 
    ? "No se encontraron resultados con los filtros aplicados"
    : "Crea tu primer [item] para comenzar",
  action: !filtrosActivos && (
    <Button onClick={handleCreate}>Crear [Item]</Button>
  )
}}
```

### 4. Loading States

**Usar skeleton automático**:
```tsx
<ListView
  data={data}
  loading={loading}  // Skeleton automático
  // ...
/>
```

### 5. Selección Múltiple

**Implementar consistentemente**:
```tsx
<DataTable
  data={data}
  selectable={true}
  selectedItems={selected}
  onSelectionChange={setSelected}
  // ...
/>
```

### 6. Responsive Design

**Considerar mobile**:
- ListView: Excelente en mobile
- DataTable: Scroll horizontal en mobile
- CardView: Ajustar columnas (3 → 2 → 1)
- TreeView: Considerar alternativa en mobile

### 7. Performance

**Optimizar renderizado**:
```tsx
// Memoizar renderItem/renderCard
const renderItem = useCallback((item: T) => (
  <ItemComponent item={item} />
), [])

// Memoizar columnas
const columns = useMemo(() => [...], [])
```

### 8. Accesibilidad

**Siempre incluir**:
- Labels descriptivos
- Keyboard navigation
- ARIA attributes
- Focus management

---

## 📚 Recursos Adicionales

### Documentación Relacionada

- [Guía de Paginación](./GUIA_PAGINACION.md)
- [Guía de Headers](./GUIA_HEADERS.md)
- [Antes y Después](./ANTES_Y_DESPUES.md)
- [Design System](./FASE_13_2_DISENO_SISTEMA.md)

### Ejemplos en el Código

- **Técnicos**: `src/app/admin/technicians/page.tsx`
- **Categorías**: `src/components/categories/categories-page.tsx`
- **Departamentos**: `src/components/departments/departments-page.tsx`

### Tipos TypeScript

- `src/types/views.ts` - Tipos de vistas
- `src/types/common.ts` - Tipos comunes

---

## 🎉 Conclusión

Esta guía proporciona todo lo necesario para implementar vistas estandarizadas en el sistema. Siguiendo estos patrones, garantizamos:

- ✅ **Consistencia** visual y funcional
- ✅ **Mantenibilidad** con código reutilizable
- ✅ **Escalabilidad** para nuevos módulos
- ✅ **UX profesional** en toda la aplicación

**Recuerda**: Cuando tengas dudas, consulta los ejemplos en los módulos ya migrados (Técnicos, Categorías, Departamentos).

---

**Documento generado**: 2026-01-23  
**Autor**: Sistema de Estandarización de UI  
**Versión**: 1.0
