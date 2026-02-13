# Fase 13.4.3: Plan de Migración de Categorías

**Fecha**: 2026-01-23  
**Estado**: Planificado  
**Estimación**: 1 hora

---

## 🎯 Objetivo

Migrar el módulo de Categorías para usar los componentes unificados (ListView y DataTable) con headers descriptivos y paginación integrada, eliminando CategoryListView y CategoryTableCompact.

---

## 📊 Análisis del Código Actual

### Componentes Específicos a Eliminar

1. **CategoryListView** (`src/components/categories/category-list-view.tsx`)
   - ~150 líneas
   - Renderiza lista de categorías
   - Tiene lógica de selección múltiple
   - Muestra información de técnicos asignados

2. **CategoryTableCompact** (`src/components/ui/category-table-compact.tsx`)
   - ~200 líneas
   - Renderiza tabla HTML
   - Muestra columnas: Categoría, Nivel, Estado, Tickets, Técnicos, Acciones
   - Tiene highlight de búsqueda

3. **CategoryTree** (`src/components/ui/category-tree.tsx`)
   - **MANTENER** - Componente específico del dominio
   - Maneja jerarquía de 4 niveles
   - Lógica compleja de expand/collapse
   - Auto-expand en búsqueda

### Estructura Actual

```tsx
<Card>
  <CardHeader>
    <CardTitle>
      Categorías ({count})
      <ViewToggle ... />
      <Badge>Selección múltiple</Badge>
    </CardTitle>
  </CardHeader>
  <CardContent>
    {/* Header descriptivo manual */}
    <div className="border-b pb-2">
      <h3>Vista de [Tipo] - [Descripción]</h3>
    </div>

    {/* Vistas */}
    {viewMode === 'tree' ? (
      <CategoryTree ... />
    ) : viewMode === 'list' ? (
      <CategoryListView ... />
    ) : (
      <CategoryTableCompact ... />
    )}

    {/* Paginación manual (solo lista y tabla) */}
    {viewMode !== 'tree' && pagination.totalPages > 1 && (
      <div className="border-t pt-4">
        <SmartPagination ... />
      </div>
    )}
  </CardContent>
</Card>
```

**Líneas**: ~180 (sección de vistas)

---

## ✨ Diseño de la Migración

### 1. Imports Actualizados

**Eliminar**:
```typescript
import { CategoryListView } from './category-list-view'
import { CategoryTableCompact } from '@/components/ui/category-table-compact'
import { SmartPagination } from './smart-pagination'
```

**Agregar**:
```typescript
import { ListView } from '@/components/common/views/list-view'
import { DataTable } from '@/components/common/views/data-table'
import type { PaginationConfig, Column } from '@/types/views'
```

### 2. Adaptador de Paginación

```typescript
// Adaptador de paginación para componentes nuevos
const paginationConfig: PaginationConfig = {
  page: pagination.currentPage,
  limit: pagination.pageSize,
  total: pagination.totalItems,
  onPageChange: (page) => pagination.goToPage(page),
  onLimitChange: (limit) => pagination.setPageSize(limit),
  options: [10, 20, 50, 100]
}
```

### 3. Configuración de Columnas para DataTable

```typescript
const categoryColumns: Column<CategoryData>[] = [
  {
    key: 'name',
    label: 'Categoría',
    sortable: true,
    render: (category) => (
      <div className="flex items-center space-x-3">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />
        <div className="flex items-center space-x-2">
          {getLevelIcon(category.level)}
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground truncate">
              {category.name}
            </div>
            {category.description && (
              <div className="text-xs text-muted-foreground truncate max-w-xs">
                {category.description}
              </div>
            )}
            {category.parent && (
              <div className="text-xs text-muted-foreground">
                ↳ {category.parent.name}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  },
  {
    key: 'level',
    label: 'Nivel',
    sortable: true,
    width: '100px',
    render: (category) => (
      <Badge 
        variant='outline' 
        className={cn(
          "text-xs px-2 py-1",
          category.level === 1 && "bg-blue-50 text-blue-700 border-blue-200",
          category.level === 2 && "bg-green-50 text-green-700 border-green-200", 
          category.level === 3 && "bg-yellow-50 text-yellow-700 border-yellow-200",
          category.level === 4 && "bg-purple-50 text-purple-700 border-purple-200"
        )}
      >
        N{category.level}
      </Badge>
    )
  },
  {
    key: 'isActive',
    label: 'Estado',
    sortable: true,
    width: '100px',
    render: (category) => (
      <Badge 
        variant={category.isActive ? 'default' : 'secondary'} 
        className="text-xs px-2 py-1"
      >
        {category.isActive ? 'Activa' : 'Inactiva'}
      </Badge>
    )
  },
  {
    key: 'tickets',
    label: 'Tickets',
    sortable: true,
    width: '150px',
    render: (category) => (
      <div className="flex items-center space-x-3 text-sm text-muted-foreground">
        <div className="flex items-center space-x-1">
          <Ticket className="h-4 w-4" />
          <span>{category._count.tickets}</span>
        </div>
        {category._count.other_categories > 0 && (
          <div className="flex items-center space-x-1">
            <Folder className="h-4 w-4" />
            <span>{category._count.other_categories}</span>
          </div>
        )}
      </div>
    )
  },
  {
    key: 'technicians',
    label: 'Técnicos',
    width: '200px',
    render: (category) => (
      category.technician_assignments?.length ? (
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {category.technician_assignments.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {category.technician_assignments
              .filter(tech => tech?.users?.name)
              .slice(0, 2)
              .map(tech => (
                <Badge key={tech.id} variant='secondary' className='text-xs px-1.5 py-0.5'>
                  {tech.users.name.split(' ')[0]}
                </Badge>
              ))}
            {category.technician_assignments.length > 2 && (
              <Badge variant='outline' className='text-xs px-1.5 py-0.5'>
                +{category.technician_assignments.length - 2}
              </Badge>
            )}
          </div>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      )
    )
  }
]
```

### 4. Renderizado con Componentes Unificados

```tsx
{/* ViewToggle movido a headerActions */}
<ModuleLayout
  headerActions={
    <div className="flex items-center space-x-2">
      <ViewToggle
        mode={viewMode}
        onChange={setViewMode}
        availableModes={['list', 'table', 'tree']}
      />
      {massActions && massActions.selectedCount > 0 && (
        <Badge variant='outline'>
          {massActions.selectedCount} seleccionado{massActions.selectedCount !== 1 ? 's' : ''}
        </Badge>
      )}
      <Button onClick={handleNew}>
        <Plus className='h-4 w-4 mr-2' />
        Nueva Categoría
      </Button>
    </div>
  }
>
  {/* ... filtros y stats ... */}

  {/* Vistas con componentes unificados */}
  {viewMode === 'tree' ? (
    <Card>
      <CardHeader>
        <CardTitle>Vista de Árbol - Jerarquía Completa</CardTitle>
      </CardHeader>
      <CardContent>
        <CategoryTree
          categories={hierarchicalCategories}
          onEdit={handleEdit}
          onDelete={setDeletingCategory}
          searchTerm={searchTerm}
        />
      </CardContent>
    </Card>
  ) : viewMode === 'list' ? (
    <ListView
      data={paginatedCategories}
      renderItem={(category) => (
        <div className='flex items-center justify-between'>
          {/* Checkbox de selección */}
          {massActions && (
            <Checkbox
              checked={massActions.selectedItems.has(category.id)}
              onCheckedChange={() => massActions.toggleItem(category.id)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          
          {/* Contenido del item */}
          <div className='flex items-center space-x-3 flex-1 min-w-0'>
            <div
              className='w-3 h-3 rounded-full flex-shrink-0'
              style={{ backgroundColor: category.color }}
            />
            <div className='flex-1 min-w-0'>
              <div className='flex items-center space-x-2 mb-1'>
                {getLevelIcon(category.level)}
                <h3 className='font-semibold text-sm text-foreground truncate'>
                  {category.name}
                </h3>
                <Badge variant={category.isActive ? 'default' : 'secondary'} className="text-xs">
                  {category.isActive ? 'Activa' : 'Inactiva'}
                </Badge>
                <Badge variant='outline' className="text-xs">{category.levelName}</Badge>
              </div>
              
              {category.description && (
                <p className='text-xs text-muted-foreground mb-1 truncate'>
                  {category.description}
                </p>
              )}
              
              {category.parent && (
                <p className='text-xs text-muted-foreground mb-1'>
                  Padre: {category.parent.name}
                </p>
              )}
              
              <div className='flex items-center space-x-3 text-xs text-muted-foreground'>
                <span className="flex items-center space-x-1">
                  <Ticket className="h-3 w-3" />
                  <span>{category._count?.tickets || 0}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Folder className="h-3 w-3" />
                  <span>{category._count?.other_categories || 0}</span>
                </span>
                {(category.technician_assignments?.length || 0) > 0 && (
                  <span className='flex items-center space-x-1'>
                    <Users className='h-3 w-3' />
                    <span>{category.technician_assignments?.length || 0}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className='flex items-center space-x-1 ml-3'>
            <Button 
              variant='outline' 
              size='sm' 
              onClick={(e) => {
                e.stopPropagation()
                handleEdit(category)
              }}
              className="h-7 w-7 p-0"
            >
              <Edit className='h-3.5 w-3.5' />
            </Button>
            <Button 
              variant='outline' 
              size='sm'
              disabled={!category.canDelete}
              onClick={(e) => {
                e.stopPropagation()
                setDeletingCategory(category)
              }}
              className="h-7 w-7 p-0"
            >
              <Trash2 className='h-3.5 w-3.5' />
            </Button>
          </div>
        </div>
      )}
      header={{
        title: "Vista de Lista - Categorías",
        description: `Información compacta y vertical (${filteredCategories.length} categorías)`,
        icon: <List className="h-4 w-4" />
      }}
      pagination={paginationConfig}
      onRefresh={refresh}
      loading={loading}
      onItemClick={(category) => handleEdit(category)}
      emptyState={{
        icon: <FolderTree className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
        title: searchTerm || levelFilter !== 'all'
          ? "No se encontraron categorías"
          : "No hay categorías disponibles",
        description: searchTerm || levelFilter !== 'all'
          ? "Intenta ajustar los filtros de búsqueda"
          : "Comienza creando tu primera categoría",
        action: searchTerm || levelFilter !== 'all' ? (
          <Button variant="outline" onClick={() => {
            setSearchTerm('')
            setLevelFilter('all')
          }}>
            Limpiar filtros
          </Button>
        ) : (
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Categoría
          </Button>
        )
      }}
    />
  ) : (
    <DataTable
      data={paginatedCategories}
      columns={categoryColumns}
      header={{
        title: "Vista de Tabla - Categorías",
        description: `Información detallada en columnas (${filteredCategories.length} categorías)`,
        icon: <Table className="h-4 w-4" />
      }}
      sortable
      selectable={!!massActions}
      selectedItems={massActions ? Array.from(massActions.selectedItems).map(id => 
        paginatedCategories.find(c => c.id === id)
      ).filter(Boolean) : []}
      onSelectionChange={(selected) => {
        if (massActions) {
          massActions.clearSelection()
          selected.forEach(cat => massActions.toggleItem(cat.id))
        }
      }}
      pagination={paginationConfig}
      onRefresh={refresh}
      loading={loading}
      onRowClick={(category) => handleEdit(category)}
      rowActions={(category) => (
        <div className="flex items-center space-x-1">
          <Button 
            variant='ghost' 
            size='sm' 
            onClick={(e) => {
              e.stopPropagation()
              handleEdit(category)
            }}
            className="h-8 w-8 p-0"
          >
            <Edit className='h-4 w-4' />
          </Button>
          <Button 
            variant='ghost' 
            size='sm'
            disabled={!category.canDelete}
            onClick={(e) => {
              e.stopPropagation()
              setDeletingCategory(category)
            }}
            className="h-8 w-8 p-0"
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      )}
      emptyState={{
        icon: <FolderTree className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
        title: searchTerm || levelFilter !== 'all'
          ? "No se encontraron categorías"
          : "No hay categorías disponibles",
        description: searchTerm || levelFilter !== 'all'
          ? "Intenta ajustar los filtros de búsqueda"
          : "Comienza creando tu primera categoría",
        action: searchTerm || levelFilter !== 'all' ? (
          <Button variant="outline" onClick={() => {
            setSearchTerm('')
            setLevelFilter('all')
          }}>
            Limpiar filtros
          </Button>
        ) : (
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Categoría
          </Button>
        )
      }}
    />
  )}
</ModuleLayout>
```

---

## 📊 Impacto Estimado

### Código a Eliminar

1. **CategoryListView** - ~150 líneas
2. **CategoryTableCompact** - ~200 líneas
3. **Card wrapper manual** - ~10 líneas
4. **Header manual** - ~8 líneas
5. **Paginación manual** - ~15 líneas
6. **Empty state manual** - ~15 líneas

**Total**: ~398 líneas

### Código Nuevo

1. **Configuración de columnas** - ~120 líneas
2. **Renderizado ListView** - ~80 líneas
3. **Renderizado DataTable** - ~40 líneas
4. **Adaptador paginación** - ~8 líneas

**Total**: ~248 líneas

### Balance

**Reducción neta**: ~150 líneas (38%)

---

## ✅ Beneficios

1. ✅ **Eliminación de componentes duplicados**: CategoryListView y CategoryTableCompact
2. ✅ **Headers descriptivos** automáticos
3. ✅ **Paginación integrada** DENTRO del Card
4. ✅ **Empty states** configurables
5. ✅ **Loading states** automáticos
6. ✅ **Selección múltiple** integrada en DataTable
7. ✅ **Consistencia visual** 100%

---

## 📝 Notas Importantes

### CategoryTree se Mantiene

**Razón**: Es un componente muy específico del dominio
- Maneja 4 niveles jerárquicos
- Lógica compleja de expand/collapse
- Auto-expand en búsqueda
- Colores y badges por nivel
- Ya optimizado con memoización

**Solución**: Envolver en Card con header descriptivo

```tsx
<Card>
  <CardHeader>
    <CardTitle>Vista de Árbol - Jerarquía Completa</CardTitle>
  </CardHeader>
  <CardContent>
    <CategoryTree ... />
  </CardContent>
</Card>
```

### Selección Múltiple

- ListView: Agregar checkboxes manualmente en renderItem
- DataTable: Usar prop `selectable` integrada
- Mantener integración con `massActions`

---

## 🚀 Plan de Implementación

### Paso 1: Preparación (5 min)
- [ ] Actualizar imports
- [ ] Crear adaptador de paginación
- [ ] Crear configuración de columnas

### Paso 2: Migración ListView (15 min)
- [ ] Reemplazar CategoryListView
- [ ] Agregar header y paginación
- [ ] Integrar selección múltiple
- [ ] Configurar empty state

### Paso 3: Migración DataTable (15 min)
- [ ] Reemplazar CategoryTableCompact
- [ ] Agregar header y paginación
- [ ] Integrar selección múltiple
- [ ] Configurar empty state

### Paso 4: Ajustar CategoryTree (10 min)
- [ ] Envolver en Card con header
- [ ] Mantener funcionalidad actual

### Paso 5: Limpieza (10 min)
- [ ] Eliminar CategoryListView
- [ ] Eliminar CategoryTableCompact
- [ ] Eliminar SmartPagination import
- [ ] Verificar TypeScript

### Paso 6: Testing (10 min)
- [ ] Probar vista lista
- [ ] Probar vista tabla
- [ ] Probar vista árbol
- [ ] Probar paginación
- [ ] Probar selección múltiple
- [ ] Probar filtros

---

**Tiempo Total Estimado**: 1 hora  
**Reducción Esperada**: ~150 líneas (38%)

---

**Siguiente**: Implementar migración
