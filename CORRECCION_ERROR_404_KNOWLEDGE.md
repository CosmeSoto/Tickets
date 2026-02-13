# Corrección Error 404 - /api/knowledge/create

**Fecha**: 5 de Febrero, 2026  
**Error**: `GET http://localhost:3000/api/knowledge/create 404 (Not Found)`

---

## 🔍 PROBLEMA

Cuando navegas a `/technician/knowledge/new` o `/admin/knowledge/new`, el componente de detalle `[id]/page.tsx` se activa porque Next.js intenta renderizar la ruta dinámica con `id="new"` o `id="create"`.

El componente entonces intenta cargar el artículo con:
```typescript
const response = await fetch(`/api/knowledge/${articleId}`)
// Resulta en: GET /api/knowledge/new (404)
```

---

## ✅ SOLUCIÓN APLICADA

Agregada validación en ambos componentes de detalle para evitar cargar cuando el ID es "create" o "new":

### Técnico - `/src/app/technician/knowledge/[id]/page.tsx`

```typescript
useEffect(() => {
  if (!session || session.user.role !== 'TECHNICIAN') {
    router.push('/login')
    return
  }

  // Evitar cargar si el ID es "create" o "new"
  if (articleId && articleId !== 'create' && articleId !== 'new') {
    loadArticle()
  }
}, [session, articleId, router])
```

### Admin - `/src/app/admin/knowledge/[id]/page.tsx`

```typescript
useEffect(() => {
  if (!session || session.user.role !== 'ADMIN') {
    router.push('/login')
    return
  }

  // Evitar cargar si el ID es "create" o "new"
  if (articleId && articleId !== 'create' && articleId !== 'new') {
    loadArticle()
  }
}, [session, articleId, router])
```

---

## 📊 RESULTADO

- ✅ Error 404 eliminado
- ✅ Página `/technician/knowledge/new` carga correctamente
- ✅ Página `/admin/knowledge/new` carga correctamente
- ✅ Páginas de detalle funcionan normalmente con IDs reales

---

## 🎯 ARCHIVOS MODIFICADOS

1. `src/app/technician/knowledge/[id]/page.tsx`
2. `src/app/admin/knowledge/[id]/page.tsx`

---

## 🧪 VERIFICACIÓN

Después de esta corrección:

1. ✅ Navegar a `/technician/knowledge/new` - NO debe mostrar error 404
2. ✅ Navegar a `/admin/knowledge/new` - NO debe mostrar error 404
3. ✅ Navegar a un artículo real - Debe cargar correctamente
4. ✅ Consola del navegador - Sin errores 404

---

**Estado**: ✅ Corregido  
**Impacto**: Bajo - Solo afecta navegación a páginas de creación
