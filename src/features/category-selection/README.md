# Módulo de Selección de Categorías

Este módulo implementa un sistema de selección de categorías multi-modal para el módulo de creación de tickets.

## Estructura de Directorios

```
category-selection/
├── config/           # Configuraciones de Fuse.js y React Query
│   ├── fuse.config.ts
│   └── query.config.ts
├── types/            # Definiciones de tipos TypeScript
│   └── index.ts
├── utils/            # Utilidades para búsqueda e índices
│   └── search-index.ts
├── hooks/            # Custom hooks (próximamente)
├── components/       # Componentes React (próximamente)
├── index.ts          # Exportaciones principales
└── README.md         # Este archivo
```

## Características

- **Búsqueda Fuzzy**: Búsqueda inteligente con Fuse.js
- **Caché Optimizado**: React Query para caché de categorías
- **Normalización de Texto**: Búsqueda sin acentos y case-insensitive
- **Índice de Búsqueda**: Estructura optimizada para búsquedas rápidas

## Uso

```typescript
import {
  buildSearchIndex,
  filterActiveCategories,
  categoryQueryKeys,
} from '@/features/category-selection';

// Construir índice de búsqueda
const activeCategories = filterActiveCategories(categories);
const searchIndex = buildSearchIndex(activeCategories);

// Usar con React Query
const queryKey = categoryQueryKeys.active();
```

## Requisitos Implementados

- ✅ Requisito 11.1: Estructura de datos compatible con sistema existente
- ✅ Requisito 11.2: Funciona con 76 categorías actuales
- ✅ Requisito 11.3: Mantiene API existente sin cambios breaking

## Próximos Pasos

1. Implementar custom hooks (useCategorySearch, useCategorySuggestions)
2. Crear componentes de UI (SearchBar, CategoryTree, etc.)
3. Integrar con formulario de creación de tickets
