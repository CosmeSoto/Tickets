# Guía de Migración - Auditoría Enriquecida

**Fecha**: 2026-02-20  
**Objetivo**: Actualizar llamadas a auditoría para aprovechar contexto enriquecido

---

## Problema Actual

Los logs de auditoría existentes NO tienen contexto enriquecido porque fueron creados antes de las mejoras. Para ver las mejoras, necesitas:

1. **Crear nuevos logs** con el formato mejorado
2. **Actualizar APIs** para pasar el objeto `request`

---

## Migración Gradual (Recomendado)

### Opción 1: Sin Cambios (Funciona pero sin mejoras)

```typescript
// Código actual - SIGUE FUNCIONANDO
await AuditServiceComplete.log({
  action: 'created',
  entityType: 'comment',
  entityId: comment.id,
  userId: session.user.id,
  details: {
    content: comment.content
  }
})
```

**Resultado**: Log básico sin contexto enriquecido

### Opción 2: Con Request (Recomendado)

```typescript
// Código mejorado - CON CONTEXTO ENRIQUECIDO
const startTime = Date.now()

try {
  // Tu operación
  const comment = await createComment(...)
  
  await AuditServiceComplete.log({
    action: 'created',
    entityType: 'comment',
    entityId: comment.id,
    userId: session.user.id,
    details: {
      content: comment.content,
      metadata: { ticketId: comment.ticketId }
    },
    // NUEVO: Agregar estos campos
    request: request,           // NextRequest object
    startTime: startTime,       // Para calcular duración
    result: 'SUCCESS'           // Resultado de la operación
  })
} catch (error) {
  // Auditar errores también
  await AuditServiceComplete.log({
    action: 'created',
    entityType: 'comment',
    userId: session.user.id,
    details: {
      error: error.message
    },
    request: request,
    startTime: startTime,
    result: 'ERROR',
    errorCode: error.code,
    errorMessage: error.message
  })
  
  throw error
}
```

**Resultado**: Log completo con:
- ✅ Dispositivo detectado
- ✅ Navegador y versión
- ✅ SO y versión
- ✅ Origen (Web/API/Mobile)
- ✅ Duración de la operación
- ✅ Resultado (Success/Error)
- ✅ Session ID
- ✅ Request ID

---

## Ejemplo Completo: API de Comentarios

### Antes (Básico)

```typescript
// src/app/api/tickets/[id]/comments/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  
  const body = await request.json()
  
  const comment = await prisma.comments.create({
    data: {
      content: body.content,
      ticketId: params.id,
      userId: session.user.id
    }
  })
  
  // Auditoría básica
  await AuditServiceComplete.log({
    action: 'created',
    entityType: 'comment',
    entityId: comment.id,
    userId: session.user.id
  })
  
  return NextResponse.json(comment)
}
```

### Después (Enriquecido)

```typescript
// src/app/api/tickets/[id]/comments/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now() // ⬅️ NUEVO: Iniciar timer
  
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  
  try {
    const body = await request.json()
    
    const comment = await prisma.comments.create({
      data: {
        content: body.content,
        ticketId: params.id,
        userId: session.user.id,
        isInternal: body.isInternal || false
      }
    })
    
    // ⬅️ NUEVO: Auditoría enriquecida
    await AuditServiceComplete.log({
      action: 'created',
      entityType: 'comment',
      entityId: comment.id,
      userId: session.user.id,
      details: {
        content: comment.content,
        metadata: {
          ticketId: params.id,
          isInternal: comment.isInternal
        }
      },
      request: request,              // ⬅️ NUEVO
      startTime: startTime,          // ⬅️ NUEVO
      result: 'SUCCESS'              // ⬅️ NUEVO
    })
    
    return NextResponse.json(comment)
    
  } catch (error) {
    // ⬅️ NUEVO: Auditar errores
    await AuditServiceComplete.log({
      action: 'created',
      entityType: 'comment',
      userId: session.user.id,
      details: {
        error: error instanceof Error ? error.message : 'Error desconocido',
        ticketId: params.id
      },
      request: request,
      startTime: startTime,
      result: 'ERROR',
      errorCode: error.code || 'UNKNOWN',
      errorMessage: error instanceof Error ? error.message : 'Error desconocido'
    })
    
    return NextResponse.json(
      { error: 'Error al crear comentario' },
      { status: 500 }
    )
  }
}
```

---

## Prioridad de Migración

### Alta Prioridad (Migrar primero)
1. ✅ Creación de tickets
2. ✅ Creación de comentarios
3. ✅ Actualización de tickets
4. ✅ Cambios de estado
5. ✅ Asignaciones

### Media Prioridad
6. Creación de usuarios
7. Cambios de rol
8. Actualización de categorías
9. Actualización de departamentos

### Baja Prioridad
10. Visualización de reportes
11. Exportaciones
12. Consultas de solo lectura

---

## Verificación

### 1. Crear un Comentario de Prueba

1. Ve a un ticket
2. Agrega un comentario
3. Ve a Admin → Auditoría
4. Busca el log más reciente

**Deberías ver**:
- ✅ Origen (🌐 Web)
- ✅ Dispositivo (🖥️ Escritorio)
- ✅ Navegador (Google Chrome)
- ✅ SO (macOS/Windows)
- ✅ Duración (⏱️ XXms)

### 2. Exportar CSV

1. Ve a Admin → Auditoría
2. Click en "Exportar CSV"
3. Abre el archivo

**Deberías ver columnas**:
- Dispositivo
- Origen
- Resultado
- Duración (ms)

---

## Solución Rápida: Actualizar Solo API de Comentarios

Para ver las mejoras AHORA, actualiza solo la API de comentarios:

```bash
# Editar archivo
nano src/app/api/tickets/[id]/comments/route.ts
```

Aplica los cambios del ejemplo "Después" mostrado arriba.

Luego:
1. Reinicia el servidor
2. Crea un comentario nuevo
3. Ve a auditoría
4. Exporta CSV

¡Verás el contexto enriquecido!

---

## Compatibilidad

### ✅ Logs Antiguos

Los logs creados antes de las mejoras:
- ✅ Se muestran correctamente
- ✅ Se exportan correctamente
- ✅ Campos nuevos aparecen como "Desconocido" o "No disponible"

### ✅ Logs Nuevos

Los logs creados después de las mejoras:
- ✅ Tienen contexto completo
- ✅ Se exportan con toda la información
- ✅ Aparecen con iconos y colores

---

## Resumen

**Para ver las mejoras**:
1. Actualiza al menos 1 API (recomendado: comentarios)
2. Crea un registro nuevo (comentario, ticket, etc.)
3. Ve a auditoría y exporta

**No es necesario**:
- ❌ Migrar todas las APIs de una vez
- ❌ Actualizar logs antiguos
- ❌ Cambiar la base de datos

**Es opcional**:
- ⚠️ Migrar APIs gradualmente
- ⚠️ Agregar manejo de errores
- ⚠️ Medir duración de operaciones
