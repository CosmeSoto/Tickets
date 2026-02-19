# TAREA 3: Componentes UI para Base de Conocimientos

## Objetivo
Crear los componentes de interfaz para visualizar y gestionar artículos de conocimiento.

## Componentes a Crear

### 1. `/src/components/knowledge/knowledge-search.tsx`
**Propósito:** Buscador de artículos con filtros

**Props:**
```typescript
interface KnowledgeSearchProps {
  onArticleSelect?: (article: Article) => void
  categoryId?: string
  showFilters?: boolean
  placeholder?: string
}
```

**Características:**
- Input de búsqueda con debounce
- Filtros por categoría y tags
- Resultados en tiempo real
- Vista previa de artículos
- Resaltado de términos de búsqueda

### 2. `/src/components/knowledge/article-card.tsx`
**Propósito:** Tarjeta de artículo en listados

**Props:**
```typescript
interface ArticleCardProps {
  article: Article
  onClick?: () => void
  showAuthor?: boolean
  showStats?: boolean
}
```

**Muestra:**
- Título y resumen
- Categoría y tags
- Autor y fecha
- Estadísticas (views, votos)
- Badge de "Muy útil" si tiene muchos votos positivos

### 3. `/src/components/knowledge/article-viewer.tsx`
**Propósito:** Vista completa de un artículo

**Props:**
```typescript
interface ArticleViewerProps {
  articleId: string
  onVote?: (isHelpful: boolean) => void
  showActions?: boolean
}
```

**Características:**
- Renderizado de Markdown
- Sistema de votación
- Información del autor
- Artículos relacionados
- Botón "Crear ticket si no resuelve"
- Compartir artículo

### 4. `/src/components/knowledge/create-article-dialog.tsx`
**Propósito:** Modal para crear artículo desde ticket

**Props:**
```typescript
interface CreateArticleDialogProps {
  isOpen: boolean
  onClose: () => void
  ticketId: string
  ticketTitle: string
  ticketDescription: string
  categoryId: string
  onSuccess?: () => void
}
```

**Campos:**
- Título (pre-llenado del ticket)
- Resumen corto
- Contenido (editor Markdown)
- Tags (selector múltiple)
- Vista previa

### 5. `/src/components/knowledge/similar-articles-panel.tsx`
**Propósito:** Panel lateral con artículos similares

**Props:**
```typescript
interface SimilarArticlesPanelProps {
  title: string
  description: string
  categoryId: string
  maxResults?: number
}
```

**Características:**
- Búsqueda automática de similares
- Lista compacta de artículos
- Click para ver detalles
- Indicador de relevancia

### 6. `/src/components/knowledge/article-stats.tsx`
**Propósito:** Estadísticas de un artículo

**Props:**
```typescript
interface ArticleStatsProps {
  views: number
  helpfulVotes: number
  notHelpfulVotes: number
  compact?: boolean
}
```

**Muestra:**
- Número de vistas
- Porcentaje de votos útiles
- Gráfico visual simple

### 7. `/src/components/tickets/resolve-ticket-dialog.tsx`
**Propósito:** Modal mejorado para resolver ticket

**Props:**
```typescript
interface ResolveTicketDialogProps {
  isOpen: boolean
  onClose: () => void
  ticketId: string
  ticketData: Ticket
  onSuccess?: () => void
}
```

**Opciones:**
- Marcar como resuelto
- Agregar comentario final
- ✨ **NUEVO:** Checkbox "Crear artículo de conocimiento"
- Si checkbox activo → Abre CreateArticleDialog

## Páginas a Crear

### 1. `/src/app/knowledge/page.tsx`
**Ruta:** `/knowledge`
**Acceso:** Todos los usuarios autenticados

**Contenido:**
- Buscador principal
- Categorías populares
- Artículos más vistos
- Artículos recientes
- Artículos mejor valorados

### 2. `/src/app/knowledge/[id]/page.tsx`
**Ruta:** `/knowledge/[id]`
**Acceso:** Todos los usuarios autenticados

**Contenido:**
- Vista completa del artículo
- Sistema de votación
- Artículos relacionados
- Comentarios (opcional)
- Botón "Crear ticket" si no resuelve

### 3. `/src/app/admin/knowledge/page.tsx`
**Ruta:** `/admin/knowledge`
**Acceso:** ADMIN y TECHNICIAN

**Contenido:**
- Lista de todos los artículos
- Filtros avanzados
- Estadísticas globales
- Crear nuevo artículo
- Editar/Eliminar artículos

## Hooks a Crear

### 1. `/src/hooks/use-knowledge.ts`
**Funciones:**
```typescript
export function useKnowledge() {
  return {
    articles: Article[],
    loading: boolean,
    error: string | null,
    searchArticles: (query: string) => Promise<Article[]>,
    getArticle: (id: string) => Promise<Article>,
    createArticle: (data: CreateArticleData) => Promise<Article>,
    updateArticle: (id: string, data: UpdateArticleData) => Promise<Article>,
    deleteArticle: (id: string) => Promise<boolean>,
    voteArticle: (id: string, isHelpful: boolean) => Promise<void>,
    getSimilar: (query: SimilarQuery) => Promise<Article[]>
  }
}
```

### 2. `/src/hooks/use-article-search.ts`
**Funciones:**
```typescript
export function useArticleSearch(initialQuery?: string) {
  return {
    query: string,
    setQuery: (query: string) => void,
    results: Article[],
    loading: boolean,
    filters: SearchFilters,
    setFilters: (filters: SearchFilters) => void,
    clearFilters: () => void
  }
}
```

## Estilos y UX

### Diseño:
- Usar componentes shadcn/ui existentes
- Mantener consistencia con el resto del sistema
- Iconos de Lucide React
- Colores según rol (como en otros módulos)

### Experiencia:
- Búsqueda instantánea (debounce 300ms)
- Loading states claros
- Empty states informativos
- Feedback visual en votaciones
- Animaciones suaves

## Integración con Tickets

### Para Técnicos:
1. En vista de ticket → Panel lateral "Soluciones Similares"
2. Al resolver ticket → Opción "Crear artículo"
3. En lista de tickets → Badge si tiene artículo asociado

### Para Clientes:
1. Antes de crear ticket → "Buscar soluciones"
2. En vista de ticket resuelto → Ver artículo si existe
3. Página de conocimientos accesible desde menú

## Validación
- ✅ Todos los componentes renderizados correctamente
- ✅ Búsqueda funciona en tiempo real
- ✅ Votación actualiza contadores
- ✅ Crear artículo desde ticket funciona
- ✅ Responsive en móvil y desktop
- ✅ Accesibilidad (ARIA labels, keyboard navigation)

## Siguiente Tarea
TAREA 4: Integración con Módulo de Tickets
