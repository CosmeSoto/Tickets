# 🗄️ Esquema de Base de Datos

**Sistema de Gestión de Tickets**  
**Base de Datos:** PostgreSQL 14+  
**ORM:** Prisma 5.x

---

## 📊 Resumen General

### Estadísticas
- **Total de Tablas:** 24
- **Total de Relaciones:** 35+
- **Total de Índices:** 40+
- **Total de Enums:** 6

### Módulos Principales
1. **Usuarios y Autenticación** (5 tablas)
2. **Tickets y Gestión** (8 tablas)
3. **Organización** (3 tablas)
4. **Notificaciones** (2 tablas)
5. **Sistema** (6 tablas)

---

## 👥 MÓDULO: USUARIOS Y AUTENTICACIÓN

### Tabla: `users`
**Descripción:** Almacena todos los usuarios del sistema (Admin, Técnicos, Clientes)

#### Campos Principales:
```typescript
{
  id: string (CUID)
  email: string (único)
  name: string
  passwordHash: string?
  role: UserRole (ADMIN | TECHNICIAN | CLIENT)
  departmentId: string?
  phone: string?
  avatar: string?
  isActive: boolean
  isEmailVerified: boolean
  lastLogin: DateTime?
  oauthProvider: string?
  oauthId: string?
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### Relaciones:
- **1:N** → `tickets` (como cliente)
- **1:N** → `tickets` (como técnico asignado)
- **1:N** → `tickets` (como creador)
- **1:N** → `comments`
- **1:N** → `attachments`
- **1:N** → `notifications`
- **1:N** → `technicianAssignments`
- **1:N** → `ticketHistory`
- **1:N** → `ticketRatings` (como cliente)
- **1:N** → `ticketRatings` (como técnico)
- **N:1** → `departments`
- **1:1** → `notificationPreferences`

#### Índices:
- `[role, isActive]`
- `[name, email]`
- `[departmentId]`

---

### Tabla: `accounts`
**Descripción:** Cuentas de OAuth (NextAuth.js)

#### Campos:
```typescript
{
  id: string
  userId: string
  type: string
  provider: string
  providerAccountId: string
  refresh_token: string?
  access_token: string?
  expires_at: int?
  token_type: string?
  scope: string?
  id_token: string?
  session_state: string?
}
```

---

### Tabla: `sessions`
**Descripción:** Sesiones activas de usuarios

#### Campos:
```typescript
{
  id: string
  sessionToken: string (único)
  userId: string
  expires: DateTime
}
```

---

### Tabla: `oauth_accounts`
**Descripción:** Cuentas OAuth adicionales

---

### Tabla: `verification_tokens`
**Descripción:** Tokens de verificación de email

---

## 🎫 MÓDULO: TICKETS Y GESTIÓN

### Tabla: `tickets`
**Descripción:** Tabla principal de tickets

#### Campos Principales:
```typescript
{
  id: string
  title: string
  description: string
  status: TicketStatus (OPEN | IN_PROGRESS | RESOLVED | CLOSED)
  priority: TicketPriority (LOW | MEDIUM | HIGH | URGENT)
  clientId: string
  assigneeId: string?
  categoryId: string
  createdById: string?
  resolvedAt: DateTime?
  closedAt: DateTime?
  firstResponseAt: DateTime?
  slaDeadline: DateTime?
  estimatedTime: int?
  actualTime: int?
  tags: string[]
  source: TicketSource
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### Relaciones:
- **N:1** → `users` (cliente)
- **N:1** → `users` (técnico asignado)
- **N:1** → `users` (creador)
- **N:1** → `categories`
- **1:N** → `comments`
- **1:N** → `attachments`
- **1:N** → `ticketHistory`
- **1:N** → `notifications`
- **1:1** → `ticketRating`
- **1:1** → `ticketResolutionPlan`

#### Índices:
- `[assigneeId, status]`
- `[clientId, createdAt DESC]`
- `[status, priority]`
- `[categoryId, status]`
- `[title, description]`
- `[createdById]`
- `[source, status]`

---

### Tabla: `ticket_ratings`
**Descripción:** Calificaciones de tickets por clientes

#### Campos:
```typescript
{
  id: string
  ticketId: string (único)
  clientId: string
  technicianId: string?
  rating: int (1-5)
  feedback: string?
  responseTime: int (1-5)
  technicalSkill: int (1-5)
  communication: int (1-5)
  problemResolution: int (1-5)
  isPublic: boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### Índices:
- `[technicianId, createdAt DESC]`
- `[rating, createdAt DESC]`

---

### Tabla: `ticket_resolution_plans`
**Descripción:** Planes de resolución de tickets

#### Campos:
```typescript
{
  id: string
  ticketId: string (único)
  title: string
  description: string?
  diagnosis: string?
  solution: string?
  estimatedTime: int?
  actualTime: int?
  startedAt: DateTime?
  completedAt: DateTime?
  status: ResolutionStatus
  createdAt: DateTime
  updatedAt: DateTime
}
```

---

### Tabla: `ticket_resolution_tasks`
**Descripción:** Tareas dentro de un plan de resolución

#### Campos:
```typescript
{
  id: string
  planId: string
  title: string
  description: string?
  order: int
  status: TaskStatus
  startedAt: DateTime?
  completedAt: DateTime?
  notes: string?
  createdAt: DateTime
  updatedAt: DateTime
}
```

---

### Tabla: `comments`
**Descripción:** Comentarios en tickets

#### Campos:
```typescript
{
  id: string
  content: string
  isInternal: boolean
  ticketId: string
  authorId: string
  createdAt: DateTime
  updatedAt: DateTime
}
```

---

### Tabla: `attachments`
**Descripción:** Archivos adjuntos a tickets

#### Campos:
```typescript
{
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: int
  path: string
  ticketId: string
  uploadedBy: string
  createdAt: DateTime
}
```

---

### Tabla: `ticket_history`
**Descripción:** Historial de cambios en tickets

#### Campos:
```typescript
{
  id: string
  action: string
  field: string?
  oldValue: string?
  newValue: string?
  comment: string?
  ticketId: string
  userId: string
  createdAt: DateTime
}
```

---

## 🏢 MÓDULO: ORGANIZACIÓN

### Tabla: `departments`
**Descripción:** Departamentos de la organización

#### Campos:
```typescript
{
  id: string
  name: string (único)
  description: string?
  color: string (default: #3B82F6)
  isActive: boolean
  order: int
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### Relaciones:
- **1:N** → `users`
- **1:N** → `categories`

---

### Tabla: `categories`
**Descripción:** Categorías jerárquicas de tickets

#### Campos:
```typescript
{
  id: string
  name: string
  description: string?
  level: int
  parentId: string?
  departmentId: string?
  order: int
  color: string (default: #6B7280)
  isActive: boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### Relaciones:
- **N:1** → `categories` (padre)
- **1:N** → `categories` (hijos)
- **N:1** → `departments`
- **1:N** → `tickets`
- **1:N** → `technicianAssignments`

#### Índices:
- `[parentId, level, isActive]`
- `[departmentId]`

---

### Tabla: `technician_assignments`
**Descripción:** Asignación de técnicos a categorías

#### Campos:
```typescript
{
  id: string
  technicianId: string
  categoryId: string
  priority: int
  maxTickets: int?
  autoAssign: boolean
  isActive: boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### Restricción Única:
- `[technicianId, categoryId]`

---

## 🔔 MÓDULO: NOTIFICACIONES

### Tabla: `notifications`
**Descripción:** Notificaciones del sistema

#### Campos:
```typescript
{
  id: string
  title: string
  message: string
  type: NotificationType
  userId: string
  ticketId: string?
  isRead: boolean
  createdAt: DateTime
}
```

---

### Tabla: `notification_preferences`
**Descripción:** Preferencias de notificación por usuario

#### Campos:
```typescript
{
  userId: string (PK)
  emailEnabled: boolean
  teamsEnabled: boolean
  inAppEnabled: boolean
  ticketCreated: boolean
  ticketUpdated: boolean
  ticketAssigned: boolean
  ticketResolved: boolean
  commentAdded: boolean
}
```

---

## ⚙️ MÓDULO: SISTEMA

### Tabla: `system_settings`
**Descripción:** Configuraciones del sistema

---

### Tabla: `backups`
**Descripción:** Registro de backups

#### Campos:
```typescript
{
  id: string
  filename: string
  filepath: string
  size: int
  type: string (manual | automatic)
  status: string (completed | failed | in_progress)
  error: string?
  checksum: string?
  compressed: boolean
  encrypted: boolean
  createdAt: DateTime
}
```

---

### Tabla: `audit_logs`
**Descripción:** Logs de auditoría

#### Campos:
```typescript
{
  id: string
  action: string
  entityType: string
  entityId: string
  userId: string?
  userEmail: string?
  ipAddress: string?
  userAgent: string?
  details: Json?
  createdAt: DateTime
}
```

---

### Tabla: `pages`
**Descripción:** Páginas CMS

---

### Tabla: `site_config`
**Descripción:** Configuración del sitio

---

## 📐 ENUMS

### UserRole
```typescript
enum UserRole {
  ADMIN
  TECHNICIAN
  CLIENT
}
```

### TicketStatus
```typescript
enum TicketStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}
```

### TicketPriority
```typescript
enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

### TicketSource
```typescript
enum TicketSource {
  WEB
  EMAIL
  PHONE
  CHAT
  API
  ADMIN
}
```

### ResolutionStatus
```typescript
enum ResolutionStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

### TaskStatus
```typescript
enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  SKIPPED
}
```

### NotificationType
```typescript
enum NotificationType {
  INFO
  SUCCESS
  WARNING
  ERROR
}
```

---

## 🔗 DIAGRAMA DE RELACIONES

### Relaciones Principales:

```
User (Cliente)
  └─> Ticket (1:N)
       ├─> Category (N:1)
       │    └─> Department (N:1)
       ├─> User (Técnico) (N:1)
       ├─> Comment (1:N)
       ├─> Attachment (1:N)
       ├─> TicketHistory (1:N)
       ├─> TicketRating (1:1)
       └─> TicketResolutionPlan (1:1)
            └─> TicketResolutionTask (1:N)

User (Técnico)
  └─> TechnicianAssignment (1:N)
       └─> Category (N:1)

Department
  ├─> User (1:N)
  └─> Category (1:N)

Category (Jerárquica)
  ├─> Category (Padre) (N:1)
  └─> Category (Hijos) (1:N)
```

---

## 🎯 OPTIMIZACIONES

### Índices Implementados:
- ✅ Índices en claves foráneas
- ✅ Índices compuestos para queries frecuentes
- ✅ Índices en campos de búsqueda
- ✅ Índices en campos de ordenamiento

### Estrategias de Rendimiento:
- ✅ Uso de CUID para IDs distribuidos
- ✅ Índices en timestamps para ordenamiento
- ✅ Índices compuestos para filtros comunes
- ✅ Cascada de eliminación configurada
- ✅ Campos calculados para métricas

---

## 📝 NOTAS IMPORTANTES

### Integridad Referencial:
- Todas las relaciones tienen `onDelete: Cascade` donde corresponde
- Los campos opcionales permiten flexibilidad
- Las restricciones únicas previenen duplicados

### Escalabilidad:
- Uso de índices para queries frecuentes
- Estructura normalizada
- Campos JSON para datos flexibles
- Preparado para sharding futuro

---

**Última actualización:** 16/01/2026
