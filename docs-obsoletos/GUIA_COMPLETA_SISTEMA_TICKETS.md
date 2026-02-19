# 📚 GUÍA COMPLETA DEL SISTEMA DE TICKETS

**Fecha**: 5 de Febrero, 2026  
**Versión**: 1.0  
**Estado**: ✅ SISTEMA FUNCIONAL

---

## 📖 ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Módulo de Tickets](#módulo-de-tickets)
4. [Plan de Resolución](#plan-de-resolución)
5. [Sistema de Auditoría](#sistema-de-auditoría)
6. [Permisos por Rol](#permisos-por-rol)
7. [Integración con Base de Conocimientos](#integración-con-base-de-conocimientos)

---

## 🎯 RESUMEN EJECUTIVO

### Estado del Sistema
- ✅ **Módulo de Tickets**: 100% funcional
- ✅ **Plan de Resolución**: Implementado con mock data
- ✅ **Sistema de Calificación**: Funcional con Prisma
- ✅ **Base de Conocimientos**: Integrada
- ⚠️ **Sistema de Auditoría**: Parcialmente implementado

### Funcionalidades Principales
1. **Gestión de Tickets** - CRUD completo por rol
2. **Plan de Resolución** - Tareas y seguimiento
3. **Calificación de Servicio** - 1-5 estrellas + categorías
4. **Archivos Adjuntos** - Upload/download
5. **Timeline de Eventos** - Historial completo
6. **Integración con Conocimientos** - Crear artículos desde tickets

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Estructura de Carpetas
```
src/
├── app/
│   ├── admin/tickets/[id]/page.tsx      # Vista Admin
│   ├── technician/tickets/[id]/page.tsx # Vista Técnico
│   └── client/tickets/[id]/page.tsx     # Vista Cliente
├── components/
│   ├── ui/
│   │   ├── ticket-timeline.tsx          # Timeline de eventos
│   │   ├── ticket-rating-system.tsx     # Sistema de calificación
│   │   └── ticket-resolution-tracker.tsx # Plan de resolución
│   └── tickets/
│       ├── attachment-button.tsx        # Subir archivos
│       └── file-upload.tsx              # Gestión de archivos
├── hooks/
│   ├── use-ticket-data.ts               # Hook principal de tickets
│   ├── use-timeline.ts                  # Hook de timeline
│   └── use-resolution-plan.ts           # Hook de plan de resolución
└── app/api/tickets/[id]/
    ├── route.ts                         # CRUD de tickets
    ├── comments/route.ts                # Comentarios
    ├── rating/route.ts                  # Calificaciones
    ├── resolution-plan/route.ts         # Plan de resolución
    ├── timeline/route.ts                # Timeline
    └── attachments/route.ts             # Archivos adjuntos
```

---

## 🎫 MÓDULO DE TICKETS

### Tabs por Rol

#### **ADMIN** (4 tabs):
1. **Historial** - Timeline completo + comentarios internos
2. **Plan de Resolución** - Crear/editar plan y tareas
3. **Calificación** - Ver calificación + estadísticas del técnico
4. **Archivos** - Subir/ver/descargar archivos

#### **TÉCNICO** (4 tabs):
1. **Estado** - Cambiar estado con transiciones válidas
2. **Historial** - Timeline + agregar comentarios
3. **Plan de Resolución** - Crear/editar (si es asignado)
4. **Archivos** - Ver/descargar archivos

#### **CLIENTE** (3 tabs):
1. **Historial** - Ver actividad pública + comentarios
2. **Calificación** - Calificar servicio (si RESOLVED/CLOSED)
3. **Archivos** - Ver/descargar archivos

### Navegación
- ✅ Todos los roles tienen botón "Volver" en el header
- ✅ Admin: "Todos los Tickets"
- ✅ Técnico: "Mis Tickets"
- ✅ Cliente: "Mis Tickets"

---

## 📋 PLAN DE RESOLUCIÓN

### ¿Qué es?
El Plan de Resolución es una herramienta para que técnicos y administradores organicen las tareas necesarias para resolver un ticket de manera estructurada.

### Características

#### 1. **Estructura del Plan**
```typescript
interface ResolutionPlan {
  id: string
  ticketId: string
  title: string
  description?: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  totalTasks: number
  completedTasks: number
  estimatedHours: number
  actualHours: number
  startDate?: string
  targetDate?: string
  completedDate?: string
  tasks: ResolutionTask[]
  createdBy: User
  createdAt: string
  updatedAt: string
}
```

#### 2. **Tareas del Plan**
```typescript
interface ResolutionTask {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority: 'low' | 'medium' | 'high'
  estimatedHours?: number
  actualHours?: number
  assignedTo?: User
  dueDate?: string
  completedAt?: string
  dependencies?: string[]
  notes?: string
}
```

### Flujo de Trabajo

1. **Crear Plan** (Admin/Técnico)
   - Click en "Crear Plan de Resolución"
   - Ingresar título y descripción
   - Plan se crea con estado 'draft'

2. **Agregar Tareas**
   - Click en "Agregar Tarea"
   - Completar formulario:
     - Título (requerido)
     - Descripción (opcional)
     - Prioridad (low/medium/high)
     - Horas estimadas
     - Fecha de vencimiento
   - Tarea se agrega al plan

3. **Actualizar Estado de Tareas**
   - Click en checkbox para marcar como completada
   - Click en botón play/pause para cambiar estado
   - Estados disponibles:
     - `pending` → `in_progress`
     - `in_progress` → `completed` o `blocked`
     - `blocked` → `in_progress`

4. **Seguimiento de Progreso**
   - Barra de progreso automática
   - Estadísticas en tiempo real:
     - Total de tareas
     - Tareas completadas
     - Horas estimadas vs reales
     - Porcentaje de completitud

### Permisos

| Acción | Admin | Técnico | Cliente |
|--------|-------|---------|---------|
| Ver plan | ✅ | ✅ | ❌ |
| Crear plan | ✅ | ✅ (si asignado) | ❌ |
| Agregar tareas | ✅ | ✅ (si asignado) | ❌ |
| Actualizar tareas | ✅ | ✅ (si asignado) | ❌ |
| Eliminar tareas | ✅ | ✅ (si asignado) | ❌ |

### Estado Actual

⚠️ **IMPORTANTE**: El Plan de Resolución actualmente usa **MOCK DATA**

**Archivos involucrados**:
- `src/app/api/tickets/[id]/resolution-plan/route.ts` - Mock API
- `src/components/ui/ticket-resolution-tracker.tsx` - Componente UI
- `src/hooks/use-timeline.ts` - Hook `useResolutionPlan`

**Para implementar con base de datos**:
1. Crear tablas en Prisma:
   - `resolution_plans`
   - `resolution_tasks`
2. Actualizar API para usar Prisma
3. Agregar relaciones en schema
4. Implementar auditoría de cambios

---

## 🔍 SISTEMA DE AUDITORÍA

### Estado Actual

#### ✅ **Implementado**:
1. **Tabla `audit_logs`** en Prisma
2. **Auditoría de Calificaciones** - Registra cuando se crea una calificación
3. **Auditoría de Tickets** - Registra cambios de estado (parcial)

#### ⚠️ **Parcialmente Implementado**:
1. **Timeline de Eventos** - Usa mock data
2. **Historial de Cambios** - No persiste en BD
3. **Comentarios** - No se registran en audit_logs

#### ❌ **No Implementado**:
1. **Auditoría de Plan de Resolución**
2. **Auditoría de Archivos Adjuntos**
3. **Auditoría de Asignaciones**
4. **Auditoría de Cambios de Prioridad**

### Estructura de Auditoría

```typescript
interface AuditLog {
  id: string
  entityType: string        // 'ticket', 'rating', 'comment', etc.
  entityId: string
  action: string            // 'created', 'updated', 'deleted', etc.
  userId: string
  changes?: JSON            // Cambios realizados
  metadata?: JSON           // Información adicional
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}
```

### Implementación Recomendada

#### 1. **Auditoría Completa de Tickets**
```typescript
// Registrar en audit_logs cuando:
- Se crea un ticket
- Se actualiza estado
- Se cambia prioridad
- Se reasigna técnico
- Se cambia categoría
- Se edita título/descripción
```

#### 2. **Auditoría de Plan de Resolución**
```typescript
// Registrar en audit_logs cuando:
- Se crea un plan
- Se agrega una tarea
- Se actualiza estado de tarea
- Se completa una tarea
- Se elimina una tarea
```

#### 3. **Auditoría de Comentarios**
```typescript
// Registrar en audit_logs cuando:
- Se agrega un comentario
- Se marca como interno
- Se adjuntan archivos
```

#### 4. **Auditoría de Archivos**
```typescript
// Registrar en audit_logs cuando:
- Se sube un archivo
- Se descarga un archivo
- Se elimina un archivo
```

### Ejemplo de Implementación

```typescript
// src/lib/audit.ts
export async function createAuditLog({
  entityType,
  entityId,
  action,
  userId,
  changes,
  metadata
}: AuditLogInput) {
  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      entityType,
      entityId,
      action,
      userId,
      changes: changes ? JSON.stringify(changes) : null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date()
    }
  })
}

// Uso en API
await createAuditLog({
  entityType: 'ticket',
  entityId: ticketId,
  action: 'status_changed',
  userId: session.user.id,
  changes: {
    oldValue: 'OPEN',
    newValue: 'IN_PROGRESS'
  },
  metadata: {
    comment: 'Iniciando trabajo en el ticket'
  }
})
```

---

## 👥 PERMISOS POR ROL

### Matriz Completa de Permisos

| Funcionalidad | Admin | Técnico | Cliente |
|--------------|-------|---------|---------|
| **TICKETS** |
| Ver todos los tickets | ✅ | ❌ (solo asignados) | ❌ (solo propios) |
| Crear ticket | ✅ | ❌ | ✅ |
| Editar título/descripción | ✅ | ❌ | ✅ (solo OPEN) |
| Eliminar ticket | ✅ | ❌ | ✅ (solo OPEN) |
| Cambiar estado | ✅ | ✅ (transiciones) | ❌ |
| Cambiar prioridad | ✅ | ❌ | ❌ |
| Reasignar técnico | ✅ | ❌ | ❌ |
| Cambiar categoría | ✅ | ❌ | ❌ |
| Auto-asignación | ✅ | ❌ | ❌ |
| **HISTORIAL** |
| Ver timeline completo | ✅ | ✅ | ✅ (solo público) |
| Ver comentarios internos | ✅ | ✅ | ❌ |
| Agregar comentarios | ✅ | ✅ | ✅ |
| Comentarios internos | ✅ | ✅ | ❌ |
| **PLAN DE RESOLUCIÓN** |
| Ver plan | ✅ | ✅ | ❌ |
| Crear plan | ✅ | ✅ (si asignado) | ❌ |
| Editar plan | ✅ | ✅ (si asignado) | ❌ |
| Agregar tareas | ✅ | ✅ (si asignado) | ❌ |
| Actualizar tareas | ✅ | ✅ (si asignado) | ❌ |
| **CALIFICACIÓN** |
| Ver calificación | ✅ | ❌ | ✅ |
| Crear calificación | ❌ | ❌ | ✅ (RESOLVED/CLOSED) |
| Ver estadísticas técnico | ✅ | ❌ | ❌ |
| **ARCHIVOS** |
| Ver archivos | ✅ | ✅ | ✅ |
| Subir archivos | ✅ | ✅ | ✅ |
| Descargar archivos | ✅ | ✅ | ✅ |
| Eliminar archivos | ✅ | ❌ | ❌ |
| **BASE DE CONOCIMIENTOS** |
| Crear artículo | ✅ | ✅ (RESOLVED) | ❌ |
| Ver artículos | ✅ | ✅ | ✅ |

---

## 📚 INTEGRACIÓN CON BASE DE CONOCIMIENTOS

### Flujo de Creación de Artículos

#### 1. **Desde Ticket Resuelto** (Técnico/Admin)

**Condiciones**:
- Ticket debe estar en estado `RESOLVED`
- Usuario debe ser el técnico asignado o admin

**Proceso**:
1. Botón "Crear Artículo" aparece en header del ticket
2. Click redirige a `/technician/knowledge/create?fromTicket={ticketId}`
3. Formulario se pre-llena con:
   - Título del ticket
   - Descripción/solución
   - Categoría del ticket
   - Tags relevantes

**Código**:
```tsx
// En página de detalle del ticket
const canCreateArticle = 
  ticket.status === 'RESOLVED' && 
  ticket.assignee?.id === session?.user?.id

{canCreateArticle && (
  <Button onClick={() => router.push(`/technician/knowledge/create?fromTicket=${ticket.id}`)}>
    <Lightbulb className='h-4 w-4 mr-2' />
    Crear Artículo
  </Button>
)}
```

#### 2. **Vinculación Ticket-Artículo**

**Tabla recomendada**:
```sql
CREATE TABLE ticket_knowledge_articles (
  id UUID PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id),
  article_id UUID REFERENCES knowledge_articles(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ticket_id, article_id)
);
```

**Beneficios**:
- Rastrear qué artículos se crearon desde qué tickets
- Mostrar artículos relacionados en el ticket
- Métricas de documentación
- Auditoría de conocimiento generado

#### 3. **Artículos Relacionados en Tickets**

**Mostrar en sidebar**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Artículos Relacionados</CardTitle>
  </CardHeader>
  <CardContent>
    {relatedArticles.map(article => (
      <Link key={article.id} href={`/knowledge/${article.id}`}>
        <div className='p-2 hover:bg-muted rounded'>
          <p className='font-medium'>{article.title}</p>
          <p className='text-xs text-muted-foreground'>
            {article.views} vistas • {article.rating}/5
          </p>
        </div>
      </Link>
    ))}
  </CardContent>
</Card>
```

---

## 🔧 MEJORAS RECOMENDADAS

### Prioridad ALTA

1. **Implementar Plan de Resolución con Prisma**
   - Crear tablas en schema
   - Migrar de mock data a BD real
   - Agregar auditoría

2. **Completar Sistema de Auditoría**
   - Registrar todos los cambios en audit_logs
   - Implementar timeline real (no mock)
   - Agregar filtros de auditoría

3. **Implementar Creación de Artículos desde Tickets**
   - Página `/technician/knowledge/create`
   - API para vincular ticket-artículo
   - Pre-llenado de formulario

### Prioridad MEDIA

4. **Notificaciones en Tiempo Real**
   - WebSockets para cambios de estado
   - Notificaciones push
   - Alertas de nuevos comentarios

5. **Métricas Avanzadas**
   - Tiempo promedio de resolución
   - Tickets por técnico
   - Satisfacción del cliente
   - Tendencias de categorías

6. **Exportación de Reportes**
   - PDF de tickets
   - Excel de métricas
   - Reportes personalizados

### Prioridad BAJA

7. **Vista Previa de Imágenes**
   - Lightbox para imágenes adjuntas
   - Thumbnails en lista
   - Zoom y rotación

8. **Plantillas de Respuesta**
   - Respuestas predefinidas
   - Variables dinámicas
   - Categorización de plantillas

9. **SLA (Service Level Agreement)**
   - Definir tiempos de respuesta
   - Alertas de vencimiento
   - Métricas de cumplimiento

---

## ✅ CHECKLIST DE VERIFICACIÓN

### Funcionalidades Básicas
- ✅ Crear ticket
- ✅ Ver lista de tickets
- ✅ Ver detalle de ticket
- ✅ Editar ticket (según rol)
- ✅ Eliminar ticket (según rol)
- ✅ Cambiar estado
- ✅ Agregar comentarios
- ✅ Subir archivos
- ✅ Descargar archivos
- ✅ Calificar servicio

### Plan de Resolución
- ✅ Ver plan (mock data)
- ✅ Crear plan (mock data)
- ✅ Agregar tareas (mock data)
- ✅ Actualizar estado de tareas (mock data)
- ⚠️ Persistencia en BD (pendiente)
- ⚠️ Auditoría (pendiente)

### Sistema de Auditoría
- ✅ Tabla audit_logs creada
- ✅ Auditoría de calificaciones
- ⚠️ Auditoría de tickets (parcial)
- ❌ Auditoría de plan de resolución
- ❌ Auditoría de comentarios
- ❌ Auditoría de archivos

### Integración con Conocimientos
- ✅ Botón "Crear Artículo" visible
- ⚠️ Página de creación (pendiente)
- ⚠️ API de vinculación (pendiente)
- ⚠️ Artículos relacionados (pendiente)

---

## 📞 SOPORTE

Para dudas o problemas:
1. Revisar esta guía completa
2. Consultar código fuente en `/src`
3. Verificar APIs en `/src/app/api/tickets`
4. Revisar componentes en `/src/components`

---

**Última actualización**: 5 de Febrero, 2026  
**Versión del documento**: 1.0  
**Estado del sistema**: ✅ FUNCIONAL (con mejoras pendientes)
