# Componentes de UI - Selección de Categorías

Este directorio contiene los componentes de interfaz de usuario para el módulo de selección de categorías mejorada.

## Componentes Implementados

### 1. SearchBar
**Archivo:** `SearchBar.tsx`  
**Requisitos:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 8.1, 8.4

Componente de búsqueda inteligente con:
- Debounce configurable (default: 300ms)
- Dropdown con resultados y paths completos
- Resaltado de términos coincidentes
- Navegación por teclado (flechas, Enter, Escape)
- Indicador de loading
- Botón para limpiar búsqueda

**Props:**
```typescript
interface SearchBarProps {
  onSearch: (query: string) => void;
  onResultSelect: (categoryId: string) => void;
  results: SearchResult[];
  isLoading: boolean;
  placeholder?: string;
  debounceMs?: number;
}
```

### 2. SuggestionEngine
**Archivo:** `SuggestionEngine.tsx`  
**Requisitos:** 2.1, 2.2, 2.3, 2.4, 2.5, 2.7

Motor de sugerencias contextuales que muestra:
- Hasta 5 sugerencias basadas en título y descripción
- Indicador de relevancia (Alta/Media/Baja)
- Path completo de cada categoría
- Keywords coincidentes
- Razón de la sugerencia

**Props:**
```typescript
interface SuggestionEngineProps {
  title: string;
  description: string;
  onSuggestionSelect: (categoryId: string) => void;
  suggestions: Suggestion[];
  isAnalyzing: boolean;
  maxSuggestions?: number;
}
```

### 3. CategoryTree
**Archivo:** `CategoryTree.tsx`  
**Requisitos:** 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7

Visualización jerárquica de categorías con:
- Estructura de árbol con 4 niveles
- Iconos y colores distintivos
- Tooltips con descripciones
- Contador de subcategorías
- Breadcrumbs de ruta seleccionada
- Expand/collapse de nodos

**Props:**
```typescript
interface CategoryTreeProps {
  categories: Category[];
  selectedPath: string[];
  onSelect: (categoryId: string, level: number) => void;
  mode?: 'full' | 'compact';
}
```

### 4. StepByStepNavigator
**Archivo:** `StepByStepNavigator.tsx`  
**Requisitos:** 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7

Navegación guiada paso a paso con:
- Indicador de progreso (Paso X de 4)
- Muestra solo categorías del nivel actual
- Botones de navegación (Anterior/Siguiente)
- Preview de ruta seleccionada
- Confirmación al completar

**Props:**
```typescript
interface StepByStepNavigatorProps {
  categories: Category[];
  currentLevel: number;
  selectedPath: string[];
  onNext: (categoryId: string) => void;
  onBack: () => void;
  onComplete: () => void;
}
```

### 5. FrequentCategories
**Archivo:** `FrequentCategories.tsx`  
**Requisitos:** 5.1, 5.2, 5.3, 5.4, 5.5

Muestra categorías más usadas por el cliente:
- Ranking de las 5 categorías más frecuentes
- Contador de uso
- Fecha de último uso
- Path completo
- Indicador de color

**Props:**
```typescript
interface FrequentCategoriesProps {
  frequentCategories: FrequentCategory[];
  onSelect: (categoryId: string) => void;
  isLoading: boolean;
  maxItems?: number;
}
```

### 6. ConfirmationPanel
**Archivo:** `ConfirmationPanel.tsx`  
**Requisitos:** 6.1, 6.2, 6.4, 6.5, 6.9, 6.11

Panel de confirmación con información contextual:
- Resumen visual de la categoría seleccionada
- Path completo con breadcrumbs
- Información del departamento
- Estadísticas (tiempo de respuesta, tickets recientes, popularidad)
- Número de técnicos asignados
- Botones de editar y confirmar

**Props:**
```typescript
interface ConfirmationPanelProps {
  category: Category;
  path: Category[];
  metadata: CategoryMetadata;
  onEdit: () => void;
  onConfirm: () => void;
}
```

## Uso

```typescript
import {
  SearchBar,
  SuggestionEngine,
  CategoryTree,
  StepByStepNavigator,
  FrequentCategories,
  ConfirmationPanel,
} from '@/features/category-selection/components';

// Ejemplo de uso en un componente padre
function CategorySelector() {
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  
  return (
    <div>
      <SearchBar
        onSearch={handleSearch}
        onResultSelect={handleResultSelect}
        results={searchResults}
        isLoading={isSearching}
      />
      
      <SuggestionEngine
        title={ticketTitle}
        description={ticketDescription}
        onSuggestionSelect={handleSuggestionSelect}
        suggestions={suggestions}
        isAnalyzing={isAnalyzing}
      />
      
      {/* ... otros componentes */}
    </div>
  );
}
```

## Accesibilidad

Todos los componentes implementan:
- Navegación por teclado completa
- Etiquetas ARIA apropiadas
- Indicadores de foco visibles
- Contraste de color WCAG 2.1 AA
- Soporte para lectores de pantalla

## Estilos

Los componentes utilizan:
- shadcn/ui components (Radix UI primitives)
- Tailwind CSS para estilos
- Modo oscuro compatible
- Diseño responsivo

## Dependencias

- React 18+
- lucide-react (iconos)
- @/components/ui/* (shadcn/ui)
- @/lib/utils (cn helper)
