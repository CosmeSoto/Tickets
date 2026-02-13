# Auditoría Completa - Módulo de Tickets

## Fecha: 5 de Febrero de 2026

## 🎯 Objetivo
Auditar el módulo de tickets para asegurar:
- ✅ Simetría visual entre roles (Admin, Técnico, Cliente)
- ✅ Datos reales de la base de datos
- ✅ Lógica de negocio correcta
- ✅ Relaciones con otros módulos (Base de Conocimientos, Métricas)
- ✅ Funcionalidades según rol: Historial, Plan de Resolución, Calificación, Archivos
- ✅ Sin redundancias ni duplicidades

---

## 📊 Análisis de Páginas de Listado

### ✅ ADMIN - `/admin/tickets/page.tsx`
**Estado**: CORRECTO - Sigue el patrón estándar

**Características**:
- ✅ Usa `useModuleData` para cargar TODOS los tickets UNA VEZ
- ✅ Filtrado en memoria con `useMemo`
- ✅ Paginación local (20 por página)
- ✅ Estadísticas calculadas en memoria
- ✅ Filtros: búsqueda, estado, prioridad, categoría, asignado
- ✅ DataTable con columnas específicas de admin
- ✅ Botón "Crear Ticket"

**Métricas Mostradas**:
- Total tickets
- Abiertos
- En progreso
- Resueltos
- Cerrados
- Alta prioridad
- Creados hoy
- Sin asignar

**Problemas Detectados**:
1. ❌ Usa `TicketStatsPanel` en lugar de `SymmetricStatsCard` (inconsistencia visual)
2. ❌ Usa `ticketColumns` en lugar de función factory `createTicketColumns()`
3. ❌ Filtro de búsqueda usa `ticket.client?.name` pero debería ser `ticket.users_tickets_clientIdTousers?.name`
4. ❌ Filtro de categoría usa `ticket.category?.id` pero debería ser `ticket.categories?.id`
5. ❌ Filtro de asignado usa `ticket.assignee?.id` pero debería ser `ticket.users_tickets_assigneeIdTousers?.id`

---

### ✅ TECHNICIAN - `/technician/tickets/page.tsx`
**Estado**: CORRECTO - Sigue el patrón estándar

**Características**:
- ✅ Usa `useModuleData` para cargar TODOS los tickets UNA VEZ
- ✅ Filtrado en memoria con `useMemo`
- ✅ Filtra solo tickets asignados al técnico (`ticket.assigneeId === technicianId`)
- ✅ Paginación local (20 por página)
- ✅ Estadísticas calculadas en memoria
- ✅ Filtros: búsqueda, estado, prioridad, categoría, fecha
- ✅ DataTable con columnas específicas de técnico
- ✅ Usa `SymmetricStatsCard` con tema TECHNICIAN

**Métricas Mostradas**:
- Abiertos
- En progreso
- Resueltos hoy
- Tiempo promedio de resolución

**Problemas Detectados**:
1. ❌ Usa `technicianTicketColumns` en lugar de función factory
2. ❌ Filtro de búsqueda usa `ticket.createdBy?.name` pero debería ser `ticket.users_tickets_createdByIdTousers?.name`
3. ❌ Filtro de categoría usa `ticket.categoryId` en lugar de `ticket.categories?.id`

---

### ✅ CLIENT - `/client/tickets/page.tsx`
**Estado**: CORRECTO - Sigue el patrón estándar

**Características**:
- ✅ Usa `useModuleData` para cargar TODOS los tickets UNA VEZ
- ✅ Filtrado en memoria con `useMemo`
- ✅ Filtra solo tickets del cliente (`ticket.createdById === clientId`)
- ✅ Paginación local (20 por página)
- ✅ Estadísticas calculadas en memoria
- ✅ Filtros: búsqueda, estado, prioridad, categoría, fecha
- ✅ DataTable con columnas específicas de cliente
- ✅ Usa `SymmetricStatsCard` con tema CLIENT
- ✅ Botón "Crear Ticket"

**Métricas Mostradas**:
- Total tickets
- Abiertos
- En progreso
- Resueltos

**Problemas Detectados**:
1. ❌ Usa `clientTicketColumns` en lugar de función factory
2. ❌ Filtro de búsqueda usa `ticket.assignee?.name` pero debería ser `ticket.users_tickets_assigneeIdTousers?.name`
3. ❌ Filtro de categoría usa `ticket.categoryId` en lugar de `ticket.categories?.id`

---

## 📋 Análisis de Páginas de Detalle

### Funcionalidades Requeridas por Rol

#### ADMIN - `/admin/tickets/[id]/page.tsx`
**Debe incluir**:
- ✅ Información completa del ticket
- ✅ Historial de cambios (ticket_history)
- ✅ Plan de Resolución (ticket_resolution_plans)
- ✅ Calificación (ticket_ratings)
- ✅ Archivos adjuntos (attachments)
- ✅ Comentarios (comments)
- ✅ Cambiar estado
- ✅ Reasignar técnico
- ✅ Cambiar prioridad
- ✅ Editar ticket
- ✅ Eliminar ticket
- ✅ Ver artículos relacionados de base de conocimientos

#### TECHNICIAN - `/technician/tickets/[id]/page.tsx`
**Debe incluir**:
- ✅ Información completa del ticket
- ✅ Historial de cambios (ticket_history)
- ✅ Plan de Resolución (ticket_resolution_plans) - CREAR/EDITAR
- ✅ Calificación (ticket_ratings) - SOLO VER
- ✅ Archivos adjuntos (attachments) - SUBIR/VER
- ✅ Comentarios (comments) - CREAR/VER
- ✅ Cambiar estado (OPEN → IN_PROGRESS → RESOLVED)
- ✅ Crear artículo de base de conocimientos desde ticket resuelto
- ✅ Ver artículos relacionados de base de conocimientos

#### CLIENT - `/client/tickets/[id]/page.tsx`
**Debe incluir**:
- ✅ Información del ticket
- ✅ Calificación (ticket_ratings) - CREAR cuando está RESOLVED
- ✅ Archivos adjuntos (attachments) - SUBIR/VER
- ✅ Comentarios (comments) - CREAR/VER
- ✅ Ver artículos relacionados de base de conocimientos
- ❌ NO debe ver: Historial interno, Plan de Resolución

---

## 🔍 Análisis de Relaciones con Base de Datos

### Modelo `tickets` - Relaciones Prisma

```prisma
model tickets {
  // Relaciones
  attachments                      attachments[]
  comments                         comments[]
  notifications                    notifications[]
  ticket_history                   ticket_history[]
  ticket_ratings                   ticket_ratings?
  ticket_resolution_plans          ticket_resolution_plans?
  knowledge_article                knowledge_articles?      @relation("knowledge_articles_source")
  
  // Relaciones con usuarios (nombres largos por Prisma)
  users_tickets_assigneeIdTousers  users?                   @relation("tickets_assigneeIdTousers")
  categories                       categories               @relation(fields: [categoryId])
  users_tickets_clientIdTousers    users                    @relation("tickets_clientIdTousers")
  users_tickets_createdByIdTousers users?                   @relation("tickets_createdByIdTousers")
}
```

### Problemas de Nomenclatura Detectados

En el código actual se usan nombres incorrectos:
- ❌ `ticket.client` → ✅ `ticket.users_tickets_clientIdTousers`
- ❌ `ticket.assignee` → ✅ `ticket.users_tickets_assigneeIdTousers`
- ❌ `ticket.createdBy` → ✅ `ticket.users_tickets_createdByIdTousers`
- ❌ `ticket.category` → ✅ `ticket.categories`

---

## 🎨 Análisis de Simetría Visual

### Tarjetas de Métricas

#### ✅ CORRECTO (Técnico y Cliente)
```typescript
<SymmetricStatsCard
  title="Abiertos"
  value={stats.open}
  icon={AlertCircle}
  color="orange"
  role="TECHNICIAN" // o "CLIENT"
  badge={...}
  status={...}
/>
```

#### ❌ INCORRECTO (Admin)
```typescript
<TicketStatsPanel stats={stats} loading={loading} />
```

**Solución**: Reemplazar `TicketStatsPanel` por 4 `SymmetricStatsCard` con `role="ADMIN"`

---

## 📦 Análisis de Componentes

### Columnas de DataTable

#### Patrón Correcto (como Técnicos)
```typescript
// En: src/components/admin/technicians/tables/technician-columns.tsx
export function createTechnicianColumns({
  onEdit,
  onDelete,
  onDemote,
  onViewAssignments
}: TechnicianColumnsProps): Column<Technician>[] {
  return [...]
}

// Uso:
columns={createTechnicianColumns({
  onEdit: handleEdit,
  onDelete: setDeletingTechnician,
  ...
})}
```

#### Patrón Actual (Tickets)
```typescript
// ❌ Exportación directa sin callbacks
export const ticketColumns = [...]

// Uso:
columns={ticketColumns}
```

**Problema**: No permite pasar callbacks para acciones (onView, onEdit, onAssign, etc.)

**Solución**: Crear funciones factory:
- `createAdminTicketColumns()`
- `createTechnicianTicketColumns()`
- `createClientTicketColumns()`

---

## 🔗 Análisis de Relaciones con Otros Módulos

### Base de Conocimientos

#### Relación en BD
```prisma
model tickets {
  knowledge_article  knowledge_articles?  @relation("knowledge_articles_source")
}

model knowledge_articles {
  sourceTicketId  String?
  sourceTicket    tickets?  @relation("knowledge_articles_source", fields: [sourceTicketId])
}
```

#### Funcionalidades Requeridas

1. **En detalle de ticket RESOLVED (Técnico/Admin)**:
   - Botón "Crear Artículo de Conocimiento"
   - Pre-llenar con información del ticket
   - Sugerir artículos similares existentes

2. **En detalle de ticket (Todos los roles)**:
   - Mostrar artículos relacionados por categoría/tags
   - Enlace a base de conocimientos

3. **En listado de artículos**:
   - Mostrar si fue creado desde un ticket
   - Enlace al ticket original

---

## 📝 Plan de Correcciones

### Prioridad ALTA

1. **Corregir nombres de relaciones Prisma**
   - Actualizar todos los filtros en las 3 páginas de listado
   - Actualizar páginas de detalle
   - Actualizar componentes de columnas

2. **Unificar tarjetas de métricas**
   - Reemplazar `TicketStatsPanel` por `SymmetricStatsCard` en Admin
   - Asegurar mismo diseño en los 3 roles

3. **Crear funciones factory para columnas**
   - `createAdminTicketColumns()`
   - `createTechnicianTicketColumns()`
   - `createClientTicketColumns()`

### Prioridad MEDIA

4. **Completar páginas de detalle**
   - Verificar que incluyan todas las secciones según rol
   - Historial de cambios
   - Plan de Resolución
   - Calificación
   - Archivos adjuntos

5. **Integración con Base de Conocimientos**
   - Botón crear artículo desde ticket resuelto
   - Artículos relacionados en detalle
   - Sugerencias al crear ticket

### Prioridad BAJA

6. **Optimizaciones**
   - Verificar que no haya llamadas API redundantes
   - Asegurar que filtros usen debounce
   - Verificar paginación correcta

---

## 📊 Resumen de Hallazgos

### ✅ Aspectos Positivos
- Patrón de carga de datos correcto (useModuleData)
- Filtrado en memoria eficiente
- Paginación local implementada
- Estructura modular y organizada
- Separación por roles clara

### ❌ Problemas Encontrados
- **12 referencias incorrectas** a relaciones de Prisma
- **1 componente inconsistente** (TicketStatsPanel vs SymmetricStatsCard)
- **3 archivos de columnas** sin patrón factory
- **Funcionalidades faltantes** en páginas de detalle
- **Integración incompleta** con base de conocimientos

### 📈 Impacto
- **Errores de compilación**: Probable (relaciones incorrectas)
- **Errores en runtime**: Seguro (propiedades undefined)
- **Inconsistencia visual**: Confirmada (diferentes componentes de métricas)
- **Funcionalidad incompleta**: Confirmada (falta historial, plan, etc.)

---

## 🚀 Siguiente Paso

Comenzar con las correcciones de **Prioridad ALTA**:
1. Corregir relaciones de Prisma en filtros
2. Unificar componentes de métricas
3. Crear funciones factory para columnas

¿Procedo con las correcciones?
