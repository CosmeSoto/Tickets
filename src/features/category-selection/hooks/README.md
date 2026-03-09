# Category Selection Hooks

## useCategorySearch

Hook para búsqueda fuzzy de categorías con Fuse.js. Proporciona búsqueda en tiempo real sobre nombres, descripciones y palabras clave de categorías, con historial de búsquedas en la sesión.

### Características

- ✅ Búsqueda fuzzy con Fuse.js
- ✅ Búsqueda sin distinción de mayúsculas/minúsculas
- ✅ Búsqueda sin acentos (normalización de texto)
- ✅ Resaltado de términos coincidentes
- ✅ Historial de búsquedas en sessionStorage
- ✅ Configuración de threshold y máximo de resultados
- ✅ Manejo de consultas vacías

### Uso Básico

```tsx
import { useCategorySearch } from '@/features/category-selection';

function CategorySearchComponent({ categories }) {
  const { search, isSearching, searchHistory, clearHistory } = useCategorySearch({
    categories,
    threshold: 0.3,
    maxResults: 10
  });

  const handleSearch = (query: string) => {
    const results = search(query);
    console.log('Resultados:', results);
  };

  return (
    <div>
      <input 
        type="text" 
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Buscar categoría..."
      />
      {isSearching && <p>Buscando...</p>}
      
      {searchHistory.length > 0 && (
        <div>
          <h3>Historial de búsquedas:</h3>
          <ul>
            {searchHistory.map((query, i) => (
              <li key={i}>{query}</li>
            ))}
          </ul>
          <button onClick={clearHistory}>Limpiar historial</button>
        </div>
      )}
    </div>
  );
}
```

### Opciones

#### `categories` (requerido)
Array de categorías sobre las cuales realizar la búsqueda.

```typescript
interface Category {
  id: string;
  name: string;
  description: string | null;
  level: number;
  parentId: string | null;
  // ... otros campos
}
```

#### `threshold` (opcional)
Umbral de similitud para la búsqueda fuzzy. Valores entre 0 y 1.
- `0.0` = coincidencia exacta
- `0.3` = permite hasta 30% de diferencia (default)
- `1.0` = coincide con todo

```tsx
const { search } = useCategorySearch({
  categories,
  threshold: 0.2 // Búsqueda más estricta
});
```

#### `maxResults` (opcional)
Número máximo de resultados a retornar. Default: 10.

```tsx
const { search } = useCategorySearch({
  categories,
  maxResults: 5 // Solo los 5 mejores resultados
});
```

### Valor de Retorno

#### `search(query: string): SearchResult[]`
Función para realizar búsquedas. Retorna array de resultados ordenados por relevancia.

```typescript
interface SearchResult {
  category: Category;           // Categoría encontrada
  path: Category[];            // Ruta completa desde nivel 1
  matchedFields: string[];     // Campos donde hubo coincidencia
  score: number;               // Relevancia (0-1, mayor es mejor)
}
```

**Ejemplo:**
```tsx
const results = search('impresora');
// [
//   {
//     category: { id: '3', name: 'Impresoras', ... },
//     path: [
//       { id: '1', name: 'INFRAESTRUCTURA', ... },
//       { id: '3', name: 'Impresoras', ... }
//     ],
//     matchedFields: ['name'],
//     score: 0.95
//   }
// ]
```

#### `isSearching: boolean`
Indica si hay una búsqueda en progreso.

```tsx
{isSearching && <Spinner />}
```

#### `searchHistory: string[]`
Array con el historial de búsquedas del usuario (máximo 10 items).

```tsx
{searchHistory.map(query => (
  <button onClick={() => search(query)}>
    {query}
  </button>
))}
```

#### `clearHistory(): void`
Función para limpiar el historial de búsquedas.

```tsx
<button onClick={clearHistory}>
  Limpiar historial
</button>
```

### Comportamiento

#### Consultas Vacías
Las consultas vacías o con menos de 2 caracteres retornan array vacío:

```tsx
search('');    // []
search('a');   // []
search('ab');  // [resultados...]
```

#### Normalización de Texto
El hook normaliza automáticamente el texto para búsqueda:

```tsx
search('IMPRESORA');  // Encuentra "Impresoras"
search('tecnico');    // Encuentra "SOPORTE TÉCNICO" (sin acento)
search('impresra');   // Encuentra "Impresoras" (fuzzy matching)
```

#### Historial de Búsquedas
- Se guarda automáticamente en sessionStorage
- Máximo 10 items
- Evita duplicados
- Persiste durante la sesión del navegador
- No guarda búsquedas menores a 2 caracteres

### Ejemplo Completo

```tsx
import { useState } from 'react';
import { useCategorySearch } from '@/features/category-selection';
import type { SearchResult } from '@/features/category-selection';

function CategorySearchBar({ categories, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  
  const { search, isSearching, searchHistory } = useCategorySearch({
    categories,
    threshold: 0.3,
    maxResults: 10
  });

  const handleSearch = (value: string) => {
    setQuery(value);
    const searchResults = search(value);
    setResults(searchResults);
  };

  const handleSelect = (result: SearchResult) => {
    onSelect(result.category);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Buscar categoría..."
        className="w-full px-4 py-2 border rounded"
      />
      
      {isSearching && (
        <div className="absolute right-2 top-2">
          <Spinner />
        </div>
      )}

      {results.length > 0 && (
        <div className="absolute w-full mt-1 bg-white border rounded shadow-lg">
          {results.map((result) => (
            <button
              key={result.category.id}
              onClick={() => handleSelect(result)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100"
            >
              <div className="font-medium">{result.category.name}</div>
              <div className="text-sm text-gray-500">
                {result.path.map(c => c.name).join(' > ')}
              </div>
              <div className="text-xs text-gray-400">
                Relevancia: {Math.round(result.score * 100)}%
              </div>
            </button>
          ))}
        </div>
      )}

      {searchHistory.length > 0 && !query && (
        <div className="mt-2">
          <p className="text-sm text-gray-600">Búsquedas recientes:</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {searchHistory.map((historyQuery, i) => (
              <button
                key={i}
                onClick={() => handleSearch(historyQuery)}
                className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
              >
                {historyQuery}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Requisitos Cumplidos

Este hook implementa los siguientes requisitos del spec:

- **1.2**: Búsqueda en nombres, descripciones y palabras clave
- **1.3**: Muestra path completo para cada coincidencia
- **1.4**: Máximo de resultados ordenados por relevancia
- **1.5**: Resaltado de términos coincidentes (via matchedFields)
- **1.7**: Búsqueda sin distinción de mayúsculas/minúsculas
- **1.8**: Ignora acentos y caracteres especiales

### Notas Técnicas

- Usa Fuse.js v7+ para búsqueda fuzzy
- El índice de búsqueda se construye automáticamente con `useMemo`
- El historial se persiste en sessionStorage
- Maneja errores de sessionStorage gracefully
- Optimizado para re-renders con `useCallback` y `useMemo`
