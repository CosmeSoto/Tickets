# Sistema de Tickets - Análisis Arquitectónico Avanzado

## 1. ARQUITECTURA DEL SISTEMA Y PATRONES

### 1.1 Estructura General
- **Backend**: Node.js/Express con TypeScript + Prisma ORM
- **Base de Datos**: PostgreSQL con relaciones complejas
- **Frontend**: Next.js (en desarrollo)
- **Infraestructura**: Docker, Redis, Nginx

### 1.2 Patrones Arquitectónicos Implementados

#### Service Layer Pattern
```typescript
// Separación clara entre controladores y lógica de negocio
- Controllers: Manejan requests/responses
- Services: Contienen lógica de negocio
- Repositories: Acceso a datos (Prisma)
```

**Ventajas adaptables a Next.js:**
- Reutilización de lógica en API routes y Server Components
- Testing simplificado
- Mantenibilidad mejorada

#### Repository Pattern (Implícito con Prisma)
```typescript
// Prisma actúa como ORM centralizado
- Queries tipadas
- Migraciones versionadas
- Relaciones automáticas
```

#### Middleware Chain Pattern
```typescript
// Cadena de middlewares para seguridad y auditoría
1. Security Headers (Helmet)
2. Rate Limiting (express-rate-limit)
3. CORS
4. Authentication (JWT/Passport)
5. Audit Logging
6. Error Handling
```

---

## 2. ESQUEMA DE BASE DE DATOS Y RELACIONES

### 2.1 Modelos Principales

#### User (Gestión de Usuarios)
```prisma
- id: UUID (PK)
- email: String (UNIQUE)
- passwordHash: String (opcional para OAuth)
- role: UserRole (ADMIN, AGENT, USER)
- isActive: Boolean
- isEmailVerified: Boolean
- lastLogin: DateTime
- oauthProvider, oauthId: Para OAuth
- toastPreferences: JSON (configuración de notificaciones)
- Relaciones:
  - tickets (como cliente)
  - assignedTickets (como técnico)
  - comments
  - categoryAssignments (técnicos a categorías)
```

#### Ticket (Gestión de Tickets)
```prisma
- id: UUID (PK)
- title, description: String
- status: TicketStatus (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
- priority: TicketPriority (LOW, MEDIUM, HIGH, URGENT)
- clientId: FK → User
- assigneeId: FK → User (nullable)
- hierarchyCategoryId: FK → CategoryHierarchy
- resolvedAt: DateTime (nullable)
- Relaciones:
  - client, assignee (Users)
  - hierarchyCategory
  - comments, attachments, history
```

#### CategoryHierarchy (Categorías Jerárquicas - 4 Niveles)
```prisma
- id: UUID (PK)
- name: String
- level: Int (1-4)
  1. Área de Servicio
  2. Tipo de Incidente
  3. Categoría Principal
  4. Problema Específico
- parentId: FK (auto-referencial)
- order: Int (para ordenamiento)
- isActive: Boolean
- Relaciones:
  - parent, children (auto-referencial)
  - tickets
  - technicianAssignments
```

#### TechnicianCategoryAssignment (Asignación Inteligente)
```prisma
- id: UUID (PK)
- technicianId: FK → User
- categoryId: FK → CategoryHierarchy
- priority: Int (1=alta, 2=media, 3=baja)
- maxTickets: Int (nullable, límite de carga)
- autoAssign: Boolean (asignación automática)
- isActive: Boolean
- Índices: (technicianId, categoryId) UNIQUE
```

#### TicketComment (Comentarios)
```prisma
- id: UUID (PK)
- content: String
- isInternal: Boolean (comentarios internos vs públicos)
- ticketId: FK → Ticket
- authorId: FK → User
```

#### Attachment (Archivos)
```prisma
- id: UUID (PK)
- filename, originalName: String
- mimeType, size: Metadatos
- path: String (ubicación en servidor)
- ticketId: FK → Ticket
```

#### TicketHistory (Auditoría de Cambios)
```prisma
- id: UUID (PK)
- action: String (STATUS_CHANGED, PRIORITY_CHANGED, etc.)
- field, oldValue, newValue: String
- ticketId: FK → Ticket
- userId: String (quién hizo el cambio)
```

#### AuditLog (Auditoría General)
```prisma
- id: UUID (PK)
- action: String (CREATE, UPDATE, DELETE)
- entity: String (Ticket, User, etc.)
- entityId: String
- oldValues, newValues: JSON
- userId, userEmail: String
- ipAddress, userAgent: String
- createdAt: DateTime
```

#### NotificationPreference (Preferencias de Notificación)
```prisma
- userId: FK → User (UNIQUE)
- emailEnabled, teamsEnabled: Boolean
- ticketCreated, ticketUpdated, ticketAssigned, etc.: Boolean
```

#### OAuthAccount (Cuentas OAuth)
```prisma
- id: UUID (PK)
- provider: String (google, microsoft, etc.)
- providerId: String
- accessToken, refreshToken: String
- expiresAt: DateTime
- userId: FK → User
- Índice: (provider, providerId) UNIQUE
```

---

## 3. SISTEMA DE GESTIÓN DE USUARIOS Y ROLES

### 3.1 Roles y Permisos

```typescript
enum UserRole {
  ADMIN    // Acceso total, gestión del sistema
  AGENT    // Técnicos, pueden asignar y resolver tickets
  USER     // Clientes, pueden crear y ver sus tickets
}
```

### 3.2 Características Avanzadas de UserService

#### Gestión de Contraseñas
```typescript
- Hash con bcryptjs (12 rounds)
- Cambio de contraseña con verificación
- Tokens de reset con expiración
- Validación de fortaleza
```

#### Autenticación Multi-Método
```typescript
1. Local: Email + Contraseña
2. OAuth: Google, Microsoft
3. JWT: Tokens con expiración
4. Passport.js: Estrategias configurables
```

#### Estadísticas de Usuarios
```typescript
- Total por rol
- Usuarios activos/inactivos
- Último login
- Departamentos
```

---

## 4. FLUJO DE GESTIÓN DE TICKETS

### 4.1 Ciclo de Vida del Ticket

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
  ↓         ↓            ↓
  └─────────┴────────────┘ (puede volver atrás)
```

### 4.2 Asignación Inteligente de Tickets

**Algoritmo de TicketAssignmentService:**

```typescript
async findBestTechnicianForCategory(categoryId: string): Promise<string | null> {
  // 1. Obtener técnicos asignados a la categoría (activos, con autoAssign=true)
  // 2. Para cada técnico:
  //    - Contar tickets activos (OPEN, IN_PROGRESS)
  //    - Verificar límite máximo (maxTickets)
  //    - Calcular score: (priority - 1) * 10 + activeTickets
  // 3. Retornar técnico con menor score
  
  // Ejemplo:
  // Técnico A: prioridad 1, 5 tickets activos → score = 0 + 5 = 5
  // Técnico B: prioridad 2, 2 tickets activos → score = 10 + 2 = 12
  // → Seleccionar Técnico A
}
```

### 4.3 Historial y Auditoría

```typescript
// Cada cambio en ticket genera:
1. TicketHistory: Registro de cambios específicos
2. AuditLog: Registro general de acciones
3. Notificaciones: Email/Teams según preferencias
```

---

## 5. SISTEMA DE CATEGORÍAS JERÁRQUICAS

### 5.1 Estructura de 4 Niveles

```
Nivel 1: Área de Servicio
├── Nivel 2: Tipo de Incidente
│   ├── Nivel 3: Categoría Principal
│   │   ├── Nivel 4: Problema Específico
│   │   └── Nivel 4: Problema Específico
│   └── Nivel 3: Categoría Principal
└── Nivel 2: Tipo de Incidente
```

### 5.2 Características de HierarchyCategoryService

```typescript
// Métodos principales:
- getHierarchy(): Obtiene árbol completo
- getChildren(parentId): Obtiene hijos de una categoría
- getByLevel(level): Obtiene categorías por nivel
- getPath(id): Obtiene ruta completa (breadcrumb)
- validateDependencies(): Verifica antes de eliminar
- exportCatalog(): Exporta a JSON
- importCatalog(): Importa con validación
- validateCatalogStructure(): Valida estructura JSON
```

### 5.3 Validaciones Jerárquicas

```typescript
// Reglas:
1. Solo nivel 1 puede no tener padre
2. Nivel N debe tener padre de nivel N-1
3. No se puede eliminar si tiene tickets o hijos
4. Se puede desactivar en lugar de eliminar
5. Importación valida estructura completa
```

---

## 6. SISTEMA DE CARGA DE ARCHIVOS Y SEGURIDAD

### 6.1 Características de AttachmentService

```typescript
// Validaciones:
- Tipos MIME permitidos (whitelist)
- Tamaño máximo: 10MB
- Nombre de archivo sanitizado
- Almacenamiento en servidor (no en DB)
- Ruta: /uploads/tickets/{ticketId}/{filename}

// Metadatos almacenados:
- filename: Nombre sanitizado
- originalName: Nombre original
- mimeType: Tipo MIME
- size: Tamaño en bytes
- path: Ruta en servidor
```

### 6.2 Seguridad de Archivos

```typescript
// Protecciones:
1. Validación de tipo MIME
2. Sanitización de nombres
3. Límite de tamaño
4. Acceso controlado por permisos
5. Eliminación en cascada con ticket
6. Logs de descarga
```

---

## 7. SISTEMA DE NOTIFICACIONES

### 7.1 Canales de Notificación

```typescript
1. Email (Nodemailer + Bull Queue)
   - Tickets creados
   - Cambios de estado
   - Comentarios públicos
   - Resumen diario

2. Microsoft Teams (Webhooks)
   - Tickets asignados
   - Cambios de estado
   - Comentarios internos
   - Resumen diario

3. Toast Notifications (Frontend)
   - Éxito, error, advertencia, info
   - Configurables por usuario
   - Persistencia en BD
```

### 7.2 Preferencias de Notificación

```typescript
// NotificationPreference:
- emailEnabled: Boolean
- teamsEnabled: Boolean
- ticketCreated: Boolean
- ticketUpdated: Boolean
- ticketAssigned: Boolean
- ticketResolved: Boolean
- commentAdded: Boolean
```

### 7.3 Arquitectura de Colas

```typescript
// Bull Queue para Email:
- Procesamiento asincrónico
- Reintentos automáticos
- Persistencia en Redis
- Estadísticas de cola
```

---

## 8. SISTEMA DE SEGURIDAD

### 8.1 Middleware de Seguridad

```typescript
1. Helmet: Headers de seguridad
   - CSP (Content Security Policy)
   - HSTS (HTTP Strict Transport Security)
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff

2. Rate Limiting (express-rate-limit)
   - General: 1000 req/15min
   - Auth: 10 req/15min
   - Tickets: 50 req/5min
   - Admin: 100 req/10min

3. CORS: Configurado para frontend específico

4. CSRF: Protección mediante Origin/Referer headers

5. Validación de Content-Type
```

### 8.2 Autenticación y Autorización

```typescript
// Estrategias Passport:
1. Local: Email + Contraseña
2. JWT: Bearer tokens
3. OAuth: Google, Microsoft

// Middleware:
- authenticateJWT: Verifica token
- requireRole(...roles): Autorización por rol
- optionalAuth: Autenticación opcional
```

### 8.3 Auditoría

```typescript
// AuditService registra:
- Acción (CREATE, UPDATE, DELETE)
- Entidad y ID
- Valores anteriores y nuevos
- Usuario (ID y email)
- IP y User-Agent
- Timestamp

// Consultas:
- Por usuario, entidad, acción
- Rango de fechas
- Estadísticas
```

---

## 9. SISTEMA DE REPORTES Y DASHBOARD

### 9.1 Métricas Disponibles

```typescript
interface TicketMetrics {
  totalTickets: number
  ticketsByStatus: Record<TicketStatus, number>
  ticketsByPriority: Record<TicketPriority, number>
  ticketsByCategory: Array<{ categoryName: string; count: number }>
  averageResolutionTime: number // en horas
  ticketsResolvedInTime: number
  ticketsOverdue: number
}
```

### 9.2 Formatos de Exportación

```typescript
1. JSON: Datos brutos para procesamiento
2. PDF: Reporte formateado con Puppeteer
3. Excel: Hojas de cálculo con ExcelJS
   - Hoja de resumen
   - Hoja de tickets detallados
   - Gráficos de distribución
```

### 9.3 Filtros de Reportes

```typescript
- Rango de fechas
- Categoría
- Estado
- Prioridad
- Técnico asignado
- Cliente
- Búsqueda de texto
```

---

## 10. SISTEMA DE BACKUPS

### 10.1 Características

```typescript
// BackupService:
- Backup automático con pg_dump
- Compresión de archivos
- Retención configurable (default: 30 días)
- Límite de backups (default: 100)
- Restauración desde backup
- Estadísticas de backups
```

### 10.2 Configuración

```typescript
// Variables de entorno:
- DATABASE_URL: Conexión a PostgreSQL
- BACKUP_DIR: Directorio de almacenamiento
- BACKUP_RETENTION_DAYS: Días de retención
- MAX_BACKUPS: Máximo de backups
```

### 10.3 Auditoría de Backups

```typescript
// Eventos registrados:
- BACKUP_CREATED: Backup exitoso
- BACKUP_FAILED: Error en backup
- BACKUP_RESTORED: Restauración exitosa
- BACKUP_RESTORE_FAILED: Error en restauración
```

---

## 11. ESTRUCTURA DE API Y ENDPOINTS

### 11.1 Rutas Principales

```
/api/auth
  POST /login - Autenticación local
  POST /register - Registro de usuario
  POST /logout - Cierre de sesión
  POST /refresh - Renovar token

/api/auth/oauth
  GET /google - Autenticación Google
  GET /microsoft - Autenticación Microsoft

/api/users
  GET / - Listar usuarios (admin)
  POST / - Crear usuario (admin)
  GET /:id - Obtener usuario
  PUT /:id - Actualizar usuario
  DELETE /:id - Desactivar usuario

/api/tickets
  GET / - Listar tickets (con filtros)
  POST / - Crear ticket
  GET /:id - Obtener ticket
  PUT /:id - Actualizar ticket
  DELETE /:id - Eliminar ticket
  GET /:id/comments - Comentarios
  POST /:id/comments - Agregar comentario
  POST /:id/attachments - Subir archivo

/api/categories/hierarchy
  GET / - Obtener jerarquía
  POST / - Crear categoría
  PUT /:id - Actualizar categoría
  DELETE /:id - Eliminar categoría
  GET /:id/children - Obtener hijos

/api/admin/technician-assignments
  GET / - Listar asignaciones
  POST / - Crear asignación
  PUT /:id - Actualizar asignación
  DELETE /:id - Eliminar asignación

/api/reports
  GET / - Generar reporte
  GET /export/pdf - Exportar PDF
  GET /export/excel - Exportar Excel
  GET /dashboard - Métricas dashboard

/api/audit
  GET / - Listar logs de auditoría
  GET /stats - Estadísticas

/api/admin/backups
  GET / - Listar backups
  POST / - Crear backup
  POST /restore - Restaurar backup
```

### 11.2 Patrones de Respuesta

```typescript
// Éxito:
{
  success: true,
  data: { ... }
}

// Error:
{
  success: false,
  error: "Mensaje de error",
  code: "ERROR_CODE",
  details: [ ... ] // opcional
}

// Paginación:
{
  success: true,
  data: {
    items: [ ... ],
    total: 100,
    page: 1,
    limit: 10,
    totalPages: 10
  }
}
```

---

## 12. PATRONES DE TESTING

### 12.1 Estructura de Tests

```typescript
// Jest + Supertest
- Unit tests: Servicios
- Integration tests: Controladores
- E2E tests: Flujos completos

// Cobertura:
- Validación de entrada
- Lógica de negocio
- Manejo de errores
- Permisos y autorización
```

### 12.2 Fixtures y Mocks

```typescript
// Setup:
- Base de datos de prueba
- Usuarios de prueba
- Tickets de prueba
- Mocks de servicios externos
```

---

## 13. CONFIGURACIÓN Y VARIABLES DE ENTORNO

### 13.1 Variables Críticas

```env
# Base de datos
DATABASE_URL=postgresql://user:pass@localhost:5432/tickets

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=24h

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# Teams
TEAMS_WEBHOOK_URL=...

# Archivos
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Backups
BACKUP_DIR=../backups
BACKUP_RETENTION_DAYS=30

# Frontend
FRONTEND_URL=http://localhost:3000

# Entorno
NODE_ENV=development
```

---

## 14. RECOMENDACIONES PARA ADAPTACIÓN A NEXT.JS

### 14.1 Servicios Reutilizables

```typescript
// Crear carpeta: src/lib/services/
- ticketService.ts (lógica de tickets)
- userService.ts (gestión de usuarios)
- hierarchyCategoryService.ts (categorías)
- technicianAssignmentService.ts (asignaciones)
- notificationService.ts (notificaciones)
- reportService.ts (reportes)
- auditService.ts (auditoría)
- backupService.ts (backups)
```

### 14.2 API Routes en Next.js

```typescript
// Estructura: src/app/api/[resource]/[action]/route.ts
/api/tickets/route.ts (GET, POST)
/api/tickets/[id]/route.ts (GET, PUT, DELETE)
/api/tickets/[id]/comments/route.ts (GET, POST)
/api/categories/hierarchy/route.ts (GET, POST)
/api/admin/technician-assignments/route.ts (GET, POST)
/api/reports/route.ts (GET)
/api/reports/export/pdf/route.ts (GET)
/api/reports/export/excel/route.ts (GET)
```

### 14.3 Middleware en Next.js

```typescript
// src/middleware.ts
- Autenticación JWT
- Autorización por rol
- Rate limiting
- Auditoría
- Validación de Content-Type
```

### 14.4 Server Components vs Client Components

```typescript
// Server Components (para datos sensibles):
- Listado de tickets (con filtros)
- Dashboard con métricas
- Reportes
- Gestión de usuarios (admin)

// Client Components (para interactividad):
- Formularios
- Modales
- Filtros dinámicos
- Notificaciones toast
```

### 14.5 Caché y Revalidación

```typescript
// Usar Next.js caching:
- revalidatePath() para invalidar caché
- revalidateTag() para tags específicos
- ISR (Incremental Static Regeneration)
- Caché de API con Redis
```

---

## 15. CARACTERÍSTICAS PROFESIONALES DESTACADAS

### 15.1 Asignación Inteligente
- Algoritmo de balanceo de carga
- Consideración de prioridades
- Límites de capacidad
- Asignación automática

### 15.2 Auditoría Completa
- Registro de todas las acciones
- Historial de cambios en tickets
- Trazabilidad de usuario
- IP y User-Agent

### 15.3 Notificaciones Multi-Canal
- Email con colas
- Microsoft Teams
- Toast notifications
- Preferencias personalizables

### 15.4 Reportes Avanzados
- Múltiples formatos (JSON, PDF, Excel)
- Filtros complejos
- Métricas calculadas
- Exportación de datos

### 15.5 Seguridad Robusta
- Rate limiting granular
- Headers de seguridad
- Validación de entrada
- Protección CSRF
- Auditoría de accesos

### 15.6 Gestión de Categorías Jerárquica
- 4 niveles de profundidad
- Validación de estructura
- Importación/exportación
- Asignación de técnicos por categoría

---

## 16. CONCLUSIONES Y PRÓXIMOS PASOS

### 16.1 Fortalezas del Sistema Actual
1. Arquitectura modular y escalable
2. Seguridad robusta con múltiples capas
3. Auditoría completa de acciones
4. Notificaciones multi-canal
5. Reportes avanzados
6. Gestión inteligente de asignaciones

### 16.2 Oportunidades de Mejora en Next.js
1. Migrar servicios a API routes
2. Implementar Server Components para mejor rendimiento
3. Usar Prisma Client en Next.js
4. Implementar caché con Redis
5. Mejorar UX con componentes interactivos
6. Agregar real-time con WebSockets

### 16.3 Prioridades de Implementación
1. **Fase 1**: Servicios base (tickets, usuarios, categorías)
2. **Fase 2**: Autenticación y autorización
3. **Fase 3**: Notificaciones y auditoría
4. **Fase 4**: Reportes y dashboard
5. **Fase 5**: Características avanzadas (real-time, etc.)
