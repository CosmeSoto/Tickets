# Prototipo: Migración de Técnicos a Componentes Unificados

**Fecha**: 2026-01-23  
**Módulo**: Técnicos  
**Estado**: Prototipo

---

## 🎯 Objetivo

Demostrar cómo migrar el módulo de Técnicos para usar los nuevos componentes unificados (CardView y ListView) con headers descriptivos y paginación integrada.

---

## 📊 Análisis del Código Actual

### Componentes Usados
- ✅ `ModuleLayout` - Ya estandarizado
- ✅ `FilterBar` - Ya estandarizado
- ✅ `ViewToggle` - Ya estandarizado
- ⚠️ `CardGrid` - Usar `CardView` nuevo
- ⚠️ `ListView` - Actualizar con header y paginación
- ⚠️ `SmartPagination` - Integrar en componentes

### Código Actual (Líneas 700-850)

```tsx
<Card>
  <CardHeader>
    <CardTitle className='flex items-center justify-between'>
      <span>Técnicos ({filteredData.length})</span>
      <div className="flex items-center space-x-2">
        <ViewToggle
          mode={viewMode}
          onChange={setViewMode}
          availableModes={['cards', 'list']}
        />
        <Badge variant='outline'>
          Vista: {viewMode === 'cards' ? 'Tarjetas' : 'Lista'}
        </Badge>
      </div>
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {/* Header descriptivo manual */}
      <div className="border-b pb-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          {viewMode === 'cards' && 'Vista de Tarjetas - Información visual'}
          {viewMode === 'list' && 'Vista de Lista - Información compacta'}
        </h3>
      </div>

      {/* Renderizado de vistas */}
      {viewMode === 'cards' ? (
        <CardGrid
          data={pagination.currentItems}
          renderCard={(technician) => (
            <TechnicianStatsCard ... />
          )}
          columns={3}
        />
      ) : (
        <ListView
          data={pagination.currentItems}
          renderItem={(technician) => (
            <div>...</div>
          )}
          onItemClick={handleEdit}
        />
      )}

      {/* Paginación manual */}
      {filteredData.length > 0 && pagination.totalPages > 1 && (
        <div className="border-t pt-4">
          <SmartPagination ... />
        </div>
      )}
    </div>
  </CardContent>
</Card>
```

**Problemas**:
1. ❌ Card wrapper manual
2. ❌ Header descriptivo manual
3. ❌ Paginación manual fuera de componentes
4. ❌ Lógica de vista duplicada
5. ❌ ~150 líneas de código repetitivo

---

## ✨ Código Mejorado con Componentes Unificados

### Opción 1: Usando CardView y ListView Directamente

```tsx
import { CardView, ListView } from '@/components/common/views'
import { Grid3X3, List } from 'lucide-react'

// ... resto del código ...

// Configuración de paginación para componentes
const paginationConfig = {
  page: pagination.currentPage,
  limit: pagination.pageSize,
  total: filteredData.length,
  onPageChange: (page: number) => pagination.goToPage(page),
  onLimitChange: (limit: number) => {
    // Actualizar pageSize en SmartPagination
    // Nota: SmartPagination necesita método setPageSize
  }
}

return (
  <ModuleLayout
    title="Gestión de Técnicos"
    subtitle="Administración de técnicos y sus asignaciones"
    loading={loading}
    error={error}
    onRetry={reload}
    headerActions={
      <div className="flex items-center space-x-2">
        <ViewToggle
          mode={viewMode}
          onChange={setViewMode}
          availableModes={['cards', 'list']}
        />
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className='h-4 w-4 mr-2' />
          Promover Usuario
        </Button>
      </div>
    }
  >
    {/* Filtros */}
    <Card>
      <CardContent className='pt-6'>
        <FilterBar
          config={filterConfig}
          filters={filters}
          onFilterChange={setFilter}
          onClearFilters={clearFilters}
          onRefresh={reload}
          loading={loading}
          activeFiltersCount={activeFiltersCount}
          stats={stats}
        />
      </CardContent>
    </Card>

    {/* Vista de Tarjetas o Lista */}
    {viewMode === 'cards' ? (
      <CardView
        data={pagination.currentItems}
        renderCard={(technician) => (
          <TechnicianStatsCard
            technician={technician}
            onEdit={() => handleEdit(technician)}
            onDelete={() => setDeletingTechnician(technician)}
            onDemote={() => handleOpenDemoteDialog(technician)}
            onViewAssignments={handleViewAssignments}
            canDelete={technician.canDelete}
            showDetailedStats={true}
          />
        )}
        header={{
          title: "Técnicos",
          description: "Información visual destacada",
          icon: <Grid3X3 className="h-4 w-4" />
        }}
        columns={3}
        gap={4}
        pagination={paginationConfig}
        onRefresh={reload}
        emptyState={{
          icon: <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
          title: activeFiltersCount > 0 
            ? "No se encontraron técnicos" 
            : "No hay técnicos disponibles",
          description: activeFiltersCount > 0
            ? "Intenta ajustar los filtros de búsqueda"
            : "Comienza promoviendo un usuario a técnico",
          action: activeFiltersCount > 0 ? (
            <Button variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          ) : (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Promover Usuario
            </Button>
          )
        }}
      />
    ) : (
      <ListView
        data={pagination.currentItems}
        renderItem={(technician) => (
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3 flex-1 min-w-0'>
              <div className='flex-shrink-0'>
                {technician.isActive ? (
                  <UserCheck className='h-5 w-5 text-green-600' />
                ) : (
                  <UserX className='h-5 w-5 text-muted-foreground' />
                )}
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center space-x-2 mb-1'>
                  <h3 className='font-medium text-foreground text-sm truncate'>
                    {technician.name}
                  </h3>
                  <Badge variant={technician.isActive ? 'default' : 'secondary'} className='text-xs'>
                    {technician.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                
                <div className='flex items-center space-x-3 text-xs text-muted-foreground'>
                  <div className='flex items-center'>
                    <Mail className='h-3 w-3 mr-1' />
                    {technician.email}
                  </div>
                  {technician.phone && (
                    <div className='flex items-center'>
                      <Phone className='h-3 w-3 mr-1' />
                      {technician.phone}
                    </div>
                  )}
                  {technician.department && (
                    <Badge 
                      variant='outline' 
                      className='text-xs'
                      style={{ 
                        borderColor: technician.department.color,
                        color: technician.department.color
                      }}
                    >
                      {technician.department.name}
                    </Badge>
                  )}
                </div>
                
                <div className='flex items-center space-x-3 text-xs text-muted-foreground mt-1'>
                  <span>{technician._count?.assignedTickets || 0} tickets activos</span>
                  <span>{technician._count?.technicianAssignments || 0} categorías asignadas</span>
                </div>
              </div>
            </div>

            <div className='flex items-center space-x-2 flex-shrink-0'>
              <Button 
                variant='outline' 
                size='sm' 
                onClick={(e) => {
                  e.stopPropagation()
                  handleEdit(technician)
                }}
              >
                <Edit className='h-4 w-4' />
              </Button>
              <Button 
                variant='outline' 
                size='sm'
                disabled={!technician.canDelete}
                onClick={(e) => {
                  e.stopPropagation()
                  setDeletingTechnician(technician)
                }}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </div>
          </div>
        )}
        header={{
          title: "Vista de Lista - Técnicos",
          description: "Información compacta y vertical",
          icon: <List className="h-4 w-4" />
        }}
        pagination={paginationConfig}
        onRefresh={reload}
        onItemClick={(technician) => handleEdit(technician)}
        emptyState={{
          icon: <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
          title: activeFiltersCount > 0 
            ? "No se encontraron técnicos" 
            : "No hay técnicos disponibles",
          description: activeFiltersCount > 0
            ? "Intenta ajustar los filtros de búsqueda"
            : "Comienza promoviendo un usuario a técnico",
          action: activeFiltersCount > 0 ? (
            <Button variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          ) : (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Promover Usuario
            </Button>
          )
        }}
      />
    )}

    {/* Diálogos (sin cambios) */}
    {/* ... */}
  </ModuleLayout>
)
```

---

## 📊 Comparación

### Antes (Código Actual)
```tsx
<Card>
  <CardHeader>
    <CardTitle>...</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {/* Header manual */}
      <div className="border-b pb-2">...</div>
      
      {/* Vista */}
      {viewMode === 'cards' ? (
        <CardGrid ... />
      ) : (
        <ListView ... />
      )}
      
      {/* Paginación manual */}
      {pagination.totalPages > 1 && (
        <div className="border-t pt-4">
          <SmartPagination ... />
        </div>
      )}
    </div>
  </CardContent>
</Card>
```

**Líneas**: ~150

### Después (Código Mejorado)
```tsx
{viewMode === 'cards' ? (
  <CardView
    data={pagination.currentItems}
    renderCard={(tech) => <TechnicianStatsCard ... />}
    header={{...}}
    pagination={paginationConfig}
    emptyState={{...}}
  />
) : (
  <ListView
    data={pagination.currentItems}
    renderItem={(tech) => <div>...</div>}
    header={{...}}
    pagination={paginationConfig}
    emptyState={{...}}
  />
)}
```

**Líneas**: ~80

**Reducción**: 70 líneas (47%)

---

## ✅ Beneficios

1. ✅ **Menos código**: 47% de reducción
2. ✅ **Headers automáticos**: Formato estándar
3. ✅ **Paginación integrada**: DENTRO del Card con separador
4. ✅ **Empty states**: Configurables y consistentes
5. ✅ **Refresh automático**: Botón integrado en header
6. ✅ **Estructura consistente**: `space-y-4` automático
7. ✅ **Mantenimiento centralizado**: Bugs corregidos una vez

---

## 🔧 Ajustes Necesarios

### 1. Adaptar SmartPagination a PaginationConfig

**Problema**: SmartPagination usa su propia estructura

**Solución**: Crear adaptador

```tsx
const paginationConfig: PaginationConfig = {
  page: pagination.currentPage,
  limit: pagination.pageSize,
  total: filteredData.length,
  onPageChange: (page) => pagination.goToPage(page),
  onLimitChange: (limit) => {
    // Necesitamos agregar setPageSize a SmartPagination
    // O crear un nuevo hook usePagination que sea compatible
  }
}
```

### 2. Mover ViewToggle al Header

**Antes**: Dentro del CardTitle

**Después**: En headerActions de ModuleLayout

```tsx
<ModuleLayout
  headerActions={
    <div className="flex items-center space-x-2">
      <ViewToggle
        mode={viewMode}
        onChange={setViewMode}
        availableModes={['cards', 'list']}
      />
      <Button onClick={() => setIsDialogOpen(true)}>
        <Plus className='h-4 w-4 mr-2' />
        Promover Usuario
      </Button>
    </div>
  }
>
```

---

## 📝 Plan de Migración

### Paso 1: Preparación
- [ ] Verificar que CardView y ListView funcionan
- [ ] Crear adaptador de paginación
- [ ] Preparar empty states

### Paso 2: Migración
- [ ] Reemplazar CardGrid por CardView
- [ ] Actualizar ListView con header y paginación
- [ ] Mover ViewToggle a headerActions
- [ ] Eliminar Card wrapper manual
- [ ] Eliminar header manual
- [ ] Eliminar paginación manual

### Paso 3: Verificación
- [ ] Probar vista de tarjetas
- [ ] Probar vista de lista
- [ ] Probar paginación
- [ ] Probar filtros
- [ ] Probar empty states
- [ ] Probar refresh

### Paso 4: Limpieza
- [ ] Eliminar código comentado
- [ ] Actualizar imports
- [ ] Verificar TypeScript
- [ ] Medir reducción de código

---

## 🎯 Resultado Esperado

**Código actual**: ~991 líneas  
**Código después**: ~920 líneas  
**Reducción**: ~71 líneas (7.2%)

**Beneficios adicionales**:
- Consistencia visual 100%
- Mantenimiento centralizado
- Bugs corregidos una vez
- Desarrollo futuro más rápido

---

## 💡 Lecciones Aprendidas

1. **Compatibilidad**: Los componentes nuevos son compatibles con el código existente
2. **Migración gradual**: Podemos migrar vista por vista
3. **Adaptadores**: Necesitamos adaptadores para hooks existentes
4. **Empty states**: Configurables mejoran UX
5. **Headers descriptivos**: Mejoran claridad para usuarios

---

**Siguiente**: Implementar migración completa en Técnicos
