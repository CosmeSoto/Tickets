# Auditoría y Corrección Final: Módulo de Conocimientos

**Fecha:** 2026-02-06  
**Estado:** 🔍 AUDITORÍA COMPLETADA - CORRECCIONES NECESARIAS  

---

## 🔍 Hallazgos de la Auditoría

### ❌ Problemas Encontrados

#### 1. **Edición de Artículos (NO DEBE EXISTIR)**
- ✅ Páginas de detalle tienen botón "Editar"
- ✅ Existe carpeta `/[id]/edit/` que NO debería existir
- ❌ **PROBLEMA:** Los artículos vienen de tickets resueltos y NO deben editarse

#### 2. **Funcionalidad de Edición Incorrecta**
- Los artículos son **documentación histórica** de soluciones
- Editar el contenido rompería la trazabilidad con el ticket origen
- Solo se debe permitir:
  - ✅ Editar **tags** (para mejorar búsqueda)
  - ✅ Cambiar **estado** (publicar/despublicar)
  - ✅ **Eliminar** (solo admin)

#### 3. **Carpetas y Archivos Innecesarios**
- `/technician/knowledge/[id]/edit/` - ELIMINAR
- `/admin/knowledge/[id]/edit/` - ELIMINAR
- `/technician/knowledge/new/` - MANTENER (pero solo accesible desde tickets)
- `/admin/knowledge/new/` - MANTENER (pero solo accesible desde tickets)

---

## ✅ Reglas de Negocio Correctas

### Artículos de Conocimiento

#### Creación
- ✅ **SOLO desde tickets resueltos**
- ✅ Contenido generado automáticamente del ticket
- ✅ Incluye: problema, solución, plan de resolución, departamento, categoría
- ✅ No se puede crear "desde cero"

#### Visualización
- ✅ **Vista previa de solo lectura**
- ✅ Muestra todo el contenido del ticket resuelto
- ✅ Incluye link al ticket origen
- ✅ Sistema de votación (útil/no útil)
- ✅ Artículos relacionados

#### Edición Limitada
- ✅ **Tags:** Se pueden editar para mejorar búsqueda
- ✅ **Estado:** Publicar/Despublicar (autor o admin)
- ❌ **Contenido:** NO se puede editar (viene del ticket)
- ❌ **Título:** NO se puede editar (viene del ticket)
- ❌ **Categoría:** NO se puede editar (viene del ticket)

#### Eliminación
- ✅ **Admin:** Puede eliminar cualquier artículo
- ✅ **Técnico autor:** Puede eliminar sus propios artículos
- ✅ Confirmación requerida
- ✅ Auditoría registrada

---

## 🎯 Plan de Corrección

### Fase 1: Eliminar Funcionalidad de Edición Completa

#### 1.1 Eliminar Carpetas de Edición
```bash
rm -rf src/app/technician/knowledge/[id]/edit
rm -rf src/app/admin/knowledge/[id]/edit
```

#### 1.2 Remover Botones de Edición
- `src/app/technician/knowledge/[id]/page.tsx`
  - Eliminar botón "Editar"
  - Eliminar función `handleEdit()`
  - Eliminar variable `canEdit`

- `src/app/admin/knowledge/[id]/page.tsx`
  - Eliminar botón "Editar"
  - Eliminar función `handleEdit()`

#### 1.3 Actualizar Listados
- `src/app/technician/knowledge/page.tsx`
  - Remover `onEdit` de columnas
  - Remover `handleEditArticle()`

- `src/app/admin/knowledge/page.tsx`
  - Remover `onEdit` de columnas
  - Remover `handleEditArticle()`

---

### Fase 2: Implementar Edición Limitada (Tags y Estado)

#### 2.1 Crear Componente de Edición de Tags
```typescript
// src/components/knowledge/edit-tags-dialog.tsx
export function EditTagsDialog({ 
  articleId, 
  currentTags, 
  onSave 
}: {
  articleId: string
  currentTags: string[]
  onSave: (tags: string[]) => void
}) {
  // Dialog para editar solo tags
  // Input con chips para agregar/remover tags
  // Botón guardar
}
```

#### 2.2 Actualizar Página de Detalle (Técnico)
```typescript
// src/app/technician/knowledge/[id]/page.tsx

// Agregar estado para edición de tags
const [editingTags, setEditingTags] = useState(false)

// Función para guardar tags
const handleSaveTags = async (newTags: string[]) => {
  const response = await fetch(`/api/knowledge/${articleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags: newTags })
  })
  // ...
}

// Botones en headerActions (solo si es autor)
{canEditTags && (
  <Button onClick={() => setEditingTags(true)}>
    <Tag /> Editar Tags
  </Button>
)}
```

#### 2.3 Actualizar Página de Detalle (Admin)
```typescript
// src/app/admin/knowledge/[id]/page.tsx

// Mantener:
// - Botón Publicar/Despublicar (ya existe)
// - Botón Eliminar (ya existe)
// - Botón Compartir (ya existe)

// Agregar:
// - Botón Editar Tags
// - Dialog de edición de tags
```

---

### Fase 3: Actualizar API

#### 3.1 API PATCH `/api/knowledge/[id]`
```typescript
// Permitir SOLO:
// - tags: string[]
// - isPublished: boolean

// NO permitir:
// - title
// - content
// - summary
// - categoryId
// - authorId
// - sourceTicketId

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  const body = await request.json()
  
  // Validar permisos
  const article = await prisma.knowledge_articles.findUnique({
    where: { id: params.id }
  })
  
  const isAuthor = session.user.id === article.authorId
  const isAdmin = session.user.role === 'ADMIN'
  
  if (!isAuthor && !isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  
  // Filtrar solo campos permitidos
  const allowedFields: any = {}
  
  if (body.tags !== undefined) {
    allowedFields.tags = body.tags
  }
  
  if (body.isPublished !== undefined && (isAuthor || isAdmin)) {
    allowedFields.isPublished = body.isPublished
  }
  
  // Actualizar
  const updated = await prisma.knowledge_articles.update({
    where: { id: params.id },
    data: {
      ...allowedFields,
      updatedAt: new Date()
    }
  })
  
  // Auditoría
  await auditArticleChange(params.id, session.user.id, 'updated', {
    changes: allowedFields
  })
  
  return NextResponse.json({ success: true, data: updated })
}
```

---

### Fase 4: Actualizar Componentes

#### 4.1 Actualizar `knowledge-columns.tsx`
```typescript
// Remover columna de "Editar"
// Mantener solo:
// - Ver
// - Eliminar (solo admin)

export function createKnowledgeColumns({ onView, onDelete }) {
  // NO incluir onEdit
}
```

#### 4.2 Actualizar `knowledge-card.tsx`
```typescript
// Remover botón de "Editar"
// Mantener solo:
// - Ver
// - Eliminar (solo admin)

export function KnowledgeCard({ 
  article, 
  onView, 
  onDelete,
  canDelete 
}) {
  // NO incluir onEdit ni canEdit
}
```

---

## 📋 Estructura Final Correcta

### Páginas que DEBEN existir
```
✅ /technician/knowledge/page.tsx          (listado)
✅ /technician/knowledge/[id]/page.tsx     (detalle - solo lectura)
✅ /technician/knowledge/new/page.tsx      (crear desde ticket)

✅ /admin/knowledge/page.tsx               (listado)
✅ /admin/knowledge/[id]/page.tsx          (detalle - solo lectura)
✅ /admin/knowledge/new/page.tsx           (crear desde ticket)
```

### Páginas que NO deben existir
```
❌ /technician/knowledge/[id]/edit/page.tsx  (ELIMINAR)
❌ /admin/knowledge/[id]/edit/page.tsx       (ELIMINAR)
```

---

## 🎨 UI/UX Correcta

### Página de Detalle (Vista Previa)

#### Header Actions
```
┌─────────────────────────────────────────────────────┐
│ [Editar Tags] [Publicar/Despublicar] [Eliminar]    │
│ [Compartir] [Volver]                                │
└─────────────────────────────────────────────────────┘
```

#### Contenido
```
┌─────────────────────────────────────────────────────┐
│ [Badge: Borrador] (si no está publicado)            │
├─────────────────────────────────────────────────────┤
│ Metadata:                                           │
│ - Categoría (solo lectura, viene del ticket)       │
│ - Tags (editables con botón)                       │
│ - Autor, Fecha, Vistas                             │
├─────────────────────────────────────────────────────┤
│ Contenido del Artículo:                            │
│ (Solo lectura, generado del ticket)                │
│                                                     │
│ - Información del ticket                           │
│ - Problema reportado                               │
│ - Plan de resolución                               │
│ - Solución aplicada                                │
│ - Calificación del cliente                         │
├─────────────────────────────────────────────────────┤
│ Sistema de Votación:                               │
│ ¿Te resultó útil? [👍 Sí] [👎 No]                 │
└─────────────────────────────────────────────────────┘

Sidebar:
┌─────────────────────────────────┐
│ Ticket Relacionado:             │
│ [Ver Ticket #12345]             │
├─────────────────────────────────┤
│ Artículos Relacionados:         │
│ - Artículo 1                    │
│ - Artículo 2                    │
│ - Artículo 3                    │
└─────────────────────────────────┘
```

---

## 🔒 Permisos Finales

### Técnico (Autor)
- ✅ Ver sus artículos (publicados y borradores)
- ✅ Ver artículos publicados de otros
- ✅ Editar tags de sus artículos
- ✅ Publicar/Despublicar sus artículos
- ✅ Eliminar sus artículos
- ❌ Editar contenido
- ❌ Editar artículos de otros

### Admin
- ✅ Ver todos los artículos
- ✅ Editar tags de cualquier artículo
- ✅ Publicar/Despublicar cualquier artículo
- ✅ Eliminar cualquier artículo
- ❌ Editar contenido

### Cliente
- ✅ Ver artículos publicados
- ✅ Votar (útil/no útil)
- ❌ Ver borradores
- ❌ Editar
- ❌ Eliminar

---

## 📊 Datos Reales

### Métricas (Ya Implementadas Correctamente)
```typescript
const stats = useMemo(() => {
  return {
    total: allArticles.length,                    // ✅ Datos reales
    published: allArticles.filter(...).length,    // ✅ Datos reales
    totalViews: allArticles.reduce(...),          // ✅ Datos reales
    avgHelpful: allArticles.reduce(...),          // ✅ Datos reales
  }
}, [allArticles])
```

### DataTable (Ya Implementado Correctamente)
- ✅ Carga datos reales de `/api/knowledge`
- ✅ Filtros en memoria (eficiente)
- ✅ Paginación en memoria
- ✅ Búsqueda en tiempo real
- ✅ Ordenamiento funcional

### Filtros (Ya Implementados Correctamente)
- ✅ Búsqueda por título, contenido, tags
- ✅ Filtro por categoría
- ✅ Ordenamiento (reciente, vistas, útil)
- ✅ Debounce para performance

---

## ✅ Lo que YA está Bien

### 1. Listados
- ✅ Cargan datos reales
- ✅ Métricas calculadas correctamente
- ✅ Filtros funcionales
- ✅ DataTable con paginación
- ✅ Vista de tarjetas y tabla
- ✅ Simetría visual con otros módulos

### 2. Creación
- ✅ Solo desde tickets resueltos
- ✅ Contenido generado automáticamente
- ✅ Prevención de duplicados
- ✅ Auditoría completa

### 3. Visualización
- ✅ Vista previa clara
- ✅ Muestra ticket relacionado
- ✅ Artículos similares
- ✅ Sistema de votación

### 4. Estado
- ✅ Publicar/Despublicar funciona
- ✅ Badge de borrador visible
- ✅ Filtro de publicados en técnico

---

## 🚀 Orden de Implementación

### 1. Eliminar Edición Completa (URGENTE)
```bash
# Eliminar carpetas
rm -rf src/app/technician/knowledge/[id]/edit
rm -rf src/app/admin/knowledge/[id]/edit

# Actualizar páginas de detalle
# - Remover botón "Editar"
# - Remover función handleEdit()
```

### 2. Actualizar Listados
```bash
# Remover onEdit de:
# - src/app/technician/knowledge/page.tsx
# - src/app/admin/knowledge/page.tsx
# - src/components/knowledge/knowledge-columns.tsx
# - src/components/knowledge/knowledge-card.tsx
```

### 3. Implementar Edición de Tags
```bash
# Crear componente
# - src/components/knowledge/edit-tags-dialog.tsx

# Agregar a páginas de detalle
# - Botón "Editar Tags"
# - Dialog de edición
```

### 4. Actualizar API
```bash
# Modificar PATCH /api/knowledge/[id]
# - Permitir solo tags e isPublished
# - Validar permisos
# - Auditoría
```

### 5. Testing
```bash
# Verificar:
# - No se puede editar contenido
# - Se pueden editar tags
# - Se puede publicar/despublicar
# - Se puede eliminar (con permisos)
# - Datos reales en métricas
# - Filtros funcionan
```

---

## 📝 Archivos a Modificar

### Eliminar
- ❌ `src/app/technician/knowledge/[id]/edit/page.tsx`
- ❌ `src/app/admin/knowledge/[id]/edit/page.tsx`

### Modificar
- 📝 `src/app/technician/knowledge/[id]/page.tsx`
- 📝 `src/app/admin/knowledge/[id]/page.tsx`
- 📝 `src/app/technician/knowledge/page.tsx`
- 📝 `src/app/admin/knowledge/page.tsx`
- 📝 `src/components/knowledge/knowledge-columns.tsx`
- 📝 `src/components/knowledge/knowledge-card.tsx`
- 📝 `src/app/api/knowledge/[id]/route.ts`

### Crear
- ✨ `src/components/knowledge/edit-tags-dialog.tsx`

---

**Preparado por:** Kiro AI  
**Fecha:** 2026-02-06  
**Prioridad:** 🔴 ALTA - Corrección de funcionalidad incorrecta

