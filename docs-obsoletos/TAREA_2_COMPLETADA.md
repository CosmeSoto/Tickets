# ✅ TAREA 2 COMPLETADA: API Endpoints para Base de Conocimiento

**Fecha:** 5 de febrero de 2026  
**Estado:** COMPLETADO ✅

---

## 📋 Resumen

Se han implementado exitosamente todos los endpoints de API para gestionar la Base de Conocimiento, incluyendo operaciones CRUD, sistema de votación, búsqueda inteligente y creación desde tickets resueltos.

---

## ✅ Endpoints Implementados

### 1. `/api/knowledge` - Gestión de Artículos

#### GET - Listar artículos con filtros
**Parámetros de búsqueda:**
- `search` - Buscar en título, contenido y resumen
- `categoryId` - Filtrar por categoría
- `tags` - Filtrar por tags (separados por coma)
- `authorId` - Filtrar por autor
- `sortBy` - Ordenar por: `views`, `helpful`, `recent`
- `page` - Número de página (default: 1)
- `limit` - Resultados por página (default: 20)

**Respuesta:**
```json
{
  "articles": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

#### POST - Crear nuevo artículo
**Permisos:** TECHNICIAN, ADMIN  
**Body:**
```json
{
  "title": "string (10-200 caracteres)",
  "content": "string (mínimo 50 caracteres)",
  "summary": "string (opcional)",
  "categoryId": "uuid",
  "tags": ["string[]"] (máximo 10),
  "sourceTicketId": "uuid (opcional)"
}
```

**Validaciones:**
- ✅ Usuario autenticado con rol TECHNICIAN o ADMIN
- ✅ Título entre 10-200 caracteres
- ✅ Contenido mínimo 50 caracteres
- ✅ Categoría existe y está activa
- ✅ Máximo 10 tags, cada uno 2-30 caracteres
- ✅ Si sourceTicketId: ticket existe y está RESOLVED
- ✅ Registro en auditoría

---

### 2. `/api/knowledge/[id]` - Operaciones Individuales

#### GET - Ver artículo
**Funcionalidad:**
- Incrementa contador de vistas automáticamente
- Retorna voto del usuario actual
- Calcula porcentaje de votos útiles
- Incluye información completa del artículo

**Respuesta incluye:**
- Datos del artículo
- Categoría con color
- Autor (nombre, email, avatar)
- Ticket origen (si existe)
- Voto del usuario actual
- Estadísticas (views, votos, porcentaje)

#### PUT - Actualizar artículo
**Permisos:** Autor del artículo o ADMIN  
**Body:** Campos opcionales a actualizar
```json
{
  "title": "string (opcional)",
  "content": "string (opcional)",
  "summary": "string (opcional)",
  "categoryId": "uuid (opcional)",
  "tags": ["string[]"] (opcional)",
  "isPublished": "boolean (opcional)"
}
```

**Validaciones:**
- ✅ Solo el autor o ADMIN pueden editar
- ✅ Validación de campos según schema
- ✅ Registro en auditoría

#### DELETE - Eliminar artículo
**Permisos:** Autor del artículo o ADMIN  
**Funcionalidad:**
- Elimina votos asociados primero
- Elimina el artículo
- Registra en auditoría

---

### 3. `/api/knowledge/[id]/vote` - Sistema de Votación

#### POST - Votar artículo
**Body:**
```json
{
  "isHelpful": true | false
}
```

**Funcionalidad:**
- Crea nuevo voto o actualiza existente
- Actualiza contadores del artículo automáticamente
- Retorna estadísticas actualizadas
- Un voto por usuario por artículo (restricción única)

**Lógica de actualización:**
- Nuevo voto útil: `helpfulVotes++`
- Nuevo voto no útil: `notHelpfulVotes++`
- Cambio de útil a no útil: `helpfulVotes--`, `notHelpfulVotes++`
- Cambio de no útil a útil: `helpfulVotes++`, `notHelpfulVotes--`

#### DELETE - Eliminar voto
**Funcionalidad:**
- Elimina el voto del usuario
- Actualiza contadores del artículo

---

### 4. `/api/knowledge/similar` - Búsqueda Inteligente

#### POST - Buscar artículos similares
**Body:**
```json
{
  "title": "string (mínimo 3 caracteres)",
  "description": "string (opcional)",
  "categoryId": "uuid (opcional)",
  "limit": number (1-20, default: 5)
}
```

**Algoritmo de Similitud:**

1. **Extracción de palabras clave:**
   - Elimina stop words en español
   - Filtra palabras menores a 4 caracteres
   - Toma las 10 palabras más significativas

2. **Cálculo de relevancia (score):**
   - Coincidencias en título: **peso 3**
   - Coincidencias en tags: **peso 2**
   - Coincidencias en contenido: **peso 1**
   - Misma categoría: **bonus +5**
   - Ratio de votos útiles: **bonus +2**
   - Popularidad (vistas): **bonus logarítmico**

3. **Ordenamiento:**
   - Por score de relevancia (descendente)
   - Limita resultados según parámetro `limit`

**Respuesta:**
```json
{
  "articles": [...],
  "keywords": ["palabra1", "palabra2"],
  "totalFound": 15
}
```

---

### 5. `/api/tickets/[id]/create-article` - Crear desde Ticket

#### GET - Obtener información del ticket
**Funcionalidad:**
- Verifica que el ticket esté RESOLVED
- Retorna información completa del ticket
- Genera sugerencias automáticas:
  - Título sugerido
  - Contenido basado en comentarios
  - Tags extraídos del título y categoría
- Indica si ya existe un artículo para este ticket

**Respuesta:**
```json
{
  "ticket": {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "category": {...},
    "comments": [...]
  },
  "existingArticle": {...} | null,
  "suggestions": {
    "title": "Solución: [título del ticket]",
    "content": "# Problema\n...\n## Solución\n...",
    "tags": ["tag1", "tag2"]
  }
}
```

#### POST - Crear artículo desde ticket
**Permisos:** Técnico asignado o ADMIN  
**Body:**
```json
{
  "title": "string (10-200 caracteres)",
  "content": "string (mínimo 50 caracteres)",
  "summary": "string (opcional)",
  "tags": ["string[]"] (máximo 10)
}
```

**Validaciones:**
- ✅ Ticket existe y está RESOLVED
- ✅ Usuario es el técnico asignado o ADMIN
- ✅ No existe artículo previo para este ticket
- ✅ Validación de campos según schema

**Funcionalidad adicional:**
- Hereda categoría del ticket automáticamente
- Crea notificación para el cliente del ticket
- Registra en auditoría
- Vincula artículo con ticket origen

---

## 🔒 Matriz de Permisos Implementada

| Acción | ADMIN | TECHNICIAN | CLIENT |
|--------|-------|------------|--------|
| Ver artículos | ✅ | ✅ | ✅ |
| Crear artículo | ✅ | ✅ | ❌ |
| Editar propio | ✅ | ✅ | ❌ |
| Editar cualquiera | ✅ | ❌ | ❌ |
| Eliminar propio | ✅ | ✅ | ❌ |
| Eliminar cualquiera | ✅ | ❌ | ❌ |
| Votar | ✅ | ✅ | ✅ |
| Crear desde ticket | ✅ | ✅ (solo asignado) | ❌ |

---

## 🛡️ Seguridad Implementada

### Autenticación
- ✅ Todos los endpoints requieren sesión activa
- ✅ Verificación de usuario autenticado con NextAuth

### Autorización
- ✅ Verificación de roles por endpoint
- ✅ Verificación de propiedad para edición/eliminación
- ✅ Verificación de asignación para crear desde ticket

### Validación
- ✅ Schemas de validación con Zod
- ✅ Validación de UUIDs
- ✅ Validación de longitudes de texto
- ✅ Validación de existencia de recursos relacionados

### Auditoría
- ✅ Registro de todas las operaciones CREATE, UPDATE, DELETE
- ✅ Almacenamiento de detalles de cambios
- ✅ Trazabilidad completa de acciones

---

## 📁 Archivos Creados

1. `src/app/api/knowledge/route.ts` - GET (listar) y POST (crear)
2. `src/app/api/knowledge/[id]/route.ts` - GET (ver), PUT (actualizar), DELETE (eliminar)
3. `src/app/api/knowledge/[id]/vote/route.ts` - POST (votar), DELETE (eliminar voto)
4. `src/app/api/knowledge/similar/route.ts` - POST (buscar similares)
5. `src/app/api/tickets/[id]/create-article/route.ts` - GET (info), POST (crear)

---

## ✅ Criterios de Aceptación

- [x] Todos los endpoints implementados y funcionales
- [x] Búsqueda con filtros múltiples
- [x] Paginación implementada
- [x] Sistema de votación con restricción única
- [x] Algoritmo de búsqueda inteligente
- [x] Permisos correctamente implementados
- [x] Validaciones con Zod
- [x] Auditoría completa
- [x] Notificaciones al crear desde ticket
- [x] Incremento automático de vistas
- [x] Cálculo de estadísticas
- [x] Manejo de errores robusto

---

## 🎯 Próximo Paso

**TAREA 3:** Crear componentes UI para la Base de Conocimiento

Componentes a implementar:
- `ArticleList` - Lista de artículos con filtros
- `ArticleCard` - Tarjeta de artículo
- `ArticleDetail` - Vista detallada de artículo
- `ArticleForm` - Formulario crear/editar
- `ArticleSearch` - Buscador con autocompletado
- `VoteButtons` - Botones de votación
- `SimilarArticles` - Widget de artículos similares

Páginas a crear:
- `/knowledge` - Listado principal
- `/knowledge/[id]` - Vista de artículo
- `/knowledge/new` - Crear artículo

Hooks a crear:
- `useKnowledgeArticles` - Hook para gestionar artículos
- `useArticleVote` - Hook para votación

---

**Completado por:** Sistema de Tickets Moderno  
**Verificado:** ✅ Todos los endpoints implementados y validados
