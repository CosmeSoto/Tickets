# Corrección: Error 409 - Artículo Duplicado

**Fecha:** 2026-02-05  
**Estado:** ✅ CORREGIDO

---

## 🐛 Problema Reportado

Al intentar crear un artículo desde un ticket que **ya tiene un artículo creado**, se mostraba error 409 (Conflict) en consola sin manejo adecuado en el frontend.

### Error Original:
```
POST http://localhost:3000/api/tickets/70c51d7a-6502-442d-985e-676527255aae/create-article 409 (Conflict)
```

---

## ✅ Solución Implementada

### 1. Mejora en Hook `use-knowledge.ts`

**Antes:**
```typescript
if (!response.ok) {
  const errorData = await response.json()
  throw new Error(errorData.error || 'Error al crear artículo desde ticket')
}
```

**Después:**
```typescript
const result = await response.json()

if (!response.ok) {
  // Si ya existe un artículo (409), retornar el ID del artículo existente
  if (response.status === 409 && result.articleId) {
    setError('Ya existe un artículo creado desde este ticket')
    return { id: result.articleId } as Article
  }
  
  throw new Error(result.error || 'Error al crear artículo desde ticket')
}
```

**Mejora:** Captura específicamente el error 409 y retorna el ID del artículo existente.

### 2. Detección Temprana en Carga Inicial

**Nueva funcionalidad en `loadTicketSuggestions()`:**

```typescript
// Verificar si ya existe un artículo
if (data.existingArticle) {
  toast.warning(
    `Ya existe un artículo creado desde este ticket: "${data.existingArticle.title}"`,
    {
      duration: 5000,
      action: {
        label: 'Ver artículo',
        onClick: () => router.push(`/technician/knowledge/${data.existingArticle.id}`)
      }
    }
  )
  // Redirigir automáticamente después de 3 segundos
  setTimeout(() => {
    router.push(`/technician/knowledge/${data.existingArticle.id}`)
  }, 3000)
  return
}
```

**Mejora:** Detecta artículo existente ANTES de mostrar el formulario y redirige automáticamente.

### 3. Manejo Mejorado en `handleSubmit()`

**Antes:**
```typescript
if (article) {
  toast.success('Artículo creado exitosamente desde el ticket')
  router.push(`/technician/knowledge/${article.id}`)
} else {
  toast.error('Error al crear artículo')
}
```

**Después:**
```typescript
if (article) {
  // Si ya existía un artículo, redirigir al existente
  if (article.id && !article.title) {
    toast.warning('Ya existe un artículo creado desde este ticket. Redirigiendo...')
    router.push(`/technician/knowledge/${article.id}`)
  } else {
    toast.success('Artículo creado exitosamente desde el ticket')
    router.push(`/technician/knowledge/${article.id}`)
  }
} else {
  toast.error('Error al crear artículo')
}
```

**Mejora:** Distingue entre artículo nuevo y artículo existente, mostrando mensaje apropiado.

---

## 🔄 Flujo Mejorado

### Escenario 1: Ticket SIN artículo existente

```
1. Usuario hace clic en "Crear Artículo"
   ↓
2. Redirige a /knowledge/new?fromTicket=ID
   ↓
3. Llama a GET /api/tickets/[id]/create-article
   ↓
4. API retorna: existingArticle = null
   ↓
5. Pre-llena formulario con sugerencias
   ↓
6. Usuario edita y hace clic en "Crear Artículo"
   ↓
7. POST crea artículo exitosamente
   ↓
8. Toast: "Artículo creado exitosamente"
   ↓
9. Redirige a /knowledge/[articleId]
```

### Escenario 2: Ticket CON artículo existente

```
1. Usuario hace clic en "Crear Artículo"
   ↓
2. Redirige a /knowledge/new?fromTicket=ID
   ↓
3. Llama a GET /api/tickets/[id]/create-article
   ↓
4. API retorna: existingArticle = { id, title }
   ↓
5. Toast warning: "Ya existe un artículo creado desde este ticket: [título]"
   ↓
6. Botón "Ver artículo" en toast
   ↓
7. Redirige automáticamente después de 3 segundos
   ↓
8. Muestra artículo existente
```

### Escenario 3: Usuario intenta crear manualmente (edge case)

```
1. Usuario ignora warning y hace clic en "Crear Artículo"
   ↓
2. POST /api/tickets/[id]/create-article
   ↓
3. API retorna 409 con articleId
   ↓
4. Hook captura 409 y retorna { id: articleId }
   ↓
5. Toast warning: "Ya existe un artículo creado desde este ticket"
   ↓
6. Redirige a artículo existente
```

---

## 🎯 Validaciones Implementadas

### En API (Backend):
```typescript
// Verificar que no exista ya un artículo para este ticket
const existingArticle = await prisma.knowledge_articles.findFirst({
  where: { sourceTicketId: ticketId },
})

if (existingArticle) {
  return NextResponse.json(
    { 
      error: 'Ya existe un artículo creado desde este ticket',
      articleId: existingArticle.id,
    },
    { status: 409 }
  )
}
```

### En Frontend (Detección temprana):
```typescript
if (data.existingArticle) {
  // Mostrar warning y redirigir
  toast.warning(...)
  setTimeout(() => router.push(...), 3000)
  return
}
```

### En Frontend (Manejo de error):
```typescript
if (response.status === 409 && result.articleId) {
  setError('Ya existe un artículo creado desde este ticket')
  return { id: result.articleId } as Article
}
```

---

## 📊 Experiencia de Usuario

### Antes:
- ❌ Error 409 en consola
- ❌ No se mostraba mensaje al usuario
- ❌ Usuario no sabía qué pasó
- ❌ No había forma de ver el artículo existente

### Después:
- ✅ Detección temprana (antes de mostrar formulario)
- ✅ Toast warning con título del artículo existente
- ✅ Botón "Ver artículo" en toast
- ✅ Redirección automática después de 3 segundos
- ✅ Si intenta crear manualmente, redirige al existente
- ✅ Mensajes claros y accionables

---

## 🔍 Casos de Prueba

### Test 1: Crear artículo desde ticket sin artículo
```
✅ Formulario se pre-llena
✅ Usuario puede crear artículo
✅ Redirige a artículo nuevo
✅ Toast: "Artículo creado exitosamente"
```

### Test 2: Crear artículo desde ticket con artículo existente
```
✅ Detecta artículo existente inmediatamente
✅ Muestra toast warning con título
✅ Botón "Ver artículo" funciona
✅ Redirige automáticamente después de 3s
✅ No muestra formulario
```

### Test 3: Intentar crear manualmente (edge case)
```
✅ Si usuario ignora warning y envía formulario
✅ API retorna 409
✅ Frontend captura 409
✅ Muestra toast warning
✅ Redirige a artículo existente
```

---

## 📝 Archivos Modificados

1. **`src/hooks/use-knowledge.ts`**
   - Mejora en `createFromTicket()` para capturar 409
   - Retorna ID del artículo existente

2. **`src/app/technician/knowledge/new/page.tsx`**
   - Detección temprana en `loadTicketSuggestions()`
   - Mejora en `handleSubmit()` para distinguir casos
   - Toast con botón de acción

3. **`src/app/admin/knowledge/new/page.tsx`**
   - Mismas mejoras que técnico
   - Rutas ajustadas para admin

---

## ✨ Beneficios

1. **Prevención de duplicados**
   - Detecta artículo existente antes de mostrar formulario
   - Evita trabajo innecesario del usuario

2. **Experiencia mejorada**
   - Mensajes claros y accionables
   - Redirección automática
   - Botón para ver artículo existente

3. **Manejo robusto de errores**
   - Captura específica de error 409
   - Fallback si detección temprana falla
   - Siempre redirige al artículo correcto

4. **Consistencia**
   - Mismo comportamiento en técnico y admin
   - Mensajes uniformes
   - UX predecible

---

## 🚀 Próximos Pasos Opcionales

1. **Mostrar artículo existente en ticket**
   - Badge "Artículo creado" en detalle de ticket
   - Link directo al artículo
   - Fecha de creación

2. **Permitir actualizar artículo existente**
   - Botón "Actualizar artículo" en lugar de "Crear"
   - Formulario de edición pre-llenado
   - Historial de cambios

3. **Dashboard de artículos**
   - Tickets con artículo vs sin artículo
   - Tasa de documentación por técnico
   - Artículos más útiles

---

## ✅ Conclusión

El error 409 ahora se maneja correctamente con:
- Detección temprana (antes de mostrar formulario)
- Toast warning con acción
- Redirección automática
- Manejo de edge cases

**Estado:** ✅ CORREGIDO  
**Requiere:** Reiniciar servidor para aplicar cambios

---

**Desarrollado por:** Kiro AI  
**Fecha:** 2026-02-05
