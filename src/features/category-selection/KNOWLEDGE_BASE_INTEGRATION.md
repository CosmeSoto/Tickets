# Integración con Base de Conocimientos

## Resumen

Se implementó la integración completa con la tabla `knowledge_articles` para el módulo de selección de categorías. Esta integración permite a los usuarios encontrar soluciones a sus problemas antes de crear un ticket, mejorando la eficiencia del sistema de soporte.

## Componentes Implementados

### 1. RelatedArticles

**Ubicación:** `src/features/category-selection/components/RelatedArticles.tsx`

**Funcionalidad:**
- Muestra hasta 3 artículos relacionados con la categoría seleccionada
- Ordena artículos por relevancia (coincidencia con problema + votos útiles + fecha)
- Muestra badge "Soluciones disponibles" para categorías con >70% de votos útiles
- Calcula relevancia basándose en el título y descripción del ticket

**Props:**
- `categoryId`: ID de la categoría seleccionada
- `ticketTitle`: Título del ticket (opcional, para mejorar relevancia)
- `ticketDescription`: Descripción del ticket (opcional, para mejorar relevancia)
- `onArticleClick`: Callback cuando se hace clic en un artículo
- `maxArticles`: Número máximo de artículos a mostrar (default: 3)

**Requisitos cubiertos:** 7.1, 7.2, 7.7, 7.8, 7.9

### 2. ArticleViewerModal

**Ubicación:** `src/features/category-selection/components/ArticleViewerModal.tsx`

**Funcionalidad:**
- Modal/panel para ver artículos sin perder contexto del formulario
- Permite votar si el artículo fue útil o no
- Opción para marcar el problema como resuelto (cancela creación de ticket)
- Opción para continuar con el ticket (registra interacción)
- Incrementa contador de vistas automáticamente
- Permite vincular artículo como referencia si se crea el ticket

**Props:**
- `articleId`: ID del artículo a mostrar
- `open`: Estado de apertura del modal
- `onOpenChange`: Callback para cambiar estado de apertura
- `onMarkResolved`: Callback cuando el usuario marca el problema como resuelto
- `onContinueWithTicket`: Callback cuando el usuario decide continuar con el ticket

**Requisitos cubiertos:** 7.3, 7.4, 7.5, 7.11

### 3. KnowledgeBaseSearch

**Ubicación:** `src/features/category-selection/components/KnowledgeBaseSearch.tsx`

**Funcionalidad:**
- Búsqueda directa en la base de conocimientos desde el selector
- Búsqueda con debounce de 500ms
- Muestra hasta 10 resultados ordenados por relevancia
- Resalta artículos con alta relevancia
- Muestra información de votos útiles y tags

**Props:**
- `onArticleClick`: Callback cuando se hace clic en un artículo
- `placeholder`: Texto del placeholder (opcional)

**Requisitos cubiertos:** 7.10

## API Endpoints Implementados

### 1. GET /api/knowledge-articles/related

**Descripción:** Busca artículos relacionados con una categoría y opcionalmente con el contenido del ticket.

**Query Parameters:**
- `categoryId` (requerido): ID de la categoría
- `title` (opcional): Título del ticket para mejorar relevancia
- `description` (opcional): Descripción del ticket para mejorar relevancia
- `limit` (opcional): Número máximo de artículos (default: 3)

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "articles": [
      {
        "article": { /* KnowledgeArticle */ },
        "relevanceScore": 0.85
      }
    ],
    "total": 3
  }
}
```

**Algoritmo de Relevancia:**
1. Extrae palabras clave del título y descripción (palabras >3 caracteres)
2. Busca coincidencias en título (peso 3), resumen (peso 2) y contenido (peso 1)
3. Calcula score base según número de coincidencias
4. Ajusta score con ratio de votos útiles (30% del score final)
5. Ordena por relevancia descendente

### 2. GET /api/knowledge-articles/[id]

**Descripción:** Obtiene un artículo de conocimiento por su ID.

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "article": { /* KnowledgeArticle completo */ }
  }
}
```

### 3. POST /api/knowledge-articles/[id]/view

**Descripción:** Incrementa el contador de vistas de un artículo.

**Respuesta:**
```json
{
  "success": true
}
```

### 4. POST /api/knowledge-articles/[id]/vote

**Descripción:** Registra un voto (útil/no útil) para un artículo.

**Body:**
```json
{
  "isHelpful": true
}
```

**Funcionalidad:**
- Previene votos duplicados del mismo usuario
- Permite cambiar el voto si ya existe
- Actualiza contadores de votos en el artículo
- Registra el voto en la tabla `article_votes`

**Respuesta:**
```json
{
  "success": true
}
```

### 5. GET /api/knowledge-articles/search

**Descripción:** Busca artículos en la base de conocimientos por texto.

**Query Parameters:**
- `query` (requerido): Texto de búsqueda (mínimo 2 caracteres)
- `limit` (opcional): Número máximo de resultados (default: 10)

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "article": { /* KnowledgeArticle */ },
        "relevanceScore": 0.92
      }
    ],
    "total": 5,
    "query": "impresora"
  }
}
```

**Algoritmo de Búsqueda:**
1. Normaliza el texto de búsqueda (sin acentos, lowercase)
2. Extrae palabras clave (palabras >2 caracteres)
3. Busca en título (peso 5), resumen (peso 3), tags (peso 3) y contenido (peso 1)
4. Bonus por coincidencia exacta en título (+0.3)
5. Ajusta score con ratio de votos útiles (20% del score final)
6. Filtra resultados con relevancia >0.1
7. Ordena por relevancia descendente

## Tipos TypeScript

Se agregaron los siguientes tipos en `src/features/category-selection/types/index.ts`:

```typescript
export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  categoryId: string;
  tags: string[];
  views: number;
  helpfulVotes: number;
  notHelpfulVotes: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RelatedArticle {
  article: KnowledgeArticle;
  relevanceScore: number;
  matchReason: string;
}
```

## Integración con Analytics

Los componentes registran eventos de interacción con el sistema de analytics:

- `article_resolved`: Cuando un artículo resuelve el problema del usuario
- `article_read_continue`: Cuando el usuario lee un artículo pero continúa con el ticket

Estos eventos se envían a `/api/analytics/category-selection` para análisis posterior.

## Uso

### Ejemplo básico con RelatedArticles

```tsx
import { RelatedArticles, ArticleViewerModal } from '@/features/category-selection/components';

function CategorySelector() {
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleArticleClick = (articleId: string) => {
    setSelectedArticleId(articleId);
    setIsModalOpen(true);
  };

  const handleMarkResolved = () => {
    setIsModalOpen(false);
    // Cancelar creación de ticket
  };

  const handleContinueWithTicket = () => {
    setIsModalOpen(false);
    // Continuar con el formulario
  };

  return (
    <>
      <RelatedArticles
        categoryId={selectedCategoryId}
        ticketTitle={title}
        ticketDescription={description}
        onArticleClick={handleArticleClick}
      />

      <ArticleViewerModal
        articleId={selectedArticleId}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onMarkResolved={handleMarkResolved}
        onContinueWithTicket={handleContinueWithTicket}
      />
    </>
  );
}
```

### Ejemplo con KnowledgeBaseSearch

```tsx
import { KnowledgeBaseSearch, ArticleViewerModal } from '@/features/category-selection/components';

function CategorySelector() {
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleArticleClick = (articleId: string) => {
    setSelectedArticleId(articleId);
    setIsModalOpen(true);
  };

  return (
    <>
      <KnowledgeBaseSearch onArticleClick={handleArticleClick} />

      <ArticleViewerModal
        articleId={selectedArticleId}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onMarkResolved={() => {/* ... */}}
        onContinueWithTicket={() => {/* ... */}}
      />
    </>
  );
}
```

## Rendimiento

- **Carga asíncrona**: Los artículos se cargan de forma asíncrona sin bloquear la UI
- **Debounce**: La búsqueda tiene un debounce de 500ms para evitar llamadas excesivas
- **Límite de resultados**: Se limitan los resultados para mantener tiempos de respuesta rápidos
- **Índices de base de datos**: Se aprovechan los índices existentes en `knowledge_articles`:
  - `@@index([categoryId, isPublished])`
  - `@@index([helpfulVotes(sort: Desc)])`
  - `@@index([title, content])`

## Accesibilidad

- Todos los componentes son navegables por teclado
- Se usan componentes de shadcn/ui que cumplen con WCAG 2.1 AA
- Los modales se pueden cerrar con Escape
- Los botones tienen áreas de toque adecuadas (44x44px mínimo)

## Próximos Pasos

Para completar la integración, se debe:

1. Integrar los componentes en el componente principal `CategorySelector`
2. Implementar la lógica para cancelar la creación de ticket cuando se marca como resuelto
3. Implementar la lógica para vincular artículos como referencia en tickets creados
4. Agregar tests unitarios para los componentes
5. Agregar tests de integración para los endpoints de API

## Notas Técnicas

- Se usa Next.js 15+ con params como Promise en las rutas dinámicas
- Se usa prisma como cliente de base de datos (importación por defecto)
- Los componentes son client-side ('use client') para interactividad
- Se mantiene compatibilidad con la estructura existente de `knowledge_articles`
