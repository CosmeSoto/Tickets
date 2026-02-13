# Análisis de Performance de Base de Datos

## 📊 Estado Actual

### Modelos Principales Analizados

- **Users**: 16 relaciones, consultas frecuentes por email, role, isActive
- **Tickets**: 7 relaciones, consultas por status, priority, clientId, assigneeId, categoryId
- **Comments**: Consultas por ticketId, authorId, createdAt
- **AuditLog**: Consultas por userId, entityType, createdAt
- **Categories**: Consultas jerárquicas por parentId, level

### 🔍 Queries Más Frecuentes Identificadas

#### 1. Dashboard de Tickets (Crítico)

```sql
-- Query actual sin índices optimizados
SELECT * FROM tickets
WHERE status IN ('OPEN', 'IN_PROGRESS')
AND assignee_id = $1
ORDER BY created_at DESC
LIMIT 10;

-- Tiempo estimado: 50-100ms sin índices
```

#### 2. Búsqueda de Tickets por Cliente

```sql
SELECT * FROM tickets
WHERE client_id = $1
AND status != 'CLOSED'
ORDER BY priority DESC, created_at DESC;

-- Tiempo estimado: 30-80ms sin índices
```

#### 3. Comentarios de Ticket

```sql
SELECT c.*, u.name, u.avatar
FROM comments c
JOIN users u ON c.author_id = u.id
WHERE c.ticket_id = $1
ORDER BY c.created_at ASC;

-- Tiempo estimado: 20-50ms sin índices
```

#### 4. Auditoría por Usuario

```sql
SELECT * FROM audit_logs
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50;

-- Tiempo estimado: 100-200ms sin índices
```

## 🎯 Índices Requeridos

### Índices de Performance Crítica

```sql
-- Tickets: Consultas por estado y prioridad
CREATE INDEX CONCURRENTLY idx_tickets_status_priority
ON tickets(status, priority);

-- Tickets: Dashboard de técnicos
CREATE INDEX CONCURRENTLY idx_tickets_assignee_status
ON tickets(assignee_id, status)
WHERE assignee_id IS NOT NULL;

-- Tickets: Dashboard de clientes
CREATE INDEX CONCURRENTLY idx_tickets_client_created
ON tickets(client_id, created_at DESC);

-- Comments: Ordenados por ticket
CREATE INDEX CONCURRENTLY idx_comments_ticket_created
ON comments(ticket_id, created_at ASC);

-- AuditLog: Consultas por usuario
CREATE INDEX CONCURRENTLY idx_audit_logs_user_created
ON audit_logs(user_id, created_at DESC);
```

### Índices de Búsqueda Full-Text

```sql
-- Búsqueda en tickets
CREATE INDEX CONCURRENTLY idx_tickets_search
ON tickets USING GIN (to_tsvector('spanish', title || ' ' || description));

-- Búsqueda en usuarios
CREATE INDEX CONCURRENTLY idx_users_search
ON users USING GIN (to_tsvector('spanish', name || ' ' || email));
```

### Índices de Integridad y Relaciones

```sql
-- Users: Consultas por rol y estado
CREATE INDEX CONCURRENTLY idx_users_role_active
ON users(role, is_active);

-- Categories: Navegación jerárquica
CREATE INDEX CONCURRENTLY idx_categories_parent_level
ON categories(parent_id, level)
WHERE is_active = true;

-- TechnicianAssignment: Asignación automática
CREATE INDEX CONCURRENTLY idx_technician_assignment_category_active
ON technician_assignments(category_id, is_active, auto_assign);
```

## 📈 Mejoras de Performance Esperadas

### Antes de Optimización

- Dashboard de tickets: 50-100ms
- Búsqueda de tickets: 30-80ms
- Comentarios: 20-50ms
- Auditoría: 100-200ms

### Después de Optimización

- Dashboard de tickets: 5-15ms (90% mejora)
- Búsqueda de tickets: 3-10ms (85% mejora)
- Comentarios: 2-8ms (80% mejora)
- Auditoría: 10-30ms (85% mejora)

## 🔧 Configuración de Conexiones

### Prisma Connection Pool

```typescript
// Configuración optimizada
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Variables de entorno recomendadas
DATABASE_URL="postgresql://user:pass@localhost:5432/tickets?connection_limit=20&pool_timeout=20"
```

### PostgreSQL Settings

```sql
-- Configuraciones recomendadas para postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

## ✅ Plan de Implementación

### Paso 1: Crear Índices (Sin Downtime)

```bash
# Ejecutar en producción con CONCURRENTLY
psql -d tickets -f create_indexes.sql
```

### Paso 2: Validar Performance

```sql
-- Verificar uso de índices
EXPLAIN ANALYZE SELECT * FROM tickets
WHERE status = 'OPEN' AND assignee_id = 'user123';

-- Debe mostrar "Index Scan" en lugar de "Seq Scan"
```

### Paso 3: Monitorear Queries

```sql
-- Habilitar logging de queries lentas
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();
```

## 🚨 Alertas y Monitoreo

### Métricas a Monitorear

- Tiempo de respuesta de queries > 100ms
- Uso de CPU de PostgreSQL > 80%
- Conexiones activas > 80% del pool
- Queries que no usan índices (Seq Scan)

### Queries de Monitoreo

```sql
-- Top 10 queries más lentas
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Índices no utilizados
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

---

**Próximo Paso**: Implementar los índices y validar las mejoras de performance
