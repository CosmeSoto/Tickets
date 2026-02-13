# Simplificación: Solo Vistas de Tabla y Árbol para Categorías

## Cambio Implementado
Se eliminó la vista de tarjetas/lista del módulo de categorías, dejando únicamente las vistas de **Tabla** y **Árbol**, que son las más apropiadas para datos jerárquicos.

## Justificación
- **Datos jerárquicos**: Las categorías tienen una estructura de árbol con 4 niveles, por lo que las vistas más útiles son:
  - **Tabla**: Para ver información detallada en columnas
  - **Árbol**: Para visualizar la jerarquía completa
- **Vista de tarjetas**: No aporta valor significativo para este tipo de datos estructurados
- **Simplicidad**: Menos opciones = interfaz más limpia y decisiones más fáciles

## Archivos Modificados

### `src/components/categories/category-filters.tsx`
```typescript
// ANTES: 3 vistas
interface CategoryFiltersProps {
  viewMode: 'list' | 'tree' | 'table'
  setViewMode: (mode: 'list' | 'tree' | 'table') => void
}

// DESPUÉS: 2 vistas
interface CategoryFiltersProps {
  viewMode: 'tree' | 'table'
  setViewMode: (mode: 'tree' | 'table') => void
}

// Controles de vista simplificados
<div className="flex items-center border rounded-md">
  <Button variant={viewMode === 'table' ? 'default' : 'ghost'}>
    <List className="h-4 w-4" />
    <span>Tabla</span>
  </Button>
  <Button variant={viewMode === 'tree' ? 'default' : 'ghost'}>
    <FolderTree className="h-4 w-4" />
    <span>Árbol</span>
  </Button>
</div>
```

### `src/hooks/categories/index.ts`
```typescript
// ANTES: Vista por defecto 'list'
const [viewMode, setViewMode] = useState<'list' | 'tree' | 'table'>('list')

// DESPUÉS: Vista por defecto 'table'
const [viewMode, setViewMode] = useState<'tree' | 'table'>('table')
```

### `src/components/categories/categories-page.tsx`
```typescript
// ANTES: Lógica condicional compleja
viewMode={viewMode === 'table' ? 'table' : 'cards'}
cardRenderer={(category) => <CategoryCard .../>}

// DESPUÉS: Siempre tabla cuando no es árbol
viewMode="table"
// Removido cardRenderer innecesario
```

## Resultado Final

### ✅ Interfaz Simplificada
- Solo 2 opciones de vista en lugar de 3
- Controles más limpios y directos
- Menos confusión para el usuario

### ✅ Vistas Optimizadas
- **Tabla**: Perfecta para ver detalles, filtrar y ordenar
- **Árbol**: Ideal para entender la jerarquía y relaciones
- **Vista por defecto**: Tabla (más práctica para gestión)

### ✅ Mejor UX para Categorías
- **Tabla**: Gestión eficiente con columnas de información
- **Árbol**: Navegación visual de la estructura jerárquica
- **Controles de árbol**: Expandir/contraer todo disponible

### ✅ Código Más Limpio
- Eliminada lógica condicional innecesaria
- Tipos TypeScript más precisos
- Menos imports no utilizados

## Flujo de Usuario Mejorado

1. **Vista por defecto**: Tabla con información detallada
2. **Cambio a árbol**: Para visualizar jerarquía completa
3. **Controles de árbol**: Expandir/contraer todo según necesidad
4. **Vuelta a tabla**: Para gestión detallada (editar, eliminar, etc.)

## Estado: ✅ COMPLETADO

El módulo de categorías ahora tiene una interfaz más limpia y enfocada, con solo las vistas que realmente aportan valor para la gestión de datos jerárquicos.