# Migración de Base de Datos - Sistema Profesional de Tickets

## Fecha: 2026-01-16

---

## 📋 CAMBIOS EN EL SCHEMA

### 1. Modelo Ticket - Campos Agregados

```prisma
model Ticket {
  // Campos nuevos:
  createdById       String?              // Usuario que creó el ticket
  closedAt          DateTime?            // Fecha de cierre
  firstResponseAt   DateTime?            // Primera respuesta del técnico
  slaDeadline       DateTime?            // Fecha límite según SLA
  estimatedTime     Int?                 // Tiempo estimado en minutos
  actualTime        Int?                 // Tiempo real en minutos
  tags              String[]             // Tags para búsqueda
  source            TicketSource         @default(WEB)
  
  // Relaciones nuevas:
  resolutionPlan    TicketResolutionPlan?
  createdBy         User?                @relation("TicketsCreatedBy")
}
```

**Propósito:**
- `createdById`: Saber quién creó el ticket (admin en nombre del cliente)
- `closedAt`: Tracking de cuándo se cerró
- `firstResponseAt`: Medir tiempo de primera respuesta
- `slaDeadline`: Gestión de SLA
- `estimatedTime/actualTime`: Métricas de tiempo
- `tags`: Búsqueda y categorización flexible
- `source`: Origen del ticket (web, email, admin, etc.)

---

### 2. Nuevo Modelo: TicketResolutionPlan

```prisma
model TicketResolutionPlan {
  id                String                    @id
  ticketId          String                    @unique
  title             String
  description       String?
  diagnosis         String?                   // Diagnóstico del problema
  solution          String?                   // Solución final
  estimatedTime     Int?
  actualTime        Int?
  startedAt         DateTime?
  completedAt       DateTime?
  status            ResolutionStatus
  tasks             TicketResolutionTask[]
}
```

**Propósito:**
- Plan estructurado de resolución
- Diagnóstico documentado
- Solución final registrada
- Métricas de tiempo
- Relación con tareas

---

### 3. Nuevo Modelo: TicketResolutionTask

```prisma
model TicketResolutionTask {
  id          String               @id
  planId      String
  title       String
  description String?
  order       Int                  // Orden de ejecución
  status      TaskStatus
  startedAt   DateTime?
  completedAt DateTime?
  notes       String?              // Notas del técnico
}
```

**Propósito:**
- Tareas individuales del plan
- Orden de ejecución
- Estado independiente
- Notas por tarea
- Tracking de tiempo

---

### 4. Nuevos Enums

```prisma
enum TicketSource {
  WEB           // Desde la interfaz web
  EMAIL         // Desde email
  PHONE         // Desde llamada
  CHAT          // Desde chat
  API           // Desde API
  ADMIN         // Admin en nombre del cliente
}

enum ResolutionStatus {
  PENDING       // Plan creado
  IN_PROGRESS   // Trabajando
  COMPLETED     // Terminado
  CANCELLED     // Cancelado
}

enum TaskStatus {
  PENDING       // Por hacer
  IN_PROGRESS   // Haciendo
  COMPLETED     // Hecho
  SKIPPED       // Omitido
}
```

---

## 🚀 EJECUTAR MIGRACIÓN

### Paso 1: Generar Migración
```bash
cd sistema-tickets-nextjs
npx prisma migrate dev --name add_resolution_plan_and_tracking
```

### Paso 2: Aplicar Migración
```bash
npx prisma migrate deploy
```

### Paso 3: Generar Cliente Prisma
```bash
npx prisma generate
```

### Paso 4: Verificar
```bash
npx prisma studio
```

---

## 📊 BENEFICIOS DE LOS CAMBIOS

### Para el Cliente:
✅ Ver plan de resolución del técnico
✅ Ver progreso de las tareas
✅ Entender qué se está haciendo
✅ Transparencia total

### Para el Técnico:
✅ Crear plan estructurado
✅ Dividir trabajo en tareas
✅ Tracking de progreso
✅ Documentar solución

### Para el Admin:
✅ Crear tickets en nombre de clientes
✅ Tracking de quién creó qué
✅ Métricas de SLA
✅ Reportes de tiempo
✅ Análisis de fuentes

---

## 🔄 DATOS EXISTENTES

Los tickets existentes:
- ✅ Seguirán funcionando
- ✅ Campos nuevos serán NULL/default
- ✅ No se pierde información
- ✅ Compatible con versión anterior

---

## 📝 NOTAS IMPORTANTES

1. **Backup:** Haz backup antes de migrar
2. **Contenedores:** La migración se aplica al contenedor de PostgreSQL
3. **Downtime:** Migración toma ~30 segundos
4. **Reversible:** Puedes hacer rollback si es necesario

---

**Estado:** ✅ LISTO PARA APLICAR
