# ✅ Corrección: Permisos de Técnico en Knowledge

**Fecha:** 2026-02-06  
**Estado:** ✅ COMPLETADO  
**Errores TypeScript:** 0  

---

## 🎯 Problema Identificado

El técnico autor NO podía gestionar sus propios artículos:
- ❌ No aparecían botones de Publicar/Despublicar
- ❌ No aparecía botón de Eliminar
- ❌ Solo podía ver los artículos

---

## ✅ Solución Implementada

### 1. Página de Detalle de Técnico

**Archivo:** `src/app/technician/knowledge/[id]/page.tsx`

**Cambios:**
- ✅ Agregados imports: `Trash2`, `CheckCircle`, `XCircle`, `AlertDialog`
- ✅ Agregados estados: `showDeleteDialog`, `deleting`, `toggling`
- ✅ Agregada función `handleTogglePublish()` - Publicar/Despublicar
- ✅ Agregada función `handleDelete()` - Eliminar con confirmación
- ✅ Agregada variable `isAuthor` - Verifica si es el autor
- ✅ Agregados botones condicionales en header (solo si es autor)
- ✅ Agregado `AlertDialog` para confirmación de eliminación

**Botones en Header (Si es autor):**
```
[Publicar/Despublicar] [Eliminar] [Compartir] [Volver]
```

**Botones en Header (Si NO es autor):**
```
[Compartir] [Volver]
```

---

### 2. Listado de Técnico

**Archivo:** `src/app/technician/knowledge/page.tsx`

**Cambios:**
- ✅ Agregado import `useToast`
- ✅ Agregada función `handleDeleteArticle()` - Eliminar desde listado
- ✅ Pasado `onDelete` a columnas
- ✅ Pasado `currentUserId` a columnas para validar permisos
- ✅ En tarjetas: `canDelete={article.authorId === session?.user?.id}`

**Resultado:**
- ✅ Botón de eliminar solo aparece en artículos propios
- ✅ Confirmación antes de eliminar
- ✅ Toast de éxito/error

---

### 3. Componente de Columnas

**Archivo:** `src/components/knowledge/knowledge-columns.tsx`

**Cambios:**
- ✅ Agregado parámetro `currentUserId` a interface
- ✅ Lógica condicional para mostrar botón eliminar:
  ```typescript
  const canDelete = onDelete && (currentUserId === article.authorId || !currentUserId)
  ```
- ✅ Si `currentUserId` es `undefined` (admin), muestra botón para todos
- ✅ Si `currentUserId` está definido (técnico), solo muestra para artículos propios

---

## 🔒 Permisos Finales Correctos

### Técnico (Autor de Artículo)
**En Detalle:**
- ✅ Ver artículo completo
- ✅ Publicar/Despublicar su artículo
- ✅ Eliminar su artículo (con confirmación)
- ✅ Compartir enlace
- ❌ NO editar contenido (viene del ticket)

**En Listado:**
- ✅ Ver todos los artículos publicados
- ✅ Ver sus propios borradores
- ✅ Botón eliminar solo en sus artículos
- ❌ NO eliminar artículos de otros

### Técnico (NO Autor)
**En Detalle:**
- ✅ Ver artículos publicados
- ✅ Compartir enlace
- ❌ NO ver borradores de otros
- ❌ NO publicar/despublicar
- ❌ NO eliminar

**En Listado:**
- ✅ Ver artículos publicados
- ❌ NO ver borradores de otros
- ❌ NO eliminar artículos de otros

### Admin
**En Detalle:**
- ✅ Ver todos los artículos (publicados y borradores)
- ✅ Publicar/Despublicar cualquier artículo
- ✅ Eliminar cualquier artículo
- ✅ Compartir enlace
- ❌ NO editar contenido (viene del ticket)

**En Listado:**
- ✅ Ver todos los artículos
- ✅ Eliminar cualquier artículo
- ✅ Botón eliminar en todos los artículos

---

## 🎨 UI/UX Implementada

### Página de Detalle (Técnico Autor)

**Header:**
```
┌─────────────────────────────────────────────────────────┐
│ [Publicar/Despublicar] [Eliminar] [Compartir] [Volver] │
└─────────────────────────────────────────────────────────┘
```

**Botón Publicar/Despublicar:**
- Estado Borrador: Botón verde "Publicar" con ícono CheckCircle
- Estado Publicado: Botón outline "Despublicar" con ícono XCircle
- Disabled mientras procesa (toggling)

**Botón Eliminar:**
- Botón rojo "Eliminar" con ícono Trash2
- Al hacer clic: Abre diálogo de confirmación
- Diálogo muestra advertencia si está vinculado a ticket

**Diálogo de Confirmación:**
```
┌─────────────────────────────────────────────────┐
│ ¿Eliminar artículo?                             │
├─────────────────────────────────────────────────┤
│ Esta acción no se puede deshacer. El artículo  │
│ será eliminado permanentemente.                 │
│                                                 │
│ ⚠️ Este artículo está vinculado al ticket:     │
│ [Título del ticket]                             │
├─────────────────────────────────────────────────┤
│                    [Cancelar] [Eliminar]        │
└─────────────────────────────────────────────────┘
```

---

### Listado (Técnico)

**DataTable - Columna Acciones:**
```
Artículo Propio:    [👁️ Ver] [🗑️ Eliminar]
Artículo de Otro:   [👁️ Ver]
```

**Tarjetas:**
```
Artículo Propio:
┌─────────────────────────────┐
│ Título del artículo         │
│ ...                         │
├─────────────────────────────┤
│ [Ver]  [🗑️]                 │
└─────────────────────────────┘

Artículo de Otro:
┌─────────────────────────────┐
│ Título del artículo         │
│ ...                         │
├─────────────────────────────┤
│ (sin botones de acción)     │
└─────────────────────────────┘
```

---

## 🔧 Funciones Implementadas

### handleTogglePublish()
```typescript
const handleTogglePublish = async () => {
  if (!article) return

  setToggling(true)
  try {
    const response = await fetch(`/api/knowledge/${articleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !article.isPublished }),
    })

    if (response.ok) {
      const updated = await response.json()
      setArticle(updated)
      toast({
        title: 'Éxito',
        description: `Artículo ${updated.isPublished ? 'publicado' : 'despublicado'} correctamente`,
      })
    }
  } catch (err) {
    toast({
      title: 'Error',
      description: 'No se pudo cambiar el estado del artículo',
      variant: 'destructive',
    })
  } finally {
    setToggling(false)
  }
}
```

### handleDelete()
```typescript
const handleDelete = async () => {
  setDeleting(true)
  try {
    const response = await fetch(`/api/knowledge/${articleId}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      toast({
        title: 'Éxito',
        description: 'Artículo eliminado correctamente',
      })
      router.push('/technician/knowledge')
    }
  } catch (err) {
    toast({
      title: 'Error',
      description: 'No se pudo eliminar el artículo',
      variant: 'destructive',
    })
  } finally {
    setDeleting(false)
    setShowDeleteDialog(false)
  }
}
```

### handleDeleteArticle() (Listado)
```typescript
const handleDeleteArticle = async (article: Article) => {
  if (!confirm('¿Estás seguro de que deseas eliminar este artículo?')) {
    return
  }

  try {
    const response = await fetch(`/api/knowledge/${article.id}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      toast({
        title: 'Éxito',
        description: 'Artículo eliminado correctamente',
      })
      reload()
    }
  } catch (err) {
    toast({
      title: 'Error',
      description: 'No se pudo eliminar el artículo',
      variant: 'destructive',
    })
  }
}
```

---

## 📝 Archivos Modificados

### Modificados
1. ✅ `src/app/technician/knowledge/[id]/page.tsx`
   - Agregados botones de gestión
   - Agregado diálogo de confirmación
   - Agregadas funciones de publicar/eliminar

2. ✅ `src/app/technician/knowledge/page.tsx`
   - Agregada función de eliminar
   - Agregado toast
   - Pasado currentUserId a columnas

3. ✅ `src/components/knowledge/knowledge-columns.tsx`
   - Agregado parámetro currentUserId
   - Lógica condicional para botón eliminar

4. ✅ `src/app/admin/knowledge/page.tsx`
   - Pasado currentUserId=undefined (puede eliminar todos)

---

## 🧪 Casos de Prueba

### Test 1: Técnico Autor - Publicar Artículo
```
1. Login como técnico
2. Crear artículo desde ticket resuelto
3. Ir a detalle del artículo
4. Verificar botón "Publicar" visible
5. Hacer clic en "Publicar"
6. Verificar toast de éxito
7. Verificar badge cambia a "Publicado"
8. Verificar botón cambia a "Despublicar"
```

### Test 2: Técnico Autor - Eliminar Artículo
```
1. Login como técnico
2. Ir a detalle de artículo propio
3. Verificar botón "Eliminar" visible
4. Hacer clic en "Eliminar"
5. Verificar diálogo de confirmación
6. Confirmar eliminación
7. Verificar toast de éxito
8. Verificar redirección a listado
9. Verificar artículo no aparece en listado
```

### Test 3: Técnico NO Autor - Sin Permisos
```
1. Login como técnico A
2. Ir a detalle de artículo de técnico B
3. Verificar NO aparece botón "Publicar/Despublicar"
4. Verificar NO aparece botón "Eliminar"
5. Solo aparecen botones "Compartir" y "Volver"
```

### Test 4: Técnico - Eliminar desde Listado
```
1. Login como técnico
2. Ir a listado de knowledge
3. Verificar botón eliminar solo en artículos propios
4. Hacer clic en eliminar de artículo propio
5. Confirmar en alert nativo
6. Verificar toast de éxito
7. Verificar artículo desaparece del listado
```

### Test 5: Admin - Puede Eliminar Todos
```
1. Login como admin
2. Ir a listado de knowledge
3. Verificar botón eliminar en TODOS los artículos
4. Eliminar artículo de cualquier técnico
5. Verificar eliminación exitosa
```

---

## 📊 Comparación Antes/Después

### Antes (Incorrecto)
```
❌ Técnico autor no podía gestionar sus artículos
❌ No aparecían botones de publicar/eliminar
❌ Solo podía ver (como cualquier otro técnico)
❌ No había forma de despublicar un artículo
❌ No había forma de eliminar un artículo propio
```

### Después (Correcto)
```
✅ Técnico autor puede gestionar sus artículos
✅ Botones de publicar/despublicar visibles (si es autor)
✅ Botón de eliminar visible (si es autor)
✅ Confirmación antes de eliminar
✅ Toast de feedback en todas las acciones
✅ Permisos correctos según rol y autoría
✅ Admin puede gestionar todos los artículos
```

---

## 🎉 Conclusión

Los permisos del técnico ahora funcionan correctamente:

1. ✅ **Técnico autor puede gestionar sus artículos**
2. ✅ **Publicar/Despublicar implementado**
3. ✅ **Eliminar con confirmación implementado**
4. ✅ **Permisos validados correctamente**
5. ✅ **UI/UX clara y profesional**
6. ✅ **Feedback con toast en todas las acciones**
7. ✅ **0 errores de TypeScript**

El módulo de conocimientos ahora permite al técnico autor gestionar sus propios artículos mientras mantiene la inmutabilidad del contenido (que viene del ticket resuelto).

---

**Desarrollado por:** Kiro AI  
**Fecha:** 2026-02-06  
**Estado:** ✅ COMPLETADO  
**Módulo:** Base de Conocimientos - Permisos de Técnico

