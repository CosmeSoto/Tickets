# Mejora: Controles de Expandir/Contraer Todo para Vista de Árbol

## Problema Identificado
La vista de árbol de categorías no tenía controles globales para expandir o contraer todas las categorías de una vez, lo que dificultaba la navegación cuando había muchas categorías jerárquicas.

## Solución Implementada

### 1. Controles Contextuales en Filtros
- **Ubicación**: Los controles aparecen solo cuando se selecciona la vista de árbol
- **Posición**: A la derecha de los controles de vista, antes de los botones de acción
- **Diseño**: Dos botones agrupados con iconos descriptivos

### 2. Funcionalidad Implementada

#### Controles Visuales
```typescript
{/* Controles específicos para vista de árbol */}
{viewMode === 'tree' && (
  <div className="flex items-center border rounded-md">
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        window.dispatchEvent(new CustomEvent('expandAllCategories'))
      }}
      className="rounded-r-none border-r text-xs px-2"
      title="Expandir todas las categorías"
    >
      <ChevronDown className="h-3 w-3 mr-1" />
      <span>Expandir todo</span>
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        window.dispatchEvent(new CustomEvent('collapseAllCategories'))
      }}
      className="rounded-l-none text-xs px-2"
      title="Contraer todas las categorías"
    >
      <ChevronRight className="h-3 w-3 mr-1" />
      <span>Contraer todo</span>
    </Button>
  </div>
)}
```

#### Funcionalidad en CategoryTree
- **Eventos personalizados**: Usa `window.dispatchEvent` para comunicación entre componentes
- **Estado global**: Mantiene el estado de expansión de todos los nodos
- **Inicialización inteligente**: Auto-expande los primeros 2 niveles por defecto
- **Persistencia**: Mantiene el estado durante la sesión

### 3. Características de UX

#### Comportamiento Inteligente
- **Aparición contextual**: Los controles solo aparecen en vista de árbol
- **Iconos descriptivos**: 
  - `ChevronDown` para expandir (indica que se abrirán los nodos)
  - `ChevronRight` para contraer (indica que se cerrarán los nodos)
- **Tooltips informativos**: Explican claramente la acción de cada botón

#### Estado Inicial Optimizado
- **Auto-expansión**: Los primeros 2 niveles se expanden automáticamente
- **Rendimiento**: Evita expandir todo por defecto para mejor performance
- **Navegación intuitiva**: Muestra la estructura principal sin abrumar

### 4. Implementación Técnica

#### Comunicación Entre Componentes
```typescript
// En CategoryFilters - Disparar eventos
window.dispatchEvent(new CustomEvent('expandAllCategories'))
window.dispatchEvent(new CustomEvent('collapseAllCategories'))

// En CategoryTree - Escuchar eventos
useEffect(() => {
  const handleExpandAll = () => expandAll()
  const handleCollapseAll = () => collapseAll()

  window.addEventListener('expandAllCategories', handleExpandAll)
  window.addEventListener('collapseAllCategories', handleCollapseAll)

  return () => {
    window.removeEventListener('expandAllCategories', handleExpandAll)
    window.removeEventListener('collapseAllCategories', handleCollapseAll)
  }
}, [expandAll, collapseAll])
```

#### Gestión de Estado
```typescript
// Estado de nodos expandidos
const [expandedNodes, setExpandedNodes] = useState<Set<string>>()

// Expandir todos los nodos
const expandAll = useCallback(() => {
  const allNodeIds = new Set<string>()
  collectAllIds(categories, allNodeIds)
  setExpandedNodes(allNodeIds)
}, [categories])

// Contraer todos los nodos
const collapseAll = useCallback(() => {
  setExpandedNodes(new Set())
}, [])
```

## Archivos Modificados

### `src/components/categories/category-filters.tsx`
- **Agregado**: Controles contextuales para vista de árbol
- **Agregado**: Eventos personalizados para comunicación
- **Mejorado**: Layout responsive para acomodar nuevos controles

### `src/components/ui/category-tree.tsx`
- **Agregado**: Listeners para eventos de expandir/contraer todo
- **Mejorado**: Gestión de estado de expansión global
- **Optimizado**: Inicialización inteligente de nodos expandidos

## Resultado Final

### ✅ Mejor Navegación
- Controles rápidos para expandir/contraer toda la jerarquía
- Navegación más eficiente en estructuras complejas
- Estado inicial optimizado para mostrar estructura principal

### ✅ UX Contextual
- Controles aparecen solo cuando son relevantes (vista de árbol)
- Iconos y texto descriptivos para claridad
- Tooltips informativos para mejor usabilidad

### ✅ Implementación Limpia
- Comunicación eficiente entre componentes
- Estado gestionado correctamente
- Performance optimizada para grandes jerarquías

### ✅ Consistencia Visual
- Diseño coherente con el resto de controles
- Agrupación lógica de funcionalidades relacionadas
- Responsive design para diferentes pantallas

## Casos de Uso

1. **Exploración inicial**: Usar "Expandir todo" para ver toda la estructura
2. **Navegación enfocada**: Usar "Contraer todo" y expandir solo secciones relevantes
3. **Búsqueda visual**: Expandir todo para buscar categorías específicas
4. **Presentaciones**: Contraer todo para mostrar solo la estructura principal

## Estado: ✅ COMPLETADO

Los controles de expandir/contraer todo para la vista de árbol han sido implementados exitosamente, mejorando significativamente la navegación en jerarquías complejas de categorías.