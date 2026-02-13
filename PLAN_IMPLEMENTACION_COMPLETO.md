# 🚀 PLAN DE IMPLEMENTACIÓN COMPLETO

**Fecha**: 5 de Febrero, 2026  
**Objetivo**: Completar todas las funcionalidades pendientes del sistema de tickets

---

## ✅ FASE 1: CONSOLIDACIÓN (COMPLETADA)

- ✅ Script de consolidación ejecutado
- ✅ Archivos duplicados movidos a `archived-docs/`
- ✅ Documentación maestra creada

---

## 🔧 FASE 2: SISTEMA DE AUDITORÍA (EN PROGRESO)

### Archivos Creados:
- ✅ `src/lib/audit.ts` - Helper de auditoría

### Pendiente:

#### 1. Actualizar API de Tickets para Auditoría
**Archivo**: `src/app/api/tickets/[id]/route.ts`

**Agregar al final del archivo**:
```typescript
import { auditTicketChange } from '@/lib/audit'

// En PUT/PATCH - después de actualizar ticket
if (updateData.status && updateData.status !== ticket.status) {
  await auditTicketChange(
    ticketId,
    session.user.id,
    'status_changed',
    {
      oldValue: ticket.status,
      newValue: updateData.status
    }
  )
}

if (updateData.priority && updateData.priority !== ticket.priority) {
  await auditTicketChange(
    ticketId,
    session.user.id,
    'priority_changed',
    {
      oldValue: ticket.priority,
      newValue: updateData.priority
    }
  )
}

if (updateData.assigneeId && updateData.assigneeId !== ticket.assigneeId) {
  await auditTicketChange(
    ticketId,
    session.user.id,
    'assigned',
    {
      oldValue: ticket.assigneeId,
      newValue: updateData.assigneeId
    }
  )
}
```

#### 2. Actualizar API de Comentarios
**Archivo**: `src/app/api/tickets/[id]/comments/route.ts`

**Agregar**:
```typescript
import { auditCommentCreated } from '@/lib/audit'

// Después de crear comentario
await auditCommentCreated(
  newComment.id,
  ticketId,
  session.user.id,
  commentData.isInternal
)
```

#### 3. Actualizar API de Archivos
**Archivo**: `src/app/api/tickets/[id]/attachments/route.ts`

**Agregar**:
```typescript
import { auditFileUploaded } from '@/lib/audit'

// Después de subir archivo
await auditFileUploaded(
  attachment.id,
  ticketId,
  session.user.id,
  file.name,
  file.size
)
```

#### 4. Crear API de Timeline Real
**Archivo**: `src/app/api/tickets/[id]/timeline/route.ts`

**Reemplazar mock data con**:
```typescript
import { getAuditLogs } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    // Obtener logs de auditoría
    const auditLogs = await getAuditLogs('ticket', ticketId, 100)
    
    // Transformar a formato de timeline
    const events = auditLogs.map(log => ({
      id: log.id,
      type: mapActionToEventType(log.action),
      title: generateEventTitle(log.action),
      description: generateEventDescription(log),
      user: log.user,
      metadata: log.changes,
      createdAt: log.createdAt,
      isInternal: log.metadata?.isInternal || false
    }))

    return NextResponse.json({
      success: true,
      data: events
    })
  } catch (error) {
    console.error('Error in timeline API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar el historial del ticket'
      },
      { status: 500 }
    )
  }
}

function mapActionToEventType(action: string): string {
  const mapping: Record<string, string> = {
    'created': 'created',
    'status_changed': 'status_change',
    'priority_changed': 'priority_change',
    'assigned': 'assignment',
    'comment_created': 'comment',
    'rating_added': 'rating',
    'file_uploaded': 'attachment'
  }
  return mapping[action] || 'update'
}

function generateEventTitle(action: string): string {
  const titles: Record<string, string> = {
    'created': 'Ticket creado',
    'status_changed': 'Estado actualizado',
    'priority_changed': 'Prioridad cambiada',
    'assigned': 'Ticket asignado',
    'comment_created': 'Comentario agregado',
    'rating_added': 'Calificación agregada',
    'file_uploaded': 'Archivo adjuntado'
  }
  return titles[action] || 'Actualización'
}

function generateEventDescription(log: any): string {
  if (log.changes) {
    if (log.action === 'status_changed') {
      return `Estado cambiado de ${log.changes.oldValue} a ${log.changes.newValue}`
    }
    if (log.action === 'priority_changed') {
      return `Prioridad cambiada de ${log.changes.oldValue} a ${log.changes.newValue}`
    }
  }
  return log.metadata?.description || ''
}
```

---

## 📋 FASE 3: PLAN DE RESOLUCIÓN CON PRISMA

### 1. Actualizar Schema de Prisma
**Archivo**: `prisma/schema.prisma`

**Agregar al final**:
```prisma
model resolution_plans {
  id              String   @id @default(uuid())
  ticketId        String   @map("ticket_id")
  title           String
  description     String?  @db.Text
  status          String   @default("draft") // 'draft', 'active', 'completed', 'cancelled'
  totalTasks      Int      @default(0) @map("total_tasks")
  completedTasks  Int      @default(0) @map("completed_tasks")
  estimatedHours  Float    @default(0) @map("estimated_hours")
  actualHours     Float    @default(0) @map("actual_hours")
  startDate       DateTime? @map("start_date")
  targetDate      DateTime? @map("target_date")
  completedDate   DateTime? @map("completed_date")
  createdBy       String   @map("created_by")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  ticket          tickets  @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  creator         users    @relation("ResolutionPlanCreator", fields: [createdBy], references: [id])
  tasks           resolution_tasks[]
  
  @@index([ticketId])
  @@index([createdBy])
  @@map("resolution_plans")
}

model resolution_tasks {
  id              String   @id @default(uuid())
  planId          String   @map("plan_id")
  title           String
  description     String?  @db.Text
  status          String   @default("pending") // 'pending', 'in_progress', 'completed', 'blocked'
  priority        String   @default("medium") // 'low', 'medium', 'high'
  estimatedHours  Float?   @map("estimated_hours")
  actualHours     Float?   @map("actual_hours")
  assignedTo      String?  @map("assigned_to")
  dueDate         DateTime? @map("due_date")
  completedAt     DateTime? @map("completed_at")
  notes           String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  plan            resolution_plans @relation(fields: [planId], references: [id], onDelete: Cascade)
  assignee        users?   @relation("TaskAssignee", fields: [assignedTo], references: [id])
  
  @@index([planId])
  @@index([assignedTo])
  @@map("resolution_tasks")
}
```

### 2. Ejecutar Migración
```bash
cd sistema-tickets-nextjs
npx prisma migrate dev --name add_resolution_plans
npx prisma generate
```

### 3. Actualizar API de Resolution Plan
**Archivo**: `src/app/api/tickets/[id]/resolution-plan/route.ts`

**Reemplazar contenido completo con**:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { auditResolutionPlanChange } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id: ticketId } = await params

    const plan = await prisma.resolution_plans.findFirst({
      where: { ticketId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        tasks: {
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    if (!plan) {
      return NextResponse.json({
        success: true,
        data: null
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: plan.id,
        ticketId: plan.ticketId,
        title: plan.title,
        description: plan.description,
        status: plan.status,
        totalTasks: plan.totalTasks,
        completedTasks: plan.completedTasks,
        estimatedHours: plan.estimatedHours,
        actualHours: plan.actualHours,
        startDate: plan.startDate?.toISOString(),
        targetDate: plan.targetDate?.toISOString(),
        completedDate: plan.completedDate?.toISOString(),
        createdBy: plan.creator,
        tasks: plan.tasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          estimatedHours: task.estimatedHours,
          actualHours: task.actualHours,
          assignedTo: task.assignee,
          dueDate: task.dueDate?.toISOString(),
          completedAt: task.completedAt?.toISOString(),
          notes: task.notes,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString()
        })),
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString()
      }
    })
  } catch (error) {
    console.error('Error fetching resolution plan:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar el plan de resolución'
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id: ticketId } = await params
    const body = await request.json()

    // Verificar que el ticket existe
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId }
    })

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos
    if (session.user.role !== 'ADMIN' && ticket.assigneeId !== session.user.id) {
      return NextResponse.json(
        { success: false, message: 'No tienes permisos para crear un plan de resolución' },
        { status: 403 }
      )
    }

    // Crear plan
    const plan = await prisma.resolution_plans.create({
      data: {
        id: randomUUID(),
        ticketId,
        title: body.title || `Plan de Resolución - Ticket #${ticketId.slice(-8)}`,
        description: body.description,
        status: 'draft',
        createdBy: session.user.id,
        startDate: body.startDate ? new Date(body.startDate) : new Date()
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        tasks: true
      }
    })

    // Auditoría
    await auditResolutionPlanChange(
      plan.id,
      ticketId,
      session.user.id,
      'created'
    )

    return NextResponse.json({
      success: true,
      data: plan,
      message: 'Plan de resolución creado exitosamente'
    })
  } catch (error) {
    console.error('Error creating resolution plan:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear el plan de resolución'
      },
      { status: 500 }
    )
  }
}
```

### 4. Crear API para Tareas
**Archivo**: `src/app/api/tickets/[id]/resolution-plan/tasks/route.ts`

**Crear archivo nuevo**:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { auditTaskChange } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id: ticketId } = await params
    const body = await request.json()

    // Obtener plan
    const plan = await prisma.resolution_plans.findFirst({
      where: { ticketId }
    })

    if (!plan) {
      return NextResponse.json(
        { success: false, message: 'Plan de resolución no encontrado' },
        { status: 404 }
      )
    }

    // Crear tarea
    const task = await prisma.resolution_tasks.create({
      data: {
        id: randomUUID(),
        planId: plan.id,
        title: body.title,
        description: body.description,
        priority: body.priority || 'medium',
        estimatedHours: body.estimatedHours ? parseFloat(body.estimatedHours) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        assignedTo: body.assignedTo || null
      }
    })

    // Actualizar contador de tareas del plan
    await prisma.resolution_plans.update({
      where: { id: plan.id },
      data: {
        totalTasks: { increment: 1 }
      }
    })

    // Auditoría
    await auditTaskChange(
      task.id,
      plan.id,
      session.user.id,
      'created',
      {
        title: task.title,
        priority: task.priority
      }
    )

    return NextResponse.json({
      success: true,
      data: task,
      message: 'Tarea agregada exitosamente'
    })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear la tarea'
      },
      { status: 500 }
    )
  }
}
```

---

## 📚 FASE 4: INTEGRACIÓN CON CONOCIMIENTOS

### 1. Actualizar Schema para Vinculación
**Archivo**: `prisma/schema.prisma`

**Agregar**:
```prisma
model ticket_knowledge_articles {
  id          String   @id @default(uuid())
  ticketId    String   @map("ticket_id")
  articleId   String   @map("article_id")
  createdBy   String   @map("created_by")
  createdAt   DateTime @default(now()) @map("created_at")
  
  ticket      tickets  @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  article     knowledge_articles @relation(fields: [articleId], references: [id], onDelete: Cascade)
  creator     users    @relation("ArticleCreator", fields: [createdBy], references: [id])
  
  @@unique([ticketId, articleId])
  @@index([ticketId])
  @@index([articleId])
  @@map("ticket_knowledge_articles")
}
```

### 2. Ejecutar Migración
```bash
npx prisma migrate dev --name add_ticket_knowledge_link
npx prisma generate
```

### 3. Crear Página de Creación de Artículo
**Archivo**: `src/app/technician/knowledge/create/page.tsx`

Ver implementación completa en GUIA_COMPLETA_SISTEMA_TICKETS.md

### 4. Crear API de Vinculación
**Archivo**: `src/app/api/tickets/[id]/create-article/route.ts`

Ver implementación completa en GUIA_COMPLETA_SISTEMA_TICKETS.md

---

## ✅ FASE 5: TESTING Y VALIDACIÓN

### Checklist de Testing:

#### Auditoría:
- [ ] Cambio de estado registra en audit_logs
- [ ] Cambio de prioridad registra en audit_logs
- [ ] Asignación registra en audit_logs
- [ ] Comentarios registran en audit_logs
- [ ] Archivos registran en audit_logs
- [ ] Timeline muestra eventos reales

#### Plan de Resolución:
- [ ] Crear plan persiste en BD
- [ ] Agregar tareas persiste en BD
- [ ] Actualizar estado de tareas funciona
- [ ] Contador de tareas se actualiza
- [ ] Progreso se calcula correctamente
- [ ] Auditoría de cambios funciona

#### Integración con Conocimientos:
- [ ] Botón "Crear Artículo" visible cuando corresponde
- [ ] Página de creación carga datos del ticket
- [ ] Formulario se pre-llena correctamente
- [ ] Artículo se crea y vincula con ticket
- [ ] Auditoría registra creación

---

## 📊 PROGRESO ACTUAL

- ✅ FASE 1: Consolidación (100%)
- 🔧 FASE 2: Sistema de Auditoría (50%)
- ⏳ FASE 3: Plan de Resolución (0%)
- ⏳ FASE 4: Integración Conocimientos (0%)
- ⏳ FASE 5: Testing (0%)

---

## 🚀 PRÓXIMOS PASOS INMEDIATOS

1. Completar FASE 2 (Sistema de Auditoría)
2. Ejecutar migraciones de Prisma para FASE 3
3. Implementar APIs de Plan de Resolución
4. Crear página de creación de artículos
5. Testing completo

---

**Última actualización**: 5 de Febrero, 2026  
**Estado**: EN PROGRESO
