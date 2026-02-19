# Implementación: Botón Inteligente de Artículos en Tickets

**Fecha:** 2026-02-06  
**Estado:** ✅ COMPLETADO  
**Fase:** 2 de 5 (Botón Inteligente)

---

## 🎯 Objetivo

Implementar un botón inteligente en las páginas de detalle de tickets que:
- Muestre "Crear Artículo" si NO existe artículo vinculado
- Muestre "Ver Artículo" si YA existe artículo vinculado
- Incluya badge de estado (Publicado/Borrador)
- Solo aparezca cuando el ticket esté en estado RESOLVED

---

## ✅ Cambios Implementados

### 1. API de Tickets - Incluir Relación con Knowledge Articles

**Archivo:** `src/app/api/tickets/[id]/route.ts`

**Cambio:** Agregado `knowledge_article` al include de Prisma

```typescript
knowledge_article: {
  select: {
    id: true,
    title: true,
    isPublished: true,
    createdAt: true
  }
}
```

**Beneficio:** El frontend ahora recibe información del artículo vinculado (si existe) en una sola petición, sin necesidad de hacer requests adicionales.

---

### 2. Página de Técnico - Botón Inteligente

**Archivo:** `src/app/technician/tickets/[id]/page.tsx`

**Cambios:**

#### a) Importar ícono BookOpen
```typescript
import { ..., BookOpen } from 'lucide-react'
```

#### b) Lógica de verificación
```typescript
const canCreateArticle = ticket.status === 'RESOLVED' && ticket.assignee?.id === session?.user?.id
const hasArticle = ticket.knowledge_article !== null && ticket.knowledge_article !== undefined

const handleViewArticle = () => {
  if (ticket.knowledge_article?.id) {
    router.push(`/technician/knowledge/${ticket.knowledge_article.id}`)
  }
}
```

#### c) Renderizado condicional
```typescript
{canCreateArticle && (
  hasArticle ? (
    <Button variant='outline' size='sm' onClick={handleViewArticle}>
      <BookOpen className='h-4 w-4 sm:mr-2' />
      <span className='hidden sm:inline'>Ver Artículo</span>
      <span className='sm:hidden'>Artículo</span>
      {ticket.knowledge_article && !ticket.knowledge_article.isPublished && (
        <Badge variant='secondary' className='ml-2 text-xs'>Borrador</Badge>
      )}
    </Button>
  ) : (
    <Button variant='outline' size='sm' onClick={handleCreateArticle}>
      <Lightbulb className='h-4 w-4 sm:mr-2' />
      <span className='hidden sm:inline'>Crear Artículo</span>
      <span className='sm:hidden'>Artículo</span>
    </Button>
  )
)}
```

---

### 3. Página de Admin - Botón Inteligente

**Archivo:** `src/app/admin/tickets/[id]/page.tsx`

**Cambios:**

#### a) Importar ícono BookOpen
```typescript
import { ..., BookOpen } from 'lucide-react'
```

#### b) Renderizado condicional en headerActions
```typescript
{ticket.status === 'RESOLVED' && (
  ticket.knowledge_article ? (
    <Button
      variant='outline'
      size='sm'
      onClick={() => router.push(`/admin/knowledge/${ticket.knowledge_article.id}`)}
    >
      <BookOpen className='h-4 w-4 mr-2' />
      <span className='hidden sm:inline'>Ver Artículo</span>
      <span className='sm:hidden'>Artículo</span>
      {!ticket.knowledge_article.isPublished && (
        <Badge variant='secondary' className='ml-2 text-xs'>Borrador</Badge>
      )}
    </Button>
  ) : (
    <Button
      variant='outline'
      size='sm'
      onClick={() => router.push(`/admin/knowledge/new?fromTicket=${ticket.id}`)}
    >
      <Lightbulb className='h-4 w-4 mr-2' />
      <span className='hidden sm:inline'>Crear Artículo</span>
      <span className='sm:hidden'>Artículo</span>
    </Button>
  )
)}
```

---

## 🎨 Comportamiento UX

### Escenario 1: Ticket Resuelto SIN Artículo
```
Estado: RESOLVED
Artículo: NO existe

Botón mostrado:
┌─────────────────────────┐
│ 💡 Crear Artículo       │
└─────────────────────────┘

Al hacer clic:
→ Redirige a /technician/knowledge/new?fromTicket={id}
→ Formulario se pre-llena automáticamente
```

### Escenario 2: Ticket Resuelto CON Artículo Publicado
```
Estado: RESOLVED
Artículo: EXISTE (isPublished: true)

Botón mostrado:
┌─────────────────────────┐
│ 📖 Ver Artículo         │
└─────────────────────────┘

Al hacer clic:
→ Redirige a /technician/knowledge/{articleId}
→ Muestra el artículo existente
```

### Escenario 3: Ticket Resuelto CON Artículo Borrador
```
Estado: RESOLVED
Artículo: EXISTE (isPublished: false)

Botón mostrado:
┌─────────────────────────────────┐
│ 📖 Ver Artículo  [Borrador]    │
└─────────────────────────────────┘

Al hacer clic:
→ Redirige a /technician/knowledge/{articleId}
→ Muestra el artículo en modo borrador
```

### Escenario 4: Ticket NO Resuelto
```
Estado: OPEN, IN_PROGRESS, ON_HOLD, CLOSED
Artículo: Cualquiera

Botón mostrado:
(ninguno)

Razón:
→ Solo tickets RESOLVED pueden generar artículos
```

---

## 🔒 Reglas de Negocio Implementadas

### 1. Un Ticket = Un Artículo
- ✅ No se puede crear más de un artículo por ticket
- ✅ El botón cambia automáticamente cuando existe artículo
- ✅ Prevención de duplicados en el backend (409 Conflict)

### 2. Solo Tickets Resueltos
- ✅ Botón solo visible cuando `status === 'RESOLVED'`
- ✅ Garantiza que el artículo se base en solución completa

### 3. Permisos por Rol
- ✅ **Técnico:** Solo puede crear artículo si es el asignado
- ✅ **Admin:** Puede crear artículo de cualquier ticket resuelto

### 4. Visibilidad del Estado
- ✅ Badge "Borrador" visible si `isPublished === false`
- ✅ Usuario sabe inmediatamente el estado del artículo

---

## 📊 Flujo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    TICKET RESUELTO                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │ ¿Existe artículo?     │
                └───────────────────────┘
                    │              │
                   NO             SÍ
                    │              │
                    ▼              ▼
        ┌──────────────────┐  ┌──────────────────┐
        │ Botón:           │  │ Botón:           │
        │ 💡 Crear         │  │ 📖 Ver           │
        │    Artículo      │  │    Artículo      │
        └──────────────────┘  └──────────────────┘
                    │              │
                    │              ├─ isPublished?
                    │              │
                    │              ├─ true: (sin badge)
                    │              └─ false: [Borrador]
                    │
                    ▼
        ┌──────────────────────────────────┐
        │ Formulario Pre-llenado           │
        │ - Título del ticket              │
        │ - Descripción + Plan resolución  │
        │ - Categoría                      │
        │ - Tags                           │
        │ - Departamento                   │
        └──────────────────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────────┐
        │ Crear Artículo                   │
        │ - Vinculado al ticket            │
        │ - sourceTicketId guardado        │
        │ - Auditoría completa             │
        └──────────────────────────────────┘
```

---

## 🧪 Casos de Prueba

### Test 1: Crear Artículo desde Ticket Resuelto
```
1. Crear ticket
2. Asignar a técnico
3. Cambiar estado a RESOLVED
4. Verificar que aparece botón "Crear Artículo"
5. Hacer clic en botón
6. Verificar que formulario se pre-llena
7. Crear artículo
8. Volver al ticket
9. Verificar que ahora aparece "Ver Artículo"
```

### Test 2: Ver Artículo Existente
```
1. Abrir ticket con artículo vinculado
2. Verificar que aparece botón "Ver Artículo"
3. Hacer clic en botón
4. Verificar redirección correcta
5. Verificar que se muestra el artículo
```

### Test 3: Badge de Borrador
```
1. Crear artículo desde ticket (isPublished = false por defecto)
2. Volver al ticket
3. Verificar que aparece badge "Borrador"
4. Publicar artículo
5. Volver al ticket
6. Verificar que badge desaparece
```

### Test 4: Permisos de Técnico
```
1. Login como técnico A
2. Abrir ticket asignado a técnico B (estado RESOLVED)
3. Verificar que NO aparece botón de artículo
4. Abrir ticket asignado a técnico A (estado RESOLVED)
5. Verificar que SÍ aparece botón de artículo
```

### Test 5: Ticket No Resuelto
```
1. Abrir ticket en estado OPEN
2. Verificar que NO aparece botón
3. Cambiar a IN_PROGRESS
4. Verificar que NO aparece botón
5. Cambiar a RESOLVED
6. Verificar que SÍ aparece botón
```

---

## 📈 Métricas de Éxito

### Antes de la Implementación
- ❌ Usuario confundido: intenta crear artículo duplicado
- ❌ Error 409 visible al usuario
- ❌ No sabe si ya existe artículo
- ❌ Necesita buscar manualmente en base de conocimientos

### Después de la Implementación
- ✅ Usuario ve claramente si existe artículo
- ✅ Un clic para ver artículo existente
- ✅ Prevención proactiva de duplicados
- ✅ UX profesional y clara

---

## 🔄 Próximas Fases

### Fase 3: Despublicación (PENDIENTE)
- Toggle isPublished
- Menú de acciones en artículo
- Confirmación de despublicación
- Auditoría de cambios

### Fase 4: Archivado (PENDIENTE)
- Campo isArchived en schema
- Migración de base de datos
- Sección "Archivados"
- Restauración de archivados

### Fase 5: Eliminación (PENDIENTE)
- Soft delete (deletedAt, deletedBy)
- Solo admin puede eliminar
- Papelera de artículos
- Restauración de eliminados

---

## 📝 Archivos Modificados

```
✅ src/app/api/tickets/[id]/route.ts
   - Agregado knowledge_article al include

✅ src/app/technician/tickets/[id]/page.tsx
   - Importado BookOpen
   - Agregada lógica hasArticle
   - Agregada función handleViewArticle
   - Renderizado condicional del botón

✅ src/app/admin/tickets/[id]/page.tsx
   - Importado BookOpen
   - Renderizado condicional en headerActions
   - Badge de estado incluido
```

---

## 🎉 Beneficios Logrados

### Para el Usuario
- ✅ Claridad inmediata sobre existencia de artículo
- ✅ Acceso directo al artículo existente
- ✅ No más intentos de crear duplicados
- ✅ Visibilidad del estado (Publicado/Borrador)

### Para el Sistema
- ✅ Menos requests al backend (include en una sola query)
- ✅ Prevención proactiva de duplicados
- ✅ UX consistente entre roles (técnico/admin)
- ✅ Código limpio y mantenible

### Para el Negocio
- ✅ Cumplimiento de regla "Un ticket = Un artículo"
- ✅ Base de conocimientos más organizada
- ✅ Menos errores y confusión
- ✅ Experiencia profesional

---

**Desarrollado por:** Kiro AI  
**Fecha:** 2026-02-06  
**Estado:** ✅ Fase 2 completada exitosamente

