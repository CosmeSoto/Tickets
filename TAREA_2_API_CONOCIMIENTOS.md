# TAREA 2: API Endpoints para Base de Conocimientos

## Objetivo
Crear los endpoints de API para gestionar artículos de conocimiento.

## Archivos a Crear

### 1. `/src/app/api/knowledge/route.ts`
**Endpoints:**
- `GET /api/knowledge` - Listar artículos (con filtros y búsqueda)
- `POST /api/knowledge` - Crear nuevo artículo (solo TECHNICIAN/ADMIN)

**Funcionalidades:**
```typescript
// GET - Parámetros de búsqueda
{
  search?: string,        // Buscar en título y contenido
  categoryId?: string,    // Filtrar por categoría
  tags?: string[],        // Filtrar por tags
  authorId?: string,      // Filtrar por autor
  sortBy?: 'views' | 'helpful' | 'recent', // Ordenar
  page?: number,
  limit?: number
}

// POST - Crear artículo
{
  title: string,
  content: string,
  summary?: string,
  categoryId: string,
  tags: string[],
  sourceTicketId?: string
}
```

### 2. `/src/app/api/knowledge/[id]/route.ts`
**Endpoints:**
- `GET /api/knowledge/[id]` - Ver artículo (incrementa views)
- `PUT /api/knowledge/[id]` - Actualizar artículo (solo autor o ADMIN)
- `DELETE /api/knowledge/[id]` - Eliminar artículo (solo autor o ADMIN)

### 3. `/src/app/api/knowledge/[id]/vote/route.ts`
**Endpoints:**
- `POST /api/knowledge/[id]/vote` - Votar útil/no útil

```typescript
// POST body
{
  isHelpful: boolean
}
```

### 4. `/src/app/api/knowledge/similar/route.ts`
**Endpoints:**
- `POST /api/knowledge/similar` - Buscar artículos similares

```typescript
// POST body
{
  title: string,
  description: string,
  categoryId?: string
}

// Respuesta: Array de artículos ordenados por relevancia
```

### 5. `/src/app/api/tickets/[id]/create-article/route.ts`
**Endpoints:**
- `POST /api/tickets/[id]/create-article` - Crear artículo desde ticket resuelto

```typescript
// POST body
{
  title: string,
  content: string,
  summary?: string,
  tags: string[]
}
```

## Lógica de Búsqueda Inteligente

### Algoritmo de Similitud:
1. Buscar por palabras clave en título
2. Buscar por tags coincidentes
3. Buscar en misma categoría
4. Ordenar por relevancia (coincidencias + votos útiles)

### Ejemplo de Query Prisma:
```typescript
const articles = await prisma.knowledge_articles.findMany({
  where: {
    AND: [
      { isPublished: true },
      {
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { content: { contains: searchTerm, mode: 'insensitive' } },
          { tags: { hasSome: searchTags } }
        ]
      },
      categoryId ? { categoryId } : {}
    ]
  },
  include: {
    category: true,
    author: {
      select: { id: true, name: true, avatar: true }
    },
    _count: {
      select: { votes: true }
    }
  },
  orderBy: [
    { helpfulVotes: 'desc' },
    { views: 'desc' },
    { createdAt: 'desc' }
  ]
})
```

## Seguridad y Permisos

### Matriz de Permisos:
| Acción | ADMIN | TECHNICIAN | CLIENT |
|--------|-------|------------|--------|
| Ver artículos | ✅ | ✅ | ✅ |
| Crear artículo | ✅ | ✅ | ❌ |
| Editar propio | ✅ | ✅ | ❌ |
| Editar cualquiera | ✅ | ❌ | ❌ |
| Eliminar propio | ✅ | ✅ | ❌ |
| Eliminar cualquiera | ✅ | ❌ | ❌ |
| Votar | ✅ | ✅ | ✅ |

## Validaciones

### Crear Artículo:
- ✅ Usuario autenticado
- ✅ Rol TECHNICIAN o ADMIN
- ✅ Título: 10-200 caracteres
- ✅ Contenido: mínimo 50 caracteres
- ✅ Categoría existe y está activa
- ✅ Tags: máximo 10, cada uno 2-30 caracteres
- ✅ Si sourceTicketId: ticket existe y está RESOLVED

### Votar:
- ✅ Usuario autenticado
- ✅ Artículo existe
- ✅ Usuario no ha votado antes (o actualizar voto)

## Testing

Crear tests para:
1. Búsqueda de artículos
2. Creación desde ticket
3. Sistema de votación
4. Búsqueda de similares
5. Permisos de edición/eliminación

## Validación
- ✅ Todos los endpoints funcionan
- ✅ Búsqueda retorna resultados relevantes
- ✅ Permisos correctamente implementados
- ✅ Votos se registran correctamente
- ✅ Views se incrementan al ver artículo

## Siguiente Tarea
TAREA 3: Componentes UI para Conocimientos
