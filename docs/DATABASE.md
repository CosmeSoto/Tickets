# Base de Datos - Documentación

## 📊 Esquema de Base de Datos

El sistema utiliza PostgreSQL 15 con Prisma ORM para la gestión de la base de datos.

## 🗄️ Tablas Principales

### Usuarios y Autenticación
- **users**: Usuarios del sistema (Admin, Técnico, Cliente)
- **accounts**: Cuentas OAuth (NextAuth)
- **sessions**: Sesiones activas
- **verification_tokens**: Tokens de verificación de email
- **password_reset_tokens**: Tokens de recuperación de contraseña
- **oauth_accounts**: Cuentas OAuth vinculadas
- **oauth_configs**: Configuración de proveedores OAuth

### Tickets
- **tickets**: Tickets de soporte
- **comments**: Comentarios en tickets
- **attachments**: Archivos adjuntos
- **ticket_history**: Historial de cambios
- **ticket_ratings**: Calificaciones de tickets
- **ticket_resolution_plans**: Planes de resolución
- **ticket_resolution_tasks**: Tareas de resolución

### Categorías y Departamentos
- **categories**: Categorías jerárquicas (hasta 3 niveles)
- **departments**: Departamentos organizacionales
- **technician_assignments**: Asignación de técnicos a categorías

### SLA (Service Level Agreement)
- **sla_policies**: Políticas de SLA por prioridad
- **ticket_sla_metrics**: Métricas de SLA por ticket
- **sla_violations**: Violaciones de SLA

### Notificaciones
- **notifications**: Notificaciones in-app
- **notification_preferences**: Preferencias de notificación por usuario
- **email_queue**: Cola de emails para envío asíncrono

### Base de Conocimientos
- **knowledge_articles**: Artículos de la base de conocimientos
- **article_votes**: Votos de utilidad en artículos
- **ticket_knowledge_articles**: Vinculación tickets-artículos

### Webhooks
- **webhooks**: Configuración de webhooks
- **webhook_logs**: Logs de ejecución de webhooks

### Configuración
- **site_config**: Configuración del sitio
- **system_settings**: Configuración del sistema
- **user_settings**: Configuración por usuario
- **user_preferences**: Preferencias por usuario

### Auditoría y Backups
- **audit_logs**: Registro de auditoría
- **backups**: Registro de backups

### CMS Landing Page
- **pages**: Páginas del CMS
- **category_analytics**: Analíticas de categorías

## 🔄 Migraciones

### Migraciones Oficiales

Las migraciones están en `prisma/migrations/` con timestamps:

1. **20260119211904_init**: Migración inicial
2. **20260120204801_add_oauth_config**: Configuración OAuth
3. **20260205165757_add_knowledge_base**: Base de conocimientos
4. **20260205215644_add_resolution_plan_relations**: Planes de resolución
5. **20260218215734_add_notification_preferences**: Preferencias de notificación
6. **20260303194317_add_task_time_fields**: Campos de tiempo en tareas
7. **20260305201140_add_category_analytics_table**: Analíticas de categorías
8. **20260311194519_add_landing_page_cms**: CMS para landing page
9. **20260311212324_update_landing_cms_buttons_remove_colors**: Actualización CMS

### Aplicar Migraciones

```bash
# Con Docker
docker-compose exec app npx prisma migrate deploy

# Local
npx prisma migrate deploy
```

### Crear Nueva Migración

```bash
# Con Docker
docker-compose exec app npx prisma migrate dev --name nombre_migracion

# Local
npx prisma migrate dev --name nombre_migracion
```

### Resetear Base de Datos

⚠️ **Esto eliminará todos los datos**

```bash
# Con Docker
docker-compose exec app npx prisma migrate reset

# Local
npx prisma migrate reset
```

## 🌱 Seed (Datos Iniciales)

El seed crea:

1. **Departamento por defecto**: "Soporte Técnico"
2. **Usuario administrador**:
   - Email: internet.freecom@gmail.com
   - Contraseña: admin123
   - Rol: ADMIN
3. **Preferencias de notificación** para el admin
4. **Configuración del sitio**:
   - Nombre del sitio
   - Email de soporte
   - Límites de archivos
   - Tipos de archivo permitidos
5. **Políticas de SLA** (4 políticas):
   - URGENT: Respuesta 1h, Resolución 4h (24/7)
   - HIGH: Respuesta 4h, Resolución 24h (Laboral)
   - MEDIUM: Respuesta 8h, Resolución 48h (Laboral)
   - LOW: Respuesta 24h, Resolución 72h (Laboral)

### Ejecutar Seed

```bash
# Con Docker
docker-compose exec app npx prisma db seed

# Local
npx prisma db seed
```

### Verificar Seed

```bash
# Con Docker
docker-compose exec app node scripts/verify-seed.js

# Local
node scripts/verify-seed.js
```

## 🔍 Consultas Útiles

### Ver Usuarios

```sql
SELECT id, email, name, role, "isActive", "createdAt"
FROM users
ORDER BY "createdAt" DESC;
```

### Ver Tickets

```sql
SELECT 
  t.id,
  t.title,
  t.status,
  t.priority,
  u.name as client_name,
  c.name as category_name,
  t."createdAt"
FROM tickets t
JOIN users u ON t."clientId" = u.id
JOIN categories c ON t."categoryId" = c.id
ORDER BY t."createdAt" DESC
LIMIT 10;
```

### Ver Métricas de SLA

```sql
SELECT 
  t.id,
  t.title,
  t.priority,
  tsm."responseDeadline",
  tsm."resolutionDeadline",
  tsm."responseSLAMet",
  tsm."resolutionSLAMet"
FROM tickets t
JOIN ticket_sla_metrics tsm ON t.id = tsm."ticketId"
WHERE tsm."resolvedAt" IS NULL
ORDER BY tsm."responseDeadline" ASC;
```

### Ver Violaciones de SLA

```sql
SELECT 
  sv.id,
  t.title,
  sv."violationType",
  sv."expectedAt",
  sv."actualAt",
  sv.severity,
  sv."isResolved"
FROM sla_violations sv
JOIN tickets t ON sv."ticketId" = t.id
WHERE sv."isResolved" = false
ORDER BY sv."createdAt" DESC;
```

## 💾 Backup y Restauración

### Crear Backup

```bash
# Backup completo
docker-compose exec postgres pg_dump -U tickets_user tickets_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup solo schema
docker-compose exec postgres pg_dump -U tickets_user --schema-only tickets_db > schema_backup.sql

# Backup solo datos
docker-compose exec postgres pg_dump -U tickets_user --data-only tickets_db > data_backup.sql
```

### Restaurar Backup

```bash
# Restaurar completo
docker-compose exec -T postgres psql -U tickets_user tickets_db < backup.sql

# Restaurar solo schema
docker-compose exec -T postgres psql -U tickets_user tickets_db < schema_backup.sql

# Restaurar solo datos
docker-compose exec -T postgres psql -U tickets_user tickets_db < data_backup.sql
```

### Backup Automático

Crea un cron job para backups diarios:

```bash
# Editar crontab
crontab -e

# Agregar backup diario a las 2 AM
0 2 * * * cd /ruta/proyecto && docker-compose exec -T postgres pg_dump -U tickets_user tickets_db | gzip > /backups/tickets_$(date +\%Y\%m\%d).sql.gz
```

## 🔧 Mantenimiento

### Actualizar Estadísticas

```sql
ANALYZE;
```

### Vacuum

```sql
VACUUM ANALYZE;
```

### Ver Tamaño de Tablas

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Ver Índices

```sql
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## 🚨 Troubleshooting

### Conexión Rechazada

```bash
# Verificar que PostgreSQL esté corriendo
docker-compose ps postgres

# Ver logs
docker-compose logs postgres

# Reiniciar
docker-compose restart postgres
```

### Migraciones Pendientes

```bash
# Ver estado
docker-compose exec app npx prisma migrate status

# Aplicar pendientes
docker-compose exec app npx prisma migrate deploy
```

### Error de Schema

```bash
# Regenerar cliente de Prisma
docker-compose exec app npx prisma generate

# Reiniciar app
docker-compose restart app
```

### Base de Datos Corrupta

```bash
# Resetear (⚠️ borra datos)
docker-compose exec app npx prisma migrate reset

# O eliminar volumen y empezar de nuevo
docker-compose down -v
docker-compose up -d
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma db seed
```

## 📚 Recursos

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)

## 🔐 Seguridad

### Credenciales

Las credenciales de la base de datos están en `.env`:

```env
DATABASE_URL="postgresql://tickets_user:tickets_pass@postgres:5432/tickets_db"
```

⚠️ **Importante**: Cambia la contraseña en producción.

### Conexiones

- Puerto 5432 NO debe estar expuesto públicamente
- Solo la aplicación debe tener acceso a la base de datos
- Usa SSL/TLS en producción

### Backups

- Encripta los backups en producción
- Almacena backups en ubicación segura
- Prueba la restauración regularmente

## 📊 Índices de Rendimiento

El sistema incluye índices optimizados para:

- Búsquedas de texto completo (GIN indexes)
- Consultas frecuentes (índices compuestos)
- Filtros por estado y prioridad
- Ordenamiento por fecha
- Búsquedas por usuario
- Métricas de SLA

Ver detalles en `prisma/schema.prisma`.
