# Guía de Despliegue y Mantenimiento

## Comandos Rápidos

### Desarrollo (todo en Docker)

```bash
# Reconstruir desde cero (borra datos):
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up --build

# Reconstruir solo la app (limpiando caché de Next.js):
docker compose -f docker-compose.dev.yml down app
docker volume rm $(docker volume ls -q | grep dev_next_cache) 2>/dev/null || true
docker compose -f docker-compose.dev.yml up -d --build app

# Reconstruir solo Redis:
docker compose -f docker-compose.dev.yml up -d --build redis

# Levantar sin reconstruir:
docker compose -f docker-compose.dev.yml up -d

# Reiniciar servicios:
docker compose -f docker-compose.dev.yml restart app
docker compose -f docker-compose.dev.yml restart redis

# Ver logs de la app:
docker compose -f docker-compose.dev.yml logs -f app

# Ver logs de Redis:
docker compose -f docker-compose.dev.yml logs -f redis

# Ver logs de todos los servicios:
docker compose -f docker-compose.dev.yml logs -f

# Ver estado de los contenedores:
docker compose -f docker-compose.dev.yml ps

# Entrar al contenedor de la app:
docker compose -f docker-compose.dev.yml exec app sh

# Entrar al contenedor de Redis:
docker compose -f docker-compose.dev.yml exec redis sh

# Detener servicios:
docker compose -f docker-compose.dev.yml down

# Detener manteniendo contenedores:
docker compose -f docker-compose.dev.yml stop

# Volver a iniciar contenedores detenidos:
docker compose -f docker-compose.dev.yml start

# Eliminar contenedores huérfanos:
docker compose -f docker-compose.dev.yml down --remove-orphans

# Destruir todo (⚠️ BORRA DATOS):
docker compose -f docker-compose.dev.yml down -v

# Si usas .env.development, mantén simetría con producción:
docker compose -f docker-compose.dev.yml --env-file .env.development up -d
docker compose -f docker-compose.dev.yml --env-file .env.development up -d --build app
docker compose -f docker-compose.dev.yml --env-file .env.development logs -f app
```

### Desarrollo (solo BD + Redis, app en host)

```bash
docker compose up -d
npm run dev
# → http://localhost:3000
```

### Producción

```bash
# ═══════════════════════════════════════════════════════════════════════════════
# PRIMERA VEZ o cuando algo está roto (rebuild total ~5-10 min):
# ═══════════════════════════════════════════════════════════════════════════════
sudo ./start-production.sh --clean

# ═══════════════════════════════════════════════════════════════════════════════
# DESPUÉS DE HACER CAMBIOS DE CÓDIGO (rebuild incremental ~2-3 min):
# Solo recompila lo que cambió. NO borra datos ni volúmenes.
# ═══════════════════════════════════════════════════════════════════════════════
sudo ./start-production.sh

# Al arrancar, el entrypoint verifica catálogos de inventario (marcas, tipos, bodegas)
# y ejecuta ensure-catalogs automáticamente si faltan — no hace falta correr seed a mano.

# ═══════════════════════════════════════════════════════════════════════════════
# COMANDOS MANUALES (si prefieres no usar el script):
# ═══════════════════════════════════════════════════════════════════════════════

# Aplicar cambios de código (rebuild incremental, NO borra datos):
docker compose -f docker-compose.prod.yml --env-file .env.production build app
docker compose -f docker-compose.prod.yml --env-file .env.production up -d app

# Rebuild total sin caché (si lo anterior no refleja cambios):
docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache app
docker compose -f docker-compose.prod.yml --env-file .env.production up -d app

# Reconstruir desde cero (⚠️ BORRA DATOS de BD, Redis, uploads):
docker compose -f docker-compose.prod.yml --env-file .env.production down -v
sudo ./start-production.sh --clean

# Reconstruir solo Redis:
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build redis

# Levantar sin reconstruir (si solo se reinició el servidor):
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Reiniciar servicios (sin reconstruir):
docker compose -f docker-compose.prod.yml --env-file .env.production restart app
docker compose -f docker-compose.prod.yml --env-file .env.production restart redis

# Ver logs de la app:
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app

# Ver logs de Redis:
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f redis

# Ver logs de todos los servicios:
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f

# Ver estado de los contenedores:
docker compose -f docker-compose.prod.yml --env-file .env.production ps

# Entrar al contenedor de la app:
docker compose -f docker-compose.prod.yml --env-file .env.production exec app sh

# Entrar al contenedor de Redis:
docker compose -f docker-compose.prod.yml --env-file .env.production exec redis sh

# Detener servicios:
docker compose -f docker-compose.prod.yml --env-file .env.production down

# Detener manteniendo contenedores:
docker compose -f docker-compose.prod.yml --env-file .env.production stop

# Volver a iniciar contenedores detenidos:
docker compose -f docker-compose.prod.yml --env-file .env.production start

# Eliminar contenedores huérfanos:
docker compose -f docker-compose.prod.yml --env-file .env.production down --remove-orphans

# Destruir todo (⚠️ BORRA DATOS):
docker compose -f docker-compose.prod.yml --env-file .env.production down -v
```

---

## Cambios de Schema Pendientes de Aplicar

Al reconstruir contenedores, `entrypoint.sh` ejecuta `prisma db push` automáticamente.
Los siguientes cambios se aplican solos al hacer el próximo rebuild:

| Campo | Tabla | Tipo | Descripción |
|-------|-------|------|-------------|
| `custom_values` | `software_licenses` | `Json?` | Atributos personalizados de tipos de licencia |

Si necesitas aplicarlo manualmente sin reconstruir:

```bash
# En producción (SSH):
docker compose -f docker-compose.prod.yml --env-file .env.production exec app \
  node ./node_modules/prisma/build/index.js db push --accept-data-loss
```

---

## Nuevas Funcionalidades (Fase 6+)

### Transferencia de activos entre áreas

Permite a admins con acceso a ambas familias reasignar un equipo, licencia o MRO de un área a otra. Accesible desde:

- **Equipos** → Menú "⋯" → "Transferir a otra área"
- **Licencias** → Ficha de detalle → botón "Transferir área"
- **MRO** → Ficha de detalle → botón "Transferir área"

Reglas:
- Equipo con asignación activa: bloqueado
- Atributos compatibles se conservan, los incompatibles se muestran en preview
- Queda registrado en el historial del equipo y en `audit_logs`

### Copiar tipos entre áreas

Desde `Configuración → Área → Catálogos`, cada tipo de equipo/licencia/consumible tiene un botón **"Copiar a área"** (ícono de copia azul).

Selecciona el área destino, nombre opcional y si copiar los atributos personalizados. El tipo se crea en la familia destino sin afectar el origen.

---



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

# Cargar seeder completo (BD vacía o reset):
sudo docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts'

# Solo catálogos de inventario (marcas, tipos, bodegas) — si ya hay usuarios pero catálogos vacíos:
sudo docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-catalogs.ts'
# o localmente: npm run db:seed-catalogs
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
| Inventario | Ve sus equipos / Gestor\* | Gestor\*                             | Gestiona de sus familias de inventario            | Todo        |
| Rondas     | Agente (ejecuta)          | Supervisor (gestiona + ejecuta)      | Ve reportes de sus familias                       | Todo        |

\*Gestor = `canManageInventory=true`

### Acciones de inventario por nivel

| Acción | Admin normal (con familia) | Super Admin |
|--------|---------------------------|-------------|
| Crear / editar equipo | ✅ | ✅ |
| Asignar equipo | ✅ | ✅ |
| **Devolver equipo a bodega** | ✅ | ✅ |
| Crear acta de devolución | ✅ | ✅ |
| Retirar equipo (baja) | ✅ | ✅ |
| Aprobar / rechazar bajas | ✅ (familias asignadas) | ✅ |
| Transferir activo entre áreas | ✅ (acceso a ambas familias) | ✅ |
| Copiar tipos entre áreas | ✅ | ✅ |
| **Eliminar equipo permanentemente** | ❌ | ✅ |
| **Eliminar actas** | ❌ | ✅ |

### Cómo se resuelve el scope de inventario para Admin normal

El sistema usa `inventory_manager_families` (no `admin_family_assignments`) para determinar qué familias puede gestionar un admin en el módulo de inventario. Si no tiene ninguna familia asignada en inventario, puede gestionar todas.

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

| Problema                                     | Solución                                                                                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App no arranca                               | `docker logs tickets-app` — verificar DATABASE_URL                                                                                                                                                   |
| No accede a gestion.local                    | Verificar `/etc/hosts` y que nginx esté corriendo                                                                                                                                                    |
| Certificado SSL no confiable                 | Aceptar excepción o instalar CA de mkcert en clientes                                                                                                                                                |
| **404 en `/api/admin/news` u otros módulos** | **Imagen Docker desactualizada.** Aplicar cambios con: `sudo ./start-production.sh`. Si persiste, reconstruir sin caché: `sudo ./start-production.sh --clean`. Los datos (BD, uploads) NO se borran. |
| Módulo carga vacío tras restaurar backup     | Igual que arriba — si se reconstruyó sin `start-production.sh`, el `NEXTAUTH_URL` puede quedar con dominio errado                                                                                    |
| Dashboard rondas vacío                       | Verificar que hay patrullas programadas para hoy (UTC-5)                                                                                                                                             |
| Técnico no aparece en categorías             | Verificar `technician_family_assignments` para esa familia                                                                                                                                           |
| Agente no aparece en programación            | Verificar `patrol_family_assignments` + `patrolsEnabled=true`                                                                                                                                        |

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
