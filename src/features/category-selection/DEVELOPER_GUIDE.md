# Guía de Uso para Desarrolladores - Category Selection

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Instalación y Configuración](#instalación-y-configuración)
3. [Uso Básico](#uso-básico)
4. [Componentes Principales](#componentes-principales)
5. [Hooks Personalizados](#hooks-personalizados)
6. [Feature Flags](#feature-flags)
7. [API Endpoints](#api-endpoints)
8. [Analytics](#analytics)
9. [Accesibilidad](#accesibilidad)
10. [Optimización de Rendimiento](#optimización-de-rendimiento)
11. [Troubleshooting](#troubleshooting)

---

## Introducción

El módulo de **Category Selection** proporciona una experiencia mejorada para la selección de categorías en el sistema de tickets. Incluye búsqueda inteligente, sugerencias contextuales, categorías frecuentes, navegación visual mejorada e integración con la base de conocimientos.

### Características Principales

- ✅ Búsqueda fuzzy con Fuse.js
- ✅ Sugerencias contextuales basadas en contenido del ticket
- ✅ Categorías frecuentes por usuario
- ✅ Navegación visual (árbol completo o paso a paso)
- ✅ Panel de confirmación con metadata
- ✅ Integración con knowledge base
- ✅ Analytics de interacciones
- ✅ Accesibilidad WCAG 2.1 AA
- ✅ Responsive design (desde 320px)
- ✅ Feature flags para rollout gradual

---

## Instalación y Configuración

### 1. Dependencias

El módulo requiere las siguientes dependencias (ya incluidas en el proyecto):

```json
{
  "dependencies": {
    "fuse.js": "^7.0.0",
    "@tanstack/react-query": "^5.0.0",
    "lucide-react": "^0.263.1"
  }
}
```

### 2. Inicializar Feature Flags

En tu archivo de inicialización de la aplicación (ej: `app/layout.tsx` o `_app.tsx`):

```typescript
import { initializeCategorySelectorFlags } from '@/features/category-selection/config/feature-flags';

// Inicializar feature flags al inicio de la aplicación
initializeCategorySelectorFlags();
```

### 3. Configurar React Query

Asegúrate de que tu aplicación tenga un `QueryClientProvider`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Tu aplicación */}
    </QueryClientProvider>
  );
}
```

---

## Uso Básico

### Ejemplo Mínimo

```tsx
import { CategorySelector } from '@/features/category-selection';
import { useState } from 'react';

function CreateTicketForm() {
  const [categoryId, setCategoryId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);

  // Cargar categorías (ejemplo)
  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data.data));
  }, []);

  return (
    <form>
      <CategorySelector
        value={categoryId}
        onChange={setCategoryId}
        clientId="user-123"
        categories={categories}
      />
    </form>
  );
}
```

### Ejemplo Completo con Validación

```tsx
import { CategorySelector } from '@/features/category-selection';
import { useState } from 'react';
import { z } from 'zod';

const ticketSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  categoryId: z.string().min(1, 'Debes seleccionar una categoría'),
});

function CreateTicketForm() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = ticketSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        categoryId: fieldErrors.categoryId?.[0] || '',
      });
      return;
    }

    // Enviar ticket...
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.title}
        onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
        placeholder="Título del ticket"
      />
      
      <textarea
        value={formData.description}
        onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
        placeholder="Descripción del problema"
      />

      <CategorySelector
        value={formData.categoryId}
        onChange={categoryId => setFormData(prev => ({ ...prev, categoryId }))}
        ticketTitle={formData.title}
        ticketDescription={formData.description}
        clientId="user-123"
        categories={categories}
        error={errors.categoryId}
      />

      <button type="submit">Crear Ticket</button>
    </form>
  );
}
```

---

## Componentes Principales

### CategorySelector

Componente principal que orquesta toda la funcionalidad.

**Props:**

```typescript
interface CategorySelectorProps {
  value?: string;                    // ID de categoría seleccionada
  onChange: (categoryId: string) => void;
  ticketTitle?: string;              // Para sugerencias contextuales
  ticketDescription?: string;        // Para sugerencias contextuales
  clientId: string;                  // Para categorías frecuentes
  categories: Category[];            // Lista de categorías activas
  error?: string;                    // Mensaje de error
  disabled?: boolean;                // Deshabilitar selector
  className?: string;                // Clases CSS adicionales
}
```

**Ejemplo:**

```tsx
<CategorySelector
  value={selectedCategoryId}
  onChange={handleCategoryChange}
  ticketTitle="No puedo imprimir"
  ticketDescription="La impresora no responde"
  clientId={currentUser.id}
  categories={allCategories}
  error={validationError}
  disabled={isSubmitting}
/>
```

### CategorySelectorWrapper

Wrapper que maneja la carga de categorías y feature flags automáticamente.

**Props:**

```typescript
interface CategorySelectorWrapperProps {
  value?: string;
  onChange: (categoryId: string) => void;
  ticketTitle?: string;
  ticketDescription?: string;
  clientId: string;
  error?: string;
  disabled?: boolean;
}
```

**Ejemplo:**

```tsx
// Uso simplificado - maneja carga de categorías automáticamente
<CategorySelectorWrapper
  value={categoryId}
  onChange={setCategoryId}
  clientId={currentUser.id}
  ticketTitle={title}
  ticketDescription={description}
/>
```

### Sub-componentes

Los siguientes componentes se usan internamente pero también pueden usarse de forma independiente:

- **SearchBar**: Barra de búsqueda con resultados
- **SuggestionEngine**: Motor de sugerencias contextuales
- **CategoryTree**: Árbol jerárquico de categorías
- **StepByStepNavigator**: Navegación guiada paso a paso
- **FrequentCategories**: Categorías frecuentes del usuario
- **ConfirmationPanel**: Panel de confirmación con metadata
- **RelatedArticles**: Artículos relacionados de KB
- **KnowledgeBaseSearch**: Búsqueda en base de conocimientos

---

## Hooks Personalizados

### useCategorySearch

Hook para búsqueda fuzzy de categorías.

```typescript
import { useCategorySearch } from '@/features/category-selection/hooks';

const { search, isSearching, searchHistory, clearHistory } = useCategorySearch({
  categories: allCategories,
  threshold: 0.3,      // 0.0 = exacto, 1.0 = cualquier cosa
  maxResults: 10,
});

// Realizar búsqueda
const results = search('impresora');

// results es un array de SearchResult:
// {
//   category: Category,
//   path: Category[],        // Path completo desde raíz
//   matchedFields: string[], // Campos donde hubo match
//   score: number            // 0-1, mayor es mejor
// }
```

### useCategorySuggestions

Hook para sugerencias contextuales basadas en texto.

```typescript
import { useCategorySuggestions } from '@/features/category-selection/hooks';

const { suggestions, isAnalyzing, refresh } = useCategorySuggestions({
  categories: allCategories,
  title: ticketTitle,
  description: ticketDescription,
  debounceMs: 500,
  maxSuggestions: 5,
});

// suggestions es un array de Suggestion:
// {
//   category: Category,
//   path: Category[],
//   relevanceScore: number,      // 0-1
//   matchedKeywords: string[],
//   reason: string               // Explicación de por qué se sugiere
// }
```

### useFrequentCategories

Hook para obtener categorías frecuentes del usuario.

```typescript
import { useFrequentCategories } from '@/features/category-selection/hooks';

const { frequentCategories, isLoading, error, refetch } = useFrequentCategories({
  clientId: currentUser.id,
  limit: 5,
  enabled: true,  // Opcional: deshabilitar query
});

// frequentCategories es un array de FrequentCategory:
// {
//   category: Category,
//   path: Category[],
//   usageCount: number,
//   lastUsed: Date
// }
```

### useCategoriesQuery

Hook para cargar todas las categorías con React Query.

```typescript
import { useCategoriesQuery } from '@/features/category-selection/hooks';

const { categories, isLoading, error } = useCategoriesQuery();
```

### useFeatureFlags

Hook para verificar feature flags.

```typescript
import { useFeatureFlags } from '@/features/category-selection/hooks';

const {
  isEnhancedSelectorEnabled,
  isSmartSearchEnabled,
  isSuggestionsEnabled,
  // ... otros flags
} = useFeatureFlags(currentUser.id, currentUser.role);
```

---

## Feature Flags

El sistema usa feature flags para permitir rollout gradual y A/B testing.

### Flags Disponibles

```typescript
const CATEGORY_SELECTOR_FLAGS = {
  ENHANCED_SELECTOR: 'enhanced_category_selector',      // Flag principal
  SMART_SEARCH: 'category_smart_search',                // Búsqueda inteligente
  SUGGESTIONS: 'category_suggestions',                  // Sugerencias contextuales
  FREQUENT_CATEGORIES: 'category_frequent',             // Categorías frecuentes
  STEP_BY_STEP: 'category_step_by_step',               // Navegación paso a paso
  KNOWLEDGE_BASE: 'category_knowledge_base',            // Integración KB
  VISUAL_ENHANCEMENTS: 'category_visual_enhancements',  // Mejoras visuales
  ANALYTICS: 'category_analytics',                      // Analytics
};
```

### Activar/Desactivar Features

#### Opción 1: Mediante Código

```typescript
import { featureFlagsService } from '@/lib/config/feature-flags';
import { CATEGORY_SELECTOR_FLAGS } from '@/features/category-selection/config/feature-flags';

// Activar feature
featureFlagsService.setFlag({
  id: CATEGORY_SELECTOR_FLAGS.SMART_SEARCH,
  name: 'Category Smart Search',
  description: 'Enable fuzzy search',
  enabled: true,
  rolloutPercentage: 100,  // 0-100
  conditions: [],
  variants: [],
}, 'category-selector-module');

// Desactivar feature
featureFlagsService.setFlag({
  id: CATEGORY_SELECTOR_FLAGS.SMART_SEARCH,
  enabled: false,
  // ... resto de config
}, 'category-selector-module');
```

#### Opción 2: Rollout Gradual

```typescript
// Activar para 50% de usuarios
featureFlagsService.setFlag({
  id: CATEGORY_SELECTOR_FLAGS.SUGGESTIONS,
  enabled: true,
  rolloutPercentage: 50,  // Solo 50% de usuarios verán la feature
  // ... resto de config
}, 'category-selector-module');
```

#### Opción 3: Condiciones Específicas

```typescript
// Activar solo para usuarios con rol ADMIN
featureFlagsService.setFlag({
  id: CATEGORY_SELECTOR_FLAGS.ANALYTICS,
  enabled: true,
  rolloutPercentage: 100,
  conditions: [
    {
      type: 'user_role',
      operator: 'equals',
      value: 'ADMIN',
    },
  ],
  variants: [],
}, 'category-selector-module');
```

### Verificar Feature Flags

```typescript
import { 
  isEnhancedSelectorEnabled,
  isCategorySelectorFeatureEnabled,
  getCategorySelectorConfig,
} from '@/features/category-selection/config/feature-flags';

// Verificar flag principal
if (isEnhancedSelectorEnabled(userId, userRole)) {
  // Usar selector mejorado
}

// Verificar feature específica
if (isCategorySelectorFeatureEnabled('SMART_SEARCH', userId, userRole)) {
  // Mostrar búsqueda inteligente
}

// Obtener configuración completa
const config = getCategorySelectorConfig(userId, userRole);
console.log(config.useEnhancedSelector);
console.log(config.enabledFeatures);
console.log(config.browserCapabilities);
console.log(config.fallbackMode);
```

### Fallback para Navegadores Antiguos

El sistema detecta automáticamente capacidades del navegador y usa fallback si es necesario:

```typescript
import { 
  browserSupportsEnhancedFeatures,
  detectBrowserCapabilities,
} from '@/features/category-selection/config/feature-flags';

// Verificar soporte del navegador
if (browserSupportsEnhancedFeatures()) {
  // Usar selector mejorado
} else {
  // Usar selector legacy (CategorySelectorFallback)
}

// Obtener capacidades específicas
const capabilities = detectBrowserCapabilities();
console.log(capabilities.supportsIntersectionObserver);
console.log(capabilities.supportsES6);
console.log(capabilities.supportsFlexbox);
```

---

## API Endpoints

### GET /api/categories/search

Busca categorías por query string.

**Request:**

```typescript
GET /api/categories/search?query=impresora&limit=10
```

**Response:**

```typescript
{
  success: true,
  data: {
    results: [
      {
        category: Category,
        path: Category[],
        matchScore: number
      }
    ],
    totalMatches: number
  }
}
```

### GET /api/categories/frequent

Obtiene categorías frecuentes de un cliente.

**Request:**

```typescript
GET /api/categories/frequent?clientId=user-123&limit=5
```

**Response:**

```typescript
{
  success: true,
  data: {
    categories: [
      {
        category: Category,
        path: Category[],
        usageCount: number,
        lastUsed: string  // ISO date
      }
    ]
  }
}
```

### GET /api/categories/metadata/:categoryId

Obtiene metadata de una categoría específica.

**Request:**

```typescript
GET /api/categories/metadata/cat-123
```

**Response:**

```typescript
{
  success: true,
  data: {
    categoryId: string,
    departmentName: string,
    departmentColor: string,
    averageResponseTimeHours: number | null,
    assignedTechniciansCount: number,
    recentTicketsCount: number,
    popularityScore: number
  }
}
```

### POST /api/analytics/category-selection

Registra evento de analytics.

**Request:**

```typescript
POST /api/analytics/category-selection
Content-Type: application/json

{
  eventType: 'search' | 'suggestion_click' | 'manual_select' | 'frequent_select' | 'category_change',
  clientId: string,
  categoryId?: string,
  searchQuery?: string,
  timeToSelect?: number,
  metadata?: Record<string, any>
}
```

**Response:**

```typescript
{
  success: true
}
```

---

## Analytics

El sistema registra automáticamente eventos de interacción para análisis.

### Eventos Registrados

- `search`: Usuario realizó búsqueda
- `suggestion_click`: Usuario seleccionó una sugerencia
- `manual_select`: Usuario seleccionó manualmente del árbol
- `frequent_select`: Usuario seleccionó de categorías frecuentes
- `category_change`: Usuario cambió la categoría después de seleccionar

### Datos Capturados

- Tiempo de selección (desde apertura hasta confirmación)
- Método de selección usado
- Búsquedas sin resultados
- Cambios de categoría
- Artículos de KB visualizados

### Consultar Analytics

```typescript
// Ejemplo de query para obtener analytics
const analytics = await prisma.category_analytics.findMany({
  where: {
    clientId: 'user-123',
    createdAt: {
      gte: new Date('2024-01-01'),
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
});

// Agrupar por tipo de evento
const eventCounts = analytics.reduce((acc, event) => {
  acc[event.eventType] = (acc[event.eventType] || 0) + 1;
  return acc;
}, {} as Record<string, number>);
```

---

## Accesibilidad

El módulo cumple con WCAG 2.1 nivel AA.

### Navegación por Teclado

- **Tab**: Navegar entre elementos
- **Enter**: Seleccionar elemento
- **Escape**: Cancelar/cerrar
- **Flechas**: Navegar en listas
- **Ctrl+K** (o Cmd+K): Enfocar búsqueda

### Lectores de Pantalla

Todos los componentes tienen:

- Etiquetas ARIA apropiadas
- Roles semánticos correctos
- Anuncios de cambios de estado con `aria-live`
- Descripciones contextuales

### Contraste de Color

Todos los elementos cumplen con ratio mínimo de contraste 4.5:1 para texto normal y 3:1 para texto grande.

### Testing de Accesibilidad

```bash
# Ejecutar tests de accesibilidad
npm run test:a11y

# O manualmente con herramientas
# - axe DevTools (extensión de navegador)
# - WAVE (extensión de navegador)
# - Lighthouse (Chrome DevTools)
```

---

## Optimización de Rendimiento

### Virtualización

Para listas largas de categorías, el sistema usa virtualización automática:

```typescript
// Configurado automáticamente en CategoryTree
// No requiere configuración adicional
```

### Caché

React Query cachea automáticamente:

- Categorías: 10 minutos
- Categorías frecuentes: 5 minutos
- Metadata: 5 minutos

```typescript
// Configuración en query.config.ts
export const categoryQueryOptions = {
  all: {
    staleTime: 10 * 60 * 1000,  // 10 minutos
    cacheTime: 15 * 60 * 1000,  // 15 minutos
  },
  frequent: {
    staleTime: 5 * 60 * 1000,   // 5 minutos
    cacheTime: 10 * 60 * 1000,  // 10 minutos
  },
};
```

### Debounce

Búsqueda y sugerencias usan debounce para evitar llamadas excesivas:

```typescript
// Búsqueda: 300ms (configurado en SearchBar)
// Sugerencias: 500ms (configurable en useCategorySuggestions)
```

### Code Splitting

Importa componentes de forma lazy si es necesario:

```typescript
import dynamic from 'next/dynamic';

const CategorySelector = dynamic(
  () => import('@/features/category-selection').then(mod => mod.CategorySelector),
  { ssr: false }
);
```

---

## Troubleshooting

### Problema: Categorías no se cargan

**Solución:**

1. Verificar que el endpoint `/api/categories` esté funcionando
2. Verificar que React Query esté configurado
3. Revisar console para errores de red

```typescript
// Debug
const { categories, isLoading, error } = useCategoriesQuery();
console.log({ categories, isLoading, error });
```

### Problema: Búsqueda no funciona

**Solución:**

1. Verificar que Fuse.js esté instalado: `npm list fuse.js`
2. Verificar que las categorías tengan datos válidos
3. Verificar threshold (valores muy bajos pueden no dar resultados)

```typescript
// Ajustar threshold
const { search } = useCategorySearch({
  categories,
  threshold: 0.5,  // Más permisivo
});
```

### Problema: Sugerencias no aparecen

**Solución:**

1. Verificar que `ticketTitle` o `ticketDescription` tengan contenido
2. Verificar que el texto tenga al menos 3 caracteres
3. Verificar que las categorías tengan keywords

```typescript
// Debug
const { suggestions, isAnalyzing } = useCategorySuggestions({
  categories,
  title,
  description,
});
console.log({ suggestions, isAnalyzing, title, description });
```

### Problema: Feature flags no funcionan

**Solución:**

1. Verificar que `initializeCategorySelectorFlags()` se llamó al inicio
2. Verificar que el servicio de feature flags esté configurado

```typescript
// Debug
import { getCategorySelectorConfig } from '@/features/category-selection/config/feature-flags';

const config = getCategorySelectorConfig(userId, userRole);
console.log(config);
```

### Problema: Analytics no se registran

**Solución:**

1. Verificar que el endpoint `/api/analytics/category-selection` esté funcionando
2. Verificar que el flag `ANALYTICS` esté habilitado
3. Revisar console para errores de red

```typescript
// Test manual
await fetch('/api/analytics/category-selection', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventType: 'search',
    clientId: 'test-user',
    searchQuery: 'test',
  }),
});
```

---

## Recursos Adicionales

- [README.md](./README.md) - Visión general del módulo
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Guía de integración
- [ACCESSIBILITY.md](./ACCESSIBILITY.md) - Detalles de accesibilidad
- [PERFORMANCE.md](./PERFORMANCE.md) - Optimizaciones de rendimiento
- [KNOWLEDGE_BASE_INTEGRATION.md](./KNOWLEDGE_BASE_INTEGRATION.md) - Integración con KB

---

## Soporte

Para preguntas o problemas:

1. Revisar esta guía y documentación relacionada
2. Revisar tests en `__tests__/` para ejemplos de uso
3. Contactar al equipo de desarrollo
