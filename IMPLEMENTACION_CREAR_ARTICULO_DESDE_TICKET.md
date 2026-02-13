# Implementación: Crear Artículo desde Ticket Resuelto

## ✅ COMPLETADO

### Problema Identificado
El usuario reportó que al hacer clic en "Crear Artículo" desde un ticket resuelto, solo redirigía a un formulario vacío en lugar de pre-llenar automáticamente la información del ticket.

### Solución Implementada

#### 1. Modificación de Páginas de Creación

**Archivos modificados:**
- `src/app/technician/knowledge/new/page.tsx`
- `src/app/admin/knowledge/new/page.tsx`

**Cambios realizados:**
- ✅ Agregado `useSearchParams()` para leer parámetro `fromTicket` de la URL
- ✅ Agregado estado `sourceTicketId` para almacenar ID del ticket origen
- ✅ Agregado estado `loadingSuggestions` para mostrar carga de datos
- ✅ Implementado `useEffect` que detecta parámetro `fromTicket` y carga datos automáticamente
- ✅ Implementada función `loadTicketSuggestions()` que:
  - Llama a API GET `/api/tickets/[id]/create-article`
  - Pre-llena título con sugerencia del ticket
  - Pre-llena contenido con problema y solución del ticket
  - Pre-llena categoría del ticket
  - Pre-llena tags sugeridos
  - Genera resumen automático
- ✅ Modificado `handleSubmit()` para usar `createFromTicket()` cuando viene desde ticket
- ✅ Agregada validación: solo permite crear si `sourceTicketId` existe
- ✅ Agregada alerta visual cuando no viene desde ticket
- ✅ Agregado indicador de carga mientras se obtienen sugerencias

#### 2. Corrección de API

**Archivo modificado:**
- `src/app/api/tickets/[id]/create-article/route.ts`

**Cambios realizados:**
- ✅ Corregidos nombres de relaciones Prisma:
  - `category` → `categories`
  - `client` → `users_tickets_clientIdTousers`
  - `assignee` → `users_tickets_assigneeIdTousers`
  - `author` → `users` (en comments)
- ✅ Agregado `id` a notificaciones (requerido por schema)
- ✅ Corregido prefijo de parámetro `_request` para evitar warning

#### 3. Hook de Knowledge

**Archivo verificado:**
- `src/hooks/use-knowledge.ts`

**Funciones disponibles:**
- ✅ `createFromTicket(ticketId, data)` - Crea artículo desde ticket
- ✅ `getTicketSuggestions(ticketId)` - Obtiene sugerencias del ticket

### Flujo Completo

1. **Usuario hace clic en "Crear Artículo"** desde ticket resuelto
   - Botón redirige a: `/technician/knowledge/new?fromTicket=TICKET_ID`

2. **Página detecta parámetro `fromTicket`**
   - Lee `fromTicket` de URL con `useSearchParams()`
   - Guarda en estado `sourceTicketId`
   - Llama a `loadTicketSuggestions(ticketId)`

3. **API GET genera sugerencias**
   - Endpoint: `/api/tickets/[id]/create-article`
   - Obtiene ticket con categoría, comentarios, cliente, técnico
   - Genera título sugerido: "Solución: [título del ticket]"
   - Genera contenido en Markdown:
     ```markdown
     # [Título del ticket]
     
     ## Problema
     [Descripción del ticket]
     
     ## Solución
     [Comentarios de técnicos]
     ```
   - Extrae tags del título y categoría
   - Retorna sugerencias + datos del ticket

4. **Formulario se pre-llena automáticamente**
   - Título: sugerencia generada
   - Contenido: problema + solución
   - Categoría: misma del ticket
   - Tags: sugeridos automáticamente
   - Resumen: primeros 200 caracteres de descripción

5. **Usuario puede editar y crear**
   - Puede modificar cualquier campo
   - Al hacer clic en "Crear Artículo":
     - Llama a `createFromTicket(sourceTicketId, data)`
     - API POST crea artículo vinculado al ticket
     - Registra en auditoría
     - Notifica al cliente
     - Redirige a vista del artículo creado

### Validaciones Implementadas

- ✅ Solo permite crear desde tickets con estado `RESOLVED`
- ✅ Solo técnico asignado o admin pueden crear artículo
- ✅ No permite duplicar artículos (un ticket = un artículo)
- ✅ Valida que título tenga mínimo 10 caracteres
- ✅ Valida que contenido tenga mínimo 50 caracteres
- ✅ Valida que tenga al menos 1 tag
- ✅ Valida que tenga categoría seleccionada
- ✅ Muestra alerta si se intenta acceder sin `fromTicket`

### Alertas y Mensajes

**Cuando NO viene desde ticket:**
```
⚠️ Los artículos solo pueden crearse desde tickets resueltos.
   Ve a un ticket resuelto y haz clic en "Crear Artículo".
```

**Cuando está cargando sugerencias:**
```
⏳ Cargando información del ticket...
```

**Cuando se crea exitosamente:**
```
✅ Artículo creado exitosamente desde el ticket
```

### Regla de Negocio Aplicada

**Base de conocimientos SOLO se crea desde tickets resueltos:**
- ❌ NO hay botón "Nuevo Artículo" en listado de knowledge
- ✅ SOLO se puede crear desde botón "Crear Artículo" en tickets RESOLVED
- ✅ Formulario pre-llenado automáticamente con información del ticket
- ✅ Artículo queda vinculado al ticket origen (`sourceTicketId`)

### Próximos Pasos Sugeridos

1. **Ocultar/Deshabilitar botón "Nuevo Artículo"** en listado de knowledge
2. **Agregar vista de artículos vinculados** en detalle de ticket
3. **Permitir editar artículos** creados desde tickets
4. **Agregar métricas** de artículos creados por técnico

### Testing Manual

Para probar la funcionalidad:

1. Ir a un ticket con estado RESOLVED
2. Hacer clic en botón "Crear Artículo"
3. Verificar que formulario se pre-llena automáticamente
4. Editar campos si es necesario
5. Hacer clic en "Crear Artículo"
6. Verificar que redirige a vista del artículo
7. Verificar que artículo aparece en base de conocimientos
8. Verificar que cliente recibe notificación

### Archivos Modificados

```
sistema-tickets-nextjs/
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   └── knowledge/
│   │   │       └── new/
│   │   │           └── page.tsx ✅ MODIFICADO
│   │   ├── technician/
│   │   │   └── knowledge/
│   │   │       └── new/
│   │   │           └── page.tsx ✅ MODIFICADO
│   │   └── api/
│   │       └── tickets/
│   │           └── [id]/
│   │               └── create-article/
│   │                   └── route.ts ✅ CORREGIDO
│   └── hooks/
│       └── use-knowledge.ts ✅ VERIFICADO
└── IMPLEMENTACION_CREAR_ARTICULO_DESDE_TICKET.md ✅ NUEVO
```

---

**Fecha:** 2026-02-05  
**Estado:** ✅ COMPLETADO  
**Requiere reinicio:** Sí (para cargar cambios en frontend)
