# Mejoras: Gestión de Artículos desde Tickets

**Fecha:** 2026-02-05  
**Estado:** 🔄 EN IMPLEMENTACIÓN

---

## 🐛 Problemas Identificados

### 1. Toast Duplicado
Se muestra 2 veces el mensaje "Ya existe un artículo creado desde este ticket".

**Causa:** React 18 StrictMode ejecuta useEffect dos veces en desarrollo.

### 2. Botón "Crear Artículo" Siempre Visible
El botón aparece incluso cuando ya existe un artículo creado desde ese ticket.

**Problema UX:** Usuario confundido, intenta crear duplicado.

### 3. Falta Gestión de Eliminación
No hay forma de eliminar o despublicar artículos.

**Problema:** Artículos obsoletos o incorrectos quedan publicados.

---

## 🎯 Mejores Prácticas (Sistemas Profesionales)

### ServiceNow Knowledge Management
- ✅ Un ticket = Un artículo (no duplicados)
- ✅ Botón "Create Article" se oculta si existe
- ✅ Botón "View Article" aparece en su lugar
- ✅ Estados: Draft, Published, Retired
- ✅ Solo autor/admin pueden eliminar
- ✅ Confirmación antes de eliminar
- ✅ Auditoría completa

### Zendesk Guide
- ✅ Artículos vinculados a tickets
- ✅ Badge "Article Created" en ticket
- ✅ Link directo al artículo
- ✅ Soft delete (Archive)
- ✅ Permisos granulares

### Confluence
- ✅ Páginas vinculadas a issues
- ✅ Estados: Published, Draft, Archived
- ✅ Historial de versiones
- ✅ Restauración de eliminados

---

## ✅ Soluciones Implementadas

### 1. Corregir Toast Duplicado

**Problema:** `useEffect` se ejecuta dos veces.

**Solución:** Bandera `hasCheckedExisting`

```typescript
const [hasCheckedExisting, setHasCheckedExisting] = useState(false)

useEffect(() => {
  const fromTicket = searchParams.get('fromTicket')
  
  if (fromTicket && !hasCheckedExisting) {
    setSourceTicketId(fromTicket)
    setHasCheckedExisting(true)
    loadTicketSuggestions(fromTicket)
  }
}, [searchParams, hasCheckedExisting])
```

**Resultado:** Toast se muestra UNA sola vez.

### 2. Botón Inteligente en Tickets

**Implementación:** Verificar si existe artículo y mostrar botón apropiado.

#### Opción A: Verificación en Cliente (Recomendada)

```typescript
// En página de ticket
const [existingArticle, setExistingArticle] = useState<string | null>(null)
const [checkingArticle, setCheckingArticle] = useState(false)

useEffect(() => {
  if (ticket?.status === 'RESOLVED') {
    checkExistingArticle()
  }
}, [ticket])

const checkExistingArticle = async () => {
  setCheckingArticle(true)
  try {
    const response = await fetch(`/api/tickets/${ticket.id}/knowledge-article`)
    if (response.ok) {
      const data = await response.json()
      setExistingArticle(data.articleId)
    }
  } catch (error) {
    console.error(error)
  } finally {
    setCheckingArticle(false)
  }
}

// Renderizado condicional
{ticket.status === 'RESOLVED' && (
  checkingArticle ? (
    <Button disabled size="sm">
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Verificando...
    </Button>
  ) : existingArticle ? (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push(`/technician/knowledge/${existingArticle}`)}
    >
      <BookOpen className="h-4 w-4 mr-2" />
      Ver Artículo
    </Button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCreateArticle}
    >
      <Lightbulb className="h-4 w-4 mr-2" />
      Crear Artículo
    </Button>
  )
)}
```

#### Opción B: Incluir en Datos del Ticket

```typescript
// En API GET /api/tickets/[id]
const ticket = await prisma.tickets.findUnique({
  where: { id },
  include: {
    // ... otras relaciones
    knowledge_article: {
      select: {
        id: true,
        title: true,
        isPublished: true
      }
    }
  }
})

// En frontend
{ticket.status === 'RESOLVED' && (
  ticket.knowledge_article ? (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push(`/technician/knowledge/${ticket.knowledge_article.id}`)}
    >
      <BookOpen className="h-4 w-4 mr-2" />
      Ver Artículo
      {!ticket.knowledge_article.isPublished && (
        <Badge variant="secondary" className="ml-2">Borrador</Badge>
      )}
    </Button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCreateArticle}
    >
      <Lightbulb className="h-4 w-4 mr-2" />
      Crear Artículo
    </Button>
  )
)}
```

**Recomendación:** Opción B (más eficiente, menos requests).

### 3. Gestión de Eliminación/Despublicación

#### Estados de Artículo

```typescript
enum ArticleStatus {
  DRAFT = 'DRAFT',           // Borrador (no visible)
  PUBLISHED = 'PUBLISHED',   // Publicado (visible)
  ARCHIVED = 'ARCHIVED'      // Archivado (no visible, pero recuperable)
}
```

#### Permisos

| Acción | Autor | Admin | Otros |
|--------|-------|-------|-------|
| Crear | ✅ | ✅ | ❌ |
| Editar | ✅ | ✅ | ❌ |
| Despublicar | ✅ | ✅ | ❌ |
| Archivar | ✅ | ✅ | ❌ |
| Eliminar | ❌ | ✅ | ❌ |
| Restaurar | ❌ | ✅ | ❌ |

#### Implementación

**Schema Prisma:**
```prisma
model knowledge_articles {
  // ... campos existentes
  isPublished  Boolean  @default(true)
  isArchived   Boolean  @default(false)  // NUEVO
  archivedAt   DateTime?                 // NUEVO
  archivedBy   String?                   // NUEVO
  deletedAt    DateTime?                 // NUEVO (soft delete)
  deletedBy    String?                   // NUEVO
}
```

**API PATCH /api/knowledge/[id]:**
```typescript
// Despublicar
await prisma.knowledge_articles.update({
  where: { id },
  data: {
    isPublished: false,
    updatedAt: new Date()
  }
})

// Archivar
await prisma.knowledge_articles.update({
  where: { id },
  data: {
    isArchived: true,
    archivedAt: new Date(),
    archivedBy: session.user.id,
    isPublished: false
  }
})

// Soft Delete (solo admin)
await prisma.knowledge_articles.update({
  where: { id },
  data: {
    deletedAt: new Date(),
    deletedBy: session.user.id,
    isPublished: false
  }
})
```

**UI - Menú de Acciones:**
```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    {/* Editar */}
    {canEdit && (
      <DropdownMenuItem onClick={handleEdit}>
        <Edit className="h-4 w-4 mr-2" />
        Editar
      </DropdownMenuItem>
    )}
    
    {/* Despublicar/Publicar */}
    {canEdit && (
      <DropdownMenuItem onClick={handleTogglePublish}>
        {article.isPublished ? (
          <>
            <EyeOff className="h-4 w-4 mr-2" />
            Despublicar
          </>
        ) : (
          <>
            <Eye className="h-4 w-4 mr-2" />
            Publicar
          </>
        )}
      </DropdownMenuItem>
    )}
    
    {/* Archivar */}
    {canEdit && !article.isArchived && (
      <DropdownMenuItem onClick={handleArchive}>
        <Archive className="h-4 w-4 mr-2" />
        Archivar
      </DropdownMenuItem>
    )}
    
    {/* Restaurar */}
    {canEdit && article.isArchived && (
      <DropdownMenuItem onClick={handleRestore}>
        <ArchiveRestore className="h-4 w-4 mr-2" />
        Restaurar
      </DropdownMenuItem>
    )}
    
    {/* Eliminar (solo admin) */}
    {isAdmin && (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleDelete}
          className="text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar
        </DropdownMenuItem>
      </>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

**Confirmación de Eliminación:**
```typescript
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Eliminar artículo?</AlertDialogTitle>
      <AlertDialogDescription>
        Esta acción no se puede deshacer. El artículo será eliminado permanentemente.
        
        {article.sourceTicket && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Este artículo está vinculado al ticket: {article.sourceTicket.title}
            </p>
          </div>
        )}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        onClick={confirmDelete}
        className="bg-destructive text-destructive-foreground"
      >
        Eliminar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 📊 Flujos Mejorados

### Flujo 1: Crear Artículo desde Ticket

```
1. Usuario en ticket RESOLVED
   ↓
2. Sistema verifica si existe artículo
   ↓
3a. SI EXISTE:
    - Muestra botón "Ver Artículo"
    - Badge con estado (Publicado/Borrador/Archivado)
    - Clic redirige a artículo existente
    
3b. NO EXISTE:
    - Muestra botón "Crear Artículo"
    - Clic redirige a formulario pre-llenado
    - Crea artículo vinculado
```

### Flujo 2: Despublicar Artículo

```
1. Usuario (autor/admin) en artículo
   ↓
2. Menú acciones → "Despublicar"
   ↓
3. Confirmación: "¿Despublicar artículo?"
   ↓
4. isPublished = false
   ↓
5. Artículo no visible en búsquedas
   ↓
6. Badge "Borrador" en vista de autor
   ↓
7. Auditoría registrada
```

### Flujo 3: Archivar Artículo

```
1. Usuario (autor/admin) en artículo
   ↓
2. Menú acciones → "Archivar"
   ↓
3. Confirmación: "¿Archivar artículo?"
   ↓
4. isArchived = true, isPublished = false
   ↓
5. Artículo movido a "Archivados"
   ↓
6. No visible en búsquedas normales
   ↓
7. Recuperable desde sección "Archivados"
   ↓
8. Auditoría registrada
```

### Flujo 4: Eliminar Artículo (Solo Admin)

```
1. Admin en artículo
   ↓
2. Menú acciones → "Eliminar"
   ↓
3. Dialog de confirmación con advertencias
   ↓
4. Confirmar eliminación
   ↓
5. Soft delete (deletedAt = now)
   ↓
6. Artículo no visible
   ↓
7. Recuperable por admin desde papelera
   ↓
8. Auditoría registrada
   ↓
9. Notificación al autor
```

---

## 🎯 Prioridades de Implementación

### Fase 1: Correcciones Inmediatas (✅ COMPLETADO)
- ✅ Toast duplicado corregido
- ✅ Bandera `hasCheckedExisting`

### Fase 2: Botón Inteligente (✅ COMPLETADO - 2026-02-06)
- ✅ Incluir `knowledge_article` en GET ticket
- ✅ Renderizado condicional del botón
- ✅ Badge de estado en ticket
- ✅ Función handleViewArticle
- ✅ Implementado en página de técnico
- ✅ Implementado en página de admin
- ✅ 12/12 verificaciones pasadas

### Fase 3: Despublicación (SIGUIENTE)
- ⏳ Toggle isPublished
- ⏳ Menú de acciones
- ⏳ Confirmación

### Fase 4: Archivado (FUTURO)
- ⏳ Campo isArchived en schema
- ⏳ Migración de base de datos
- ⏳ Sección "Archivados"
- ⏳ Restauración

### Fase 5: Eliminación (FUTURO)
- ⏳ Soft delete
- ⏳ Solo admin
- ⏳ Papelera
- ⏳ Restauración

---

## ✨ Beneficios

### UX Mejorada
- ✅ No más toast duplicados
- ✅ Botón correcto según contexto
- ✅ Usuario sabe si ya existe artículo
- ✅ Acceso directo al artículo existente

### Gestión Profesional
- ✅ Control sobre artículos publicados
- ✅ Despublicación sin eliminar
- ✅ Archivado para obsoletos
- ✅ Eliminación controlada (solo admin)

### Auditoría Completa
- ✅ Registro de despublicaciones
- ✅ Registro de archivados
- ✅ Registro de eliminaciones
- ✅ Trazabilidad completa

---

## 📝 Archivos a Modificar

### Fase 1 (Completado):
- ✅ `src/app/technician/knowledge/new/page.tsx`
- ✅ `src/app/admin/knowledge/new/page.tsx`

### Fase 2 (✅ COMPLETADO - 2026-02-06):
- ✅ `src/app/api/tickets/[id]/route.ts`
- ✅ `src/app/technician/tickets/[id]/page.tsx`
- ✅ `src/app/admin/tickets/[id]/page.tsx`
- ✅ `IMPLEMENTACION_BOTON_INTELIGENTE_ARTICULOS.md` (documentación)
- ✅ `verificar-boton-inteligente.sh` (script de verificación)

### Fase 3 (Siguiente):
- ⏳ `src/app/api/knowledge/[id]/route.ts`
- ⏳ `src/app/technician/knowledge/[id]/page.tsx`
- ⏳ `src/app/admin/knowledge/[id]/page.tsx`
- ⏳ `src/components/knowledge/article-actions-menu.tsx` (nuevo)

---

**Desarrollado por:** Kiro AI  
**Fecha:** 2026-02-05  
**Estado:** 🔄 Fase 1 completada, Fase 2 en progreso
