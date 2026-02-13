# ✅ Módulo de Conocimientos - Vistas de Detalle Implementadas

**Fecha:** 5 de Febrero, 2026  
**Estado:** ✅ Completado

## 🎯 Funcionalidades Implementadas

### 1. Sistema de Votación
**Componente:** `src/components/knowledge/article-vote.tsx`

#### Características:
- ✅ Botones de "Útil" y "No útil"
- ✅ Contador de votos en tiempo real
- ✅ Barra de progreso visual
- ✅ Porcentaje de utilidad
- ✅ Cambiar voto o remover voto
- ✅ Feedback visual (verde/rojo)
- ✅ Mensajes de confirmación

#### Funcionalidad:
```typescript
// Votar útil
POST /api/knowledge/{id}/vote
{ isHelpful: true }

// Votar no útil
POST /api/knowledge/{id}/vote
{ isHelpful: false }

// Remover voto
DELETE /api/knowledge/{id}/vote
```

### 2. Vista de Detalle - Cliente
**Ruta:** `/knowledge/[id]`  
**Archivo:** `src/app/knowledge/[id]/page.tsx`

#### Características:
- ✅ Título y metadata del artículo
- ✅ Categoría con color
- ✅ Tags del artículo
- ✅ Información del autor (avatar, nombre)
- ✅ Fecha de creación (relativa)
- ✅ Contador de vistas
- ✅ Contenido completo del artículo
- ✅ Sistema de votación integrado
- ✅ Ticket relacionado (si existe)
- ✅ Artículos similares (3 sugerencias)
- ✅ Botón para crear ticket
- ✅ Botón para compartir (copiar enlace)

#### Permisos:
- ✅ Solo usuarios autenticados
- ✅ Solo artículos publicados
- ❌ No puede editar
- ❌ No puede eliminar

### 3. Vista de Detalle - Técnico
**Ruta:** `/technician/knowledge/[id]`  
**Archivo:** `src/app/technician/knowledge/[id]/page.tsx`

#### Características Adicionales:
- ✅ Todas las características de cliente
- ✅ Indicador de borrador (si no está publicado)
- ✅ Botón "Editar" (solo para artículos propios)
- ✅ Puede ver sus propios borradores

#### Permisos:
- ✅ Solo usuarios TECHNICIAN
- ✅ Ver artículos publicados
- ✅ Ver sus propios borradores
- ✅ Editar solo sus artículos
- ❌ No puede eliminar
- ❌ No puede publicar/despublicar

#### Lógica de Edición:
```typescript
const canEdit = article && session?.user?.id === article.authorId
```

### 4. Vista de Detalle - Admin
**Ruta:** `/admin/knowledge/[id]`  
**Archivo:** `src/app/admin/knowledge/[id]/page.tsx`

#### Características Adicionales:
- ✅ Todas las características de técnico
- ✅ Botón "Publicar/Despublicar"
- ✅ Botón "Editar" (cualquier artículo)
- ✅ Botón "Eliminar" con confirmación
- ✅ Banner de borrador con acción rápida
- ✅ Puede ver todos los borradores

#### Permisos:
- ✅ Solo usuarios ADMIN
- ✅ Ver todos los artículos
- ✅ Editar cualquier artículo
- ✅ Eliminar cualquier artículo
- ✅ Publicar/despublicar artículos
- ✅ Control total

#### Acciones Disponibles:
```typescript
// Publicar/Despublicar
PUT /api/knowledge/{id}
{ isPublished: true/false }

// Eliminar
DELETE /api/knowledge/{id}
```

## 📊 Estructura de las Vistas

### Layout Principal
```
┌─────────────────────────────────────────────────────────┐
│ ModuleLayout                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Header: Título + Botones de acción                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌──────────────────────┐  ┌──────────────────────────┐ │
│ │ Contenido Principal  │  │ Sidebar                  │ │
│ │                      │  │                          │ │
│ │ • Banner borrador    │  │ • Ticket relacionado     │ │
│ │ • Metadata           │  │ • Artículos similares    │ │
│ │ • Contenido          │  │ • Ayuda adicional        │ │
│ │ • Sistema votación   │  │                          │ │
│ │                      │  │                          │ │
│ └──────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Botones de Acción por Rol

#### Cliente
```
[Compartir] [Volver]
```

#### Técnico
```
[Editar*] [Compartir] [Volver]
* Solo si es autor
```

#### Admin
```
[Publicar/Despublicar] [Editar] [Eliminar] [Compartir] [Volver]
```

## 🎨 Componentes Visuales

### 1. Banner de Borrador
```tsx
<Card className="border-yellow-500 bg-yellow-50">
  <Badge>Borrador</Badge>
  <span>Este artículo no está publicado</span>
  <Button>Publicar ahora</Button> // Solo admin
</Card>
```

### 2. Metadata Card
- Categoría con color personalizado
- Tags con iconos
- Avatar del autor
- Fecha relativa (hace X tiempo)
- Contador de vistas

### 3. Contenido
```tsx
<div className="prose prose-sm max-w-none dark:prose-invert">
  <div className="whitespace-pre-wrap">{article.content}</div>
</div>
```

### 4. Sistema de Votación
- Botón "Útil" (verde cuando votado)
- Botón "No útil" (rojo cuando votado)
- Contador de votos
- Barra de progreso
- Porcentaje de utilidad

### 5. Sidebar

#### Ticket Relacionado
```tsx
<Link href={`/tickets/${sourceTicket.id}`}>
  <Button variant="outline">
    <BookOpen /> {sourceTicket.title}
  </Button>
</Link>
```

#### Artículos Similares
- Máximo 3 artículos
- Título (2 líneas máximo)
- Vistas y porcentaje de utilidad
- Hover effect

#### Ayuda Adicional
- Mensaje de ayuda
- Botón "Crear Ticket"

## 🔐 Seguridad y Permisos

### Validaciones Implementadas

#### Cliente
```typescript
if (!session) {
  router.push('/login')
  return
}
// Solo artículos publicados (filtrado en API)
```

#### Técnico
```typescript
if (!session || session.user.role !== 'TECHNICIAN') {
  router.push('/login')
  return
}

const canEdit = article && session?.user?.id === article.authorId
```

#### Admin
```typescript
if (!session || session.user.role !== 'ADMIN') {
  router.push('/login')
  return
}
// Control total sobre todos los artículos
```

## 📡 APIs Utilizadas

### 1. Obtener Artículo
```
GET /api/knowledge/{id}
```

**Respuesta:**
```json
{
  "id": "uuid",
  "title": "string",
  "content": "string",
  "summary": "string",
  "category": { "id", "name", "color" },
  "tags": ["string"],
  "author": { "id", "name", "email", "avatar" },
  "views": number,
  "helpfulVotes": number,
  "notHelpfulVotes": number,
  "helpfulPercentage": number,
  "userVote": boolean | null,
  "isPublished": boolean,
  "sourceTicket": { "id", "title" } | null,
  "createdAt": "date",
  "updatedAt": "date"
}
```

### 2. Artículos Similares
```
POST /api/knowledge/similar
{
  "articleId": "uuid",
  "limit": 3
}
```

### 3. Votar Artículo
```
POST /api/knowledge/{id}/vote
{ "isHelpful": boolean }
```

### 4. Remover Voto
```
DELETE /api/knowledge/{id}/vote
```

### 5. Actualizar Artículo (Admin)
```
PUT /api/knowledge/{id}
{ "isPublished": boolean }
```

### 6. Eliminar Artículo (Admin)
```
DELETE /api/knowledge/{id}
```

## ✅ Características Implementadas

### Funcionalidad
- ✅ Vista de detalle completa
- ✅ Sistema de votación funcional
- ✅ Artículos similares
- ✅ Ticket relacionado
- ✅ Compartir enlace
- ✅ Editar (con permisos)
- ✅ Eliminar (con confirmación)
- ✅ Publicar/despublicar (admin)

### UX/UI
- ✅ Diseño responsive (grid 2/3 + 1/3)
- ✅ Loading states
- ✅ Error handling
- ✅ Feedback visual
- ✅ Confirmaciones
- ✅ Toasts informativos
- ✅ Hover effects
- ✅ Transiciones suaves

### Seguridad
- ✅ Validación de sesión
- ✅ Validación de roles
- ✅ Validación de permisos
- ✅ Protección de rutas
- ✅ Confirmación de eliminación

## 🚀 Próximos Pasos

### Pendientes de Implementar

1. **Formularios de Creación/Edición**
   - Editor de markdown
   - Selector de categoría
   - Gestión de tags
   - Vista previa
   - Guardar como borrador

2. **Vista de Tarjetas**
   - Componente `KnowledgeCard`
   - Toggle en DataTable

3. **Exportación**
   - Exportar artículo a PDF
   - Exportar lista a Excel

4. **Comentarios**
   - Sistema de comentarios
   - Respuestas anidadas

5. **Historial**
   - Versiones del artículo
   - Cambios realizados

## 📝 Notas Técnicas

### Formato de Contenido
- Actualmente: `whitespace-pre-wrap` (texto plano con saltos de línea)
- Futuro: Markdown con renderizado HTML

### Artículos Similares
- Algoritmo: Por categoría y tags
- Límite: 3 artículos
- Ordenamiento: Por relevancia

### Contador de Vistas
- Se incrementa automáticamente en la API
- No se cuenta si el usuario ya vio el artículo (cookie/session)

---

**Estado:** ✅ Vistas de detalle completadas para los 3 roles  
**Próximo:** Implementar formularios de creación y edición
