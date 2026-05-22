# Guía de Despliegue y Mantenimiento

## Comandos Rápidos

### Desarrollo (todo en Docker)

```bash
# Reconstruir desde cero (borra datos):
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up --build

# Levantar sin reconstruir:
docker compose -f docker-compose.dev.yml up -d

# Ver logs:
docker compose -f docker-compose.dev.yml logs -f app

# Detener:
docker compose -f docker-compose.dev.yml down

# Resetear app:
docker compose -f docker-compose.dev.yml restart app
```

### Desarrollo (solo BD + Redis, app en host)

```bash
docker compose up -d
npm run dev
# → http://localhost:3000
```

### Producción

```bash
# Despliegue automático (detecta IP, genera certs, levanta):
sudo ./start-production.sh

# Reconstruir solo la app:
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build app

# Ver logs:
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app

# Detener:
docker compose -f docker-compose.prod.yml --env-file .env.production down

# Destruir todo (⚠️ BORRA DATOS):
docker compose -f docker-compose.prod.yml --env-file .env.production down -v
```

---

## Migraciones

### Desarrollo (Docker)

El contenedor ejecuta `prisma db push` automáticamente al iniciar — sincroniza el schema sin historial de migraciones.

```bash
# Asegúrate de que los contenedores estén corriendo::
docker-compose -f docker-compose.dev.yml up -d

# Ejecuta migraciones dentro del contenedor de la app:
docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev --name add_sla_to_asset_requests

# Si prefieres usar db push (solo para desarrollo, sin migraciones históricas):
docker-compose -f docker-compose.dev.yml exec app npx prisma db push
```

### Producción

El entrypoint ejecuta `prisma migrate deploy` automáticamente. Para crear una migración nueva:

```bash
# En tu máquina local con la BD corriendo:
npx prisma migrate dev --name nombre_del_cambio

# O dentro del contenedor de dev:
docker exec tickets-app-dev npx prisma migrate dev --name nombre_del_cambio
```

### Conectarse a la BD

```bash
# Dev:
docker exec -it tickets-postgres-dev psql -U tickets_user -d tickets_db

# Producción:
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres psql -U tickets_user -d tickets_db
```

---

## Backups

```bash
# Crear backup:
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres \
  pg_dump -U tickets_user tickets_db | gzip > backup-$(date +%Y%m%d).sql.gz

# Restaurar:
gunzip -c backup-YYYYMMDD.sql.gz | \
  docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  psql -U tickets_user -d tickets_db
```

---

## Acceso desde la Red

Cada equipo necesita en su archivo hosts (`/etc/hosts` o `C:\Windows\System32\drivers\etc\hosts`):

```
TU_IP    gestion.local www.gestion.local
```

Si cambia tu IP: ejecutar `sudo ./start-production.sh` y actualizar hosts en los clientes.

---

## Arquitectura de Servicios

```
┌─────────────────────────────────────────────────┐
│  Equipos de la red (navegadores)                │
│  → https://gestion.local                        │
└──────────────────────┬──────────────────────────┘
                       │ :443 (HTTPS)
┌──────────────────────▼──────────────────────────┐
│  nginx (tickets-nginx)                          │
│  - SSL termination (mkcert)                     │
│  - Proxy reverso → app:3000                     │
│  - Archivos estáticos (/uploads, /_next/static) │
└──────────────────────┬──────────────────────────┘
                       │ :3000
┌──────────────────────▼──────────────────────────┐
│  Next.js App (tickets-app)                      │
│  - API Routes                                   │
│  - Server-Side Rendering                        │
│  - Cron jobs (llamados externamente)            │
└───────┬──────────────────────────┬──────────────┘
        │ :5432                    │ :6379
┌───────▼───────┐          ┌──────▼───────┐
│  PostgreSQL   │          │    Redis     │
│  (datos)      │          │  (caché/SSE) │
└───────────────┘          └──────────────┘
```

---

## Arquitectura de Roles por Módulo

| Módulo     | Cliente                   | Técnico                              | Admin normal                                      | Super Admin |
| ---------- | ------------------------- | ------------------------------------ | ------------------------------------------------- | ----------- |
| Tickets    | Crea/sigue tickets        | Crea sus tickets / Atiende asignados | Crea propios y de su personal / Gestiona familias | Todo        |
| Inventario | Ve sus equipos / Gestor\* | Gestor\*                             | Gestiona de sus familias                          | Todo        |
| Rondas     | Agente (ejecuta)          | Supervisor (gestiona + ejecuta)      | Ve reportes de sus familias                       | Todo        |

\*Gestor = `canManageInventory=true`

### Asignación de familias por módulo (independientes)

| Módulo            | Tabla                           | Quién asigna        |
| ----------------- | ------------------------------- | ------------------- |
| Tickets (técnico) | `technician_family_assignments` | Admin / Super Admin |
| Tickets (cliente) | `client_family_assignments`     | Admin / Super Admin |
| Inventario        | `inventory_manager_families`    | Admin / Super Admin |
| Rondas            | `patrol_family_assignments`     | Admin / Super Admin |
| Scope de Admin    | `admin_family_assignments`      | Solo Super Admin    |

---

## Checklist de Verificación Post-Despliegue

### Tabla nueva requerida

```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'patrol_family_assignments';
```

### Módulo Usuarios

- [ ] Módulos visibles para todos los roles (excepto Super Admin que tiene todo)
- [ ] Activar módulo → aparece selector de familias para ese módulo
- [ ] Familias de cada módulo son independientes entre sí

### Módulo Tickets

- [ ] Técnico crea su propio ticket (no puede crear en nombre de otro)
- [ ] Admin crea ticket en nombre de otro → auditoría con `createdById`
- [ ] Selector de técnicos en categorías visible y funcional
- [ ] Técnicos filtrados por familia de la categoría

### Módulo Rondas

- [ ] Programación: solo TECHNICIAN/CLIENT como agentes (no ADMIN)
- [ ] Agentes filtrados por `patrol_family_assignments` de la familia
- [ ] No se puede iniciar ronda fuera del horario (±5 min configurable)
- [ ] Dashboard con datos reales (timezone Ecuador UTC-5)
- [ ] Dashboard filtrado por familias del usuario
- [ ] Reportes filtrados por familias accesibles
- [ ] Sección "Incidencias" en menú Rondas
- [ ] "Mis Rondas" visible para técnicos
- [ ] Incidencias se crean sin depender de ticketsEnabled
- [ ] Recordatorio 5 min antes (configurable en Configuración → Rondas)

### Navegación por rol

- [ ] CLIENT + rondas: "Mis Rondas" → Patrullas Activas
- [ ] TECHNICIAN + rondas: Dashboard, Mis Rondas, Incidencias, Checkpoints, Rutas, Programación, Reportes
- [ ] ADMIN + rondas: Dashboard, Incidencias, Checkpoints, Rutas, Programación, Reportes, Configuración
- [ ] Super Admin: todo sin restricción

---

## Solución de Problemas

| Problema                          | Solución                                                      |
| --------------------------------- | ------------------------------------------------------------- |
| App no arranca                    | `docker logs tickets-app` — verificar DATABASE_URL            |
| No accede a gestion.local         | Verificar `/etc/hosts` y que nginx esté corriendo             |
| Certificado SSL no confiable      | Aceptar excepción o instalar CA de mkcert en clientes         |
| Dashboard rondas vacío            | Verificar que hay patrullas programadas para hoy (UTC-5)      |
| Técnico no aparece en categorías  | Verificar `technician_family_assignments` para esa familia    |
| Agente no aparece en programación | Verificar `patrol_family_assignments` + `patrolsEnabled=true` |

---

## Archivos de Configuración

| Archivo                   | Propósito                                  |
| ------------------------- | ------------------------------------------ |
| `.env.local`              | Variables desarrollo (npm run dev)         |
| `.env.production`         | Variables producción (Docker)              |
| `docker-compose.yml`      | Solo postgres + redis (dev sin Docker)     |
| `docker-compose.dev.yml`  | Todo en Docker (desarrollo)                |
| `docker-compose.prod.yml` | Producción con nginx + SSL                 |
| `docker/entrypoint.sh`    | Migraciones + seed + arranque (producción) |
| `docker/nginx.local.conf` | Proxy reverso + SSL                        |
| `start-production.sh`     | Script automático de despliegue            |
