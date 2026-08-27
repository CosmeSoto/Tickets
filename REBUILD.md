# Guía de Despliegue y Mantenimiento

## Comandos Rápidos

### Desarrollo (todo en Docker)

```bash
# Reconstruir desde cero (borra datos):
./docker/scripts/reset-dev-from-scratch.sh

docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml down --remove-orphans
docker network prune -f
docker compose -f docker-compose.dev.yml up --build
docker compose -f docker-compose.dev.yml up -d --build

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

# Ver logs del backup worker (pgBackRest):
docker compose -f docker-compose.dev.yml logs -f backup-worker

# Ver logs de PostgreSQL:
docker compose -f docker-compose.dev.yml logs -f postgres

# Estado pgBackRest en dev:
docker compose -f docker-compose.dev.yml exec backup-worker pgbackrest info --stanza=main

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
# PRIMERA VEZ, migración pgBackRest o BD no importa (rebuild total ~3–6 min):
# Borra volúmenes (BD, pgBackRest, Redis) y reconstruye postgres + backup-worker + app
# pgBackRest lo configura backup-worker ANTES del seed — no hace falta consola ni botón UI.
# Si tras ~5 min la tarjeta sigue en "Pendiente": ./docker/scripts/fix-pgbackrest.sh
# ═══════════════════════════════════════════════════════════════════════════════
sudo ./start-production.sh --clean

# Solo si las imágenes quedaron corruptas / tras cambio de Dockerfile base:
# sudo ./start-production.sh --clean --no-cache

# ═══════════════════════════════════════════════════════════════════════════════
# DESPUÉS DE CAMBIOS DE CÓDIGO (rebuild incremental ~2-4 min):
# Recompila postgres/backup-worker/app si cambiaron; NO borra volúmenes
# ═══════════════════════════════════════════════════════════════════════════════
sudo ./start-production.sh

# Al arrancar, el entrypoint:
#   1) `prisma db push` desde schema.prisma (fuente de verdad del schema).
#      Cualquier columna/tabla nueva (p. ej. notifyTickets, notification_mutes)
#      se aplica sola al rebuild/arranque — no hace falta SQL manual en el servidor.
#   2) Alinea `_prisma_migrations` (migrate resolve) para que el historial
#      coincida al mover el proyecto a otro equipo/servidor.
#   3) Seed COMPLETO solo si la BD no tiene usuarios (típicamente tras --clean).
#   4) ensure-departments SIEMPRE (idempotente) → crea/actualiza TI, Telefonía, etc.
#   5) ensure-system-modules SIEMPRE → asegura módulos nuevos y habilita ADMINs existentes.
#   6) ensure-catalogs / ensure-categories si están incompletos.
#
# Por eso `sudo ./start-production.sh` (sin --clean) ya sincroniza schema + organigrama
# sin borrar datos. `--clean` borra volúmenes y vuelve a seedear desde cero.
# Dev: `./docker/scripts/reset-dev-from-scratch.sh` usa el mismo criterio (db push).

# ═══════════════════════════════════════════════════════════════════════════════
# COMANDOS MANUALES (si prefieres no usar el script):
# ═══════════════════════════════════════════════════════════════════════════════

# Aplicar cambios de código (rebuild incremental, NO borra datos):
docker compose -f docker-compose.prod.yml --env-file .env.production build postgres backup-worker app
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Rebuild total sin caché:
docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache postgres backup-worker app
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Reconstruir desde cero (⚠️ BORRA DATOS — equivalente a --clean):
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

| Campo           | Tabla               | Tipo    | Descripción                                   |
| --------------- | ------------------- | ------- | --------------------------------------------- |
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

Permite a admins con acceso a ambas familias reasignar un equipo, licencia o suministro de un área a otra. Accesible desde:

- **Equipos** → Menú "⋯" → "Transferir a otra área"
- **Licencias** → Ficha de detalle → botón "Transferir área"
- **Suministros** (`/inventory/suministros/:id`) → Ficha de detalle → botón "Transferir área"

Reglas:

- Equipo con asignación activa: bloqueado
- Atributos compatibles se conservan, los incompatibles se muestran en preview
- Queda registrado en el historial del equipo y en `audit_logs`

### Copiar tipos entre áreas

Desde `Configuración → Área → Catálogos`, cada tipo de equipo/licencia/suministro tiene un botón **"Copiar a área"** (ícono de copia azul).

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

# Solo categorías de tickets — si ya hay usuarios pero categories está vacía (0 en Gestión de Categorías):
sudo docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-categories.ts'
# o localmente: npm run db:seed-categories

# Departamentos con "Sin familia", organigrama desfasado (TECHNOLOGY legacy) o alias:
sudo docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-departments.ts'
# o localmente: npm run db:seed-departments
#
# Organigrama canónico (5 familias): Administración (incluye TI), Comercial, Marketing,
# Arquitectura, Operaciones. La antigua familia TECHNOLOGY se absorbe en Administración.
```

### Organigrama PSF (estado final)

| Familia        | Departamentos                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administración | Administración, Financiero, Contabilidad, Compras, Recursos Humanos, Mensajería, TI, Soporte Técnico, Seguridad Informática, Usuarios y Privilegios, Telefonía |
| Comercial      | Comercial                                                                                                                                                      |
| Marketing      | Marketing, Medios Digitales, Diseño, Eventos, Servicio al Cliente                                                                                              |
| Arquitectura   | Arquitectura                                                                                                                                                   |
| Operaciones    | Parqueaderos, Seguridad Física, CCTV y Control de Accesos, Mantenimiento, SSO, Áreas Verdes, Limpieza                                                          |

**Orden recomendado tras deploy (sin `--clean`):**

```bash
sudo docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-departments.ts'
sudo docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-categories.ts'
# Opcional catálogos inventario:
sudo docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-catalogs.ts'
```

Fuente de verdad en código: `prisma/seeds/family-map.ts` + `prisma/seeds/department-family-map.ts`.  
Upsert de categorías: `prisma/seeds/category-upsert.ts` (único por dept).

### Conectarse a la BD

```bash
# Dev:
docker exec -it tickets-postgres-dev psql -U tickets_user -d tickets_db

# Producción:
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres psql -U tickets_user -d tickets_db
```

---

## Backups (pgBackRest)

Documentación completa: [docs/BACKUP-SYSTEM.md](docs/BACKUP-SYSTEM.md)

### Arranque limpio (`--clean` / `--clear`)

`--clear` es alias de `--clean`: borra volúmenes (BD incluida) y vuelve a seedear.

1. `start-production.sh` ejecuta automáticamente `init-pgbackrest.sh` (stanza + FULL + archivado WAL).
2. El **backup-worker** usa la misma versión de pgBackRest que PostgreSQL 17 (2.58+).
3. **No necesitas comandos manuales** — en 1–3 min la tarjeta en Admin → Backups → Config debe mostrar **Disponible**.
4. Si quedó en **Pendiente**, pulsa **Inicializar pgBackRest** (un clic; reinicia postgres internamente).

### Restauración pgBackRest desde UI

Requiere `DOCKER_GID` en `.env.production` (lo añade `start-production.sh` automáticamente):

```bash
# Verificar en el servidor:
grep DOCKER_GID .env.production
# Si falta:
echo "DOCKER_GID=$(getent group docker | cut -d: -f3)" >> .env.production
```

En UI: **Config → Permitir restauración pgBackRest → Guardar**, luego **Restaurar**.  
El worker detiene app/nginx/postgres, restaura y reinicia todo (~5–15 min de downtime).

Para restauración por módulo usa **Export .dump**, no pgBackRest.

### ⚠️ Nota importante: `technician_assignments` en backups por módulo

Las asignaciones de técnicos a categorías (`technician_assignments`) **no se incluían** en los backups del módulo `tickets` ni en versiones antiguas del módulo `families`. Si restauraste un backup parcial y los técnicos de las categorías desaparecieron, tienes dos opciones:

**Opción A — Recuperar desde el .dump existente (si el dump lo tenía):**

```bash
# En el servidor de producción:
chmod +x docker/scripts/recover-technician-assignments.sh
./docker/scripts/recover-technician-assignments.sh
# O especificando el dump:
./docker/scripts/recover-technician-assignments.sh backups/backup-YYYY-MM-DD.dump
```

El script detecta si hay datos en el dump, los extrae e inserta con `ON CONFLICT DO NOTHING`.

**Opción B — Re-asignar manualmente desde la UI:**

```
Admin → Tickets → Categorías → editar cada categoría → pestaña "Técnicos"
```

Esta opción siempre funciona independientemente del dump.

> **Fix aplicado:** Desde ahora, el backup del módulo `families` incluye `technician_assignments`. Los backups completos (`.dump` pgdump) siempre los incluyeron.

### Operación diaria (automático)

El cron del **servidor Debian** llama `POST /api/admin/cron/backup` (protegido con `CRON_SECRET`):

- **Día configurado en UI (Config):** backup FULL (por defecto domingo)
- **Resto de días (frecuencia daily):** backup DIFF
- **Ventana horaria:** hora en Config ±30 min

#### Instalar cron en Debian (una sola vez)

```bash
cd ~/projects/Tickets
git pull
chmod +x ./docker/scripts/setup-backup-cron.sh

# Genera CRON_SECRET si falta, registra crontab horario y log en logs/backup-cron.log
./docker/scripts/setup-backup-cron.sh

# Reinicia app si se acaba de crear CRON_SECRET
docker compose -f docker-compose.prod.yml --env-file .env.production up -d app

# Probar manualmente (debe devolver JSON con ran/reason)
source .env.production 2>/dev/null || export $(grep -E '^CRON_SECRET=' .env.production | xargs)
curl -fsS -X POST "${NEXTAUTH_URL%/}/api/admin/cron/backup" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Ver log del cron: `tail -f logs/backup-cron.log`

### Digest semanal de notificaciones (email)

Usuarios con **Email** + **Reporte semanal** reciben un resumen por rol (tickets, alertas, no leídas).  
Endpoint: `POST /api/cron/weekly-digest` (idempotente: 1× por semana ISO vía `lastWeeklyDigestAt`).

```bash
chmod +x ./docker/scripts/setup-weekly-digest-cron.sh
./docker/scripts/setup-weekly-digest-cron.sh

# Prueba manual
source .env.production 2>/dev/null || export $(grep -E '^CRON_SECRET=' .env.production | xargs)
curl -fsS -X POST "${NEXTAUTH_URL%/}/api/cron/weekly-digest" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Requiere que la cola de email esté activa (`/api/cron/process-email-queue`).  
Log: `tail -f logs/weekly-digest-cron.log`

### Revisiones vencidas de Procesos y Procedimientos

Ejecuta diariamente el control de procesos publicados cuya fecha `nextReviewAt` ya venció.
Envía aviso in-app, email y Telegram al responsable y, mientras no se actualice el
procedimiento, repite el recordatorio cada siete días.

```bash
chmod +x ./docker/scripts/setup-process-reviews-cron.sh
./docker/scripts/setup-process-reviews-cron.sh

# Prueba manual
source .env.production 2>/dev/null || export $(grep -E '^CRON_SECRET=' .env.production | xargs)
curl -fsS "${NEXTAUTH_URL%/}/api/cron/process-reviews" \
  -H "Authorization: Bearer $CRON_SECRET"
```

El cron requiere `CRON_SECRET` y la cola de email activa (`/api/cron/process-email-queue`).
Log: `tail -f logs/process-reviews-cron.log`

#### Checklist de cierre (módulo Procesos — entorno de prueba)

No se siembran procesos de práctica: crear uno o dos casos reales solo en test.

| Paso | Verificación                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------- |
| 1    | Super Admin: habilitar módulo `processes` y flags `processesEnabled` / `canManageProcesses` en el usuario de prueba |
| 2    | Admin → Procesos → Configuración: meses de revisión por defecto y (opcional) DPD obligatorio para críticos          |
| 3    | Crear N0 o N1; si N2, elegir padre de la misma área; confirmar que el plazo de revisión toma el default             |
| 4    | Editar versión: ficha FR-MC-01 + diagrama secuencia/swimlane; guardar (publicado vuelve a borrador)                 |
| 5    | Flujo de estados: borrador → revisión de área → (opcional DPD con evidencia) → publicar                             |
| 6    | Usuario solo lectura (`processesEnabled`): ve catálogo publicado, ficha y diagramas; no crea ni cambia estado       |
| 7    | Gestor de otra familia: no ve ni edita procesos fuera de su alcance                                                 |
| 8    | Backup módulo `processes` export/import en test si usáis respaldos por módulo                                       |
| 9    | Cron: `GET /api/cron/process-reviews` con `CRON_SECRET` (sin errores; con `nextReviewAt` vencido avisa al owner)    |

Tras validar en test: `sudo ./start-production.sh` según esta guía (`db push` / rebuild de app).

### Módulo Accesos (pases QR)

Los pases no crean cuentas de aplicación. El QR contiene un token opaco; la base de datos
guarda únicamente su hash. La verificación siempre se hace por un usuario autenticado y queda
auditada, incluso si el código no existe.

**Privacidad:** la emisión crea un pase `PENDING_PRIVACY`, no utilizable. La persona recibe un
enlace personal que expira en 7 días, revisa el aviso publicado en `/help/privacy` y acepta
expresamente. Solo entonces se activa el pase y se envía el QR. Se conserva evidencia de fecha,
IP, user-agent, versión del aviso y hash de la aceptación; el token del enlace solo se guarda
como hash. El gestor puede reenviar la invitación, invalidando el enlace anterior.

**Reenvíos seguros:** la tabla permite reenviar la invitación pendiente o un QR activo. El
reenvío de QR crea un código nuevo e invalida el QR anterior inmediatamente; úsalo solo
cuando la persona no pueda usar el código original.

**Correo del QR:** `start-production.sh` no instala el procesador de cola. Tras emitir un pase
con correo, instala el cron (una sola vez) o dispara la cola a mano:

```bash
chmod +x ./docker/scripts/setup-email-queue-cron.sh
./docker/scripts/setup-email-queue-cron.sh
# o prueba inmediata:
curl -sk "${NEXTAUTH_URL}/api/cron/process-email-queue" \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Backup parcial `access`:** exporta `access_organizations`, `access_subjects`, `access_passes`
y `access_scan_events`.
No incluye usuarios ni familias referenciados. Restaura solo sobre un destino que ya tenga
los mismos IDs de usuarios/familias (p. ej. tras restaurar Usuarios + Familias, o un dump
completo). Las fotos de sujetos viven en disco (`uploads/access-subjects/…`) y **no** van
en el backup selectivo: tras restaurar, conviene re-subir fotos o copiar ese directorio
junto con el dump.

**Retención / LOPDP:** el módulo aún no ejecuta purga ni anonimización automática. Define
plazos internos y un proceso operativo de borrado/anonimizado de sujetos, fotos y eventos
de escaneo vencidos; no activar reconocimiento facial automático sin evaluación jurídica.

#### Checklist de cierre (módulo Accesos — entorno de prueba)

| Paso | Verificación                                                                                                                                                                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Ejecutar `sudo ./start-production.sh`; el entrypoint aplica `schema.prisma` y `ensure-system-modules` habilita Accesos para ADMIN existentes.                                                                                                                         |
| 2    | Asignar al gestor `accessEnabled` + `canManageAccess`, y al agente `accessEnabled`; limitar ambos a las familias autorizadas mediante `user_family_access.module = access`.                                                                                           |
| 3    | Emitir un pase con vigencia y correo; confirmar que llega la invitación, aceptar el aviso desde el enlace y comprobar que recién entonces llega el QR (sin datos personales).                                                                                         |
| 4    | Escanear con usuario autorizado: debe mostrar nombre, área y vigencia, y crear un evento `access_scan_events` con resultado `VALID`.                                                                                                                                  |
| 5    | Revocar o suspender el pase desde la consola Accesos y escanear de nuevo: debe responder `REVOKED` o `SUSPENDED` inmediatamente.                                                                                                                                      |
| 6    | Escanear desde un usuario de otra familia: debe rechazar con `OUT_OF_SCOPE` y conservar la trazabilidad.                                                                                                                                                              |
| 7    | Probar backup parcial `access` en entorno de prueba con usuarios/familias ya presentes; valida sujetos, pases y eventos. Copia también `uploads/access-subjects` si necesitas fotos. Los QR emitidos antes de restaurar se conservan porque solo se almacena el hash. |
| 8    | Definir plazos de retención y un procedimiento de purga/anonimización (aún no automatizado); no activar reconocimiento facial automático sin evaluación jurídica específica.                                                                                          |

### Configuración SMTP (Admin → Email)

Solo se admiten **Gmail** y **Microsoft** (Outlook personal + Microsoft 365):

| Host                    | Uso                            |
| ----------------------- | ------------------------------ |
| `smtp.gmail.com`        | Gmail / Google Workspace       |
| `smtp-mail.outlook.com` | Outlook.com / Hotmail personal |
| `smtp.office365.com`    | Microsoft 365 corporativo      |

Puerto recomendado: **587** (STARTTLS). Alternativa: **465** (SSL directo).

#### Checklist de cierre (email listo para producción)

| Paso | Verificación                                                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Admin → Email: switch **Habilitar envío de emails** activo                                                                                               |
| 2    | Elegir proveedor (Microsoft o Gmail) y completar usuario + contraseña de aplicación                                                                      |
| 3    | **Email remitente** = mismo que usuario SMTP (botón «Usar usuario SMTP»)                                                                                 |
| 4    | **Guardar** → **Probar conexión** (funciona aunque la contraseña ya esté guardada)                                                                       |
| 5    | Cron de cola cada 1–5 min: `./docker/scripts/setup-email-queue-cron.sh` (o `GET /api/cron/process-email-queue` con `Authorization: Bearer $CRON_SECRET`) |
| 6    | Smoke test: crear ticket y confirmar email en cola / bandeja                                                                                             |

```bash
# Instalar cron (recomendado en producción)
chmod +x ./docker/scripts/setup-email-queue-cron.sh
./docker/scripts/setup-email-queue-cron.sh

# Procesar cola manualmente
curl -sk "${NEXTAUTH_URL}/api/cron/process-email-queue" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

### OAuth (Google + Microsoft)

Guía detallada para principiantes: [`docs/OAUTH_SETUP_GUIDE.md`](docs/OAUTH_SETUP_GUIDE.md)

La configuración se guarda en **Admin → OAuth** (`oauth_configs`). NextAuth carga credenciales desde BD al iniciar sesión (no hace falta reiniciar tras guardar).

| Paso | Verificación                                                                                 |
| ---- | -------------------------------------------------------------------------------------------- |
| 1    | `ENCRYPTION_KEY` definido en `.env.production` (cifra Client Secrets)                        |
| 2    | Google Cloud / Azure Portal: Redirect URI exacta (`/api/auth/callback/google` o `/azure-ad`) |
| 3    | Admin → OAuth: Client ID + Secret → **Guardar** → activar switch → **Probar conexión**       |
| 4    | Login/registro: botones Google/Microsoft visibles solo si el proveedor está **Activo** en BD |
| 5    | Usuario nuevo OAuth → rol **CLIENT** automático                                              |

Red local (`192.168.x.x`): registrar la URL HTTPS completa en los portales OAuth (ver banner en Admin → OAuth).

---

### Seguridad y sesión (Admin → Seguridad)

| Campo                          | Efecto real                                                                |
| ------------------------------ | -------------------------------------------------------------------------- |
| **Tiempo de sesión**           | Cierre por **inactividad** (cliente + JWT en servidor). Aviso 5 min antes. |
| **Máx. intentos login**        | Bloqueo temporal **15 min** tras superar el límite                         |
| **Longitud mínima contraseña** | Registro, cambio/reset de contraseña, creación de usuarios admin           |
| **Requerir cambio contraseña** | Redirige a `/change-password` hasta cumplir política                       |
| **Tamaño máximo archivo**      | Adjuntos de tickets, equipos, licencias e imports                          |

La pestaña **Configuración** ya no recarga sola cada 5 min (solo con **Recargar** manual).

---

### Modo mantenimiento (Admin → Mantenimiento)

| Paso | Acción                                                                       |
| ---- | ---------------------------------------------------------------------------- |
| 1    | Super Admin → **Configuración → Mantenimiento**                              |
| 2    | Activar switch + mensaje personalizado → **Guardar**                         |
| 3    | Usuarios normales ven `/maintenance`; admins pueden seguir si está permitido |
| 4    | Al terminar: desactivar y **Guardar**                                        |

Super Admin siempre accede. Las APIs operativas responden **503** durante mantenimiento (auth y cron siguen activos).

---

### Bot de Telegram (alertas operativas)

Canal adicional paralelo al email. El email **no se toca** — Telegram se añade encima.

#### Configuración inicial (una sola vez)

1. En Telegram, abre **@BotFather** → `/newbot` → sigue los pasos → copia el token.
2. En el sistema: **Admin → Configuración del Sistema → tab Telegram**
   - Activa el switch **Habilitar bot**
   - Pega el token en **Token del Bot**
   - Escribe el username sin `@` en **Username del bot**
   - Guarda con el botón **Guardar**
   - Pulsa **Probar conexión** — debe mostrar el badge verde con el nombre del bot

#### Red local (sin URL pública) — Modo Polling

Telegram no acepta IPs privadas para webhooks. Usa el cron de polling:

```bash
chmod +x ./docker/scripts/setup-telegram-poll-cron.sh
./docker/scripts/setup-telegram-poll-cron.sh
```

Instala dos entradas crontab que llaman al endpoint cada 30 s.

```bash
# Verificar que funciona (debe devolver {"success":true,"processed":N})
CRON_SECRET=$(grep '^CRON_SECRET=' .env.production | cut -d= -f2 | tr -d '"')
curl -sk "${NEXTAUTH_URL}/api/cron/telegram-poll" -H "Authorization: Bearer $CRON_SECRET"

# Ver log en tiempo real
tail -f logs/telegram-poll-cron.log
```

#### Producción (hosting con dominio público)

```bash
# 0. Webhook Secret (obligatorio en producción):
openssl rand -hex 32
# Pegar en Admin → Telegram → Webhook Secret → Guardar

# 1. Pulsar "Registrar Webhook" en Admin → Configuración → Telegram
#    (o llamar la API directamente):
curl -s -X POST "${NEXTAUTH_URL}/api/telegram/register-webhook" \
  -H "Cookie: <sesión-admin>" \
  -H "Content-Type: application/json"

# 2. Desinstalar el cron de polling (ya no hace falta):
./docker/scripts/setup-telegram-poll-cron.sh --remove
```

#### Vincular una cuenta de usuario

Cada usuario (admin, técnico o cliente) vincula su cuenta desde:

- **Perfil → sección Telegram** — genera un código de 6 caracteres
- **Configuración → Notificaciones → Telegram** — misma card

Luego en el bot escriben `/vincular CÓDIGO`. El código caduca en 15 minutos.

#### Notificaciones Telegram — matriz completa de eventos

| Evento                            | Canal Telegram | Destinatarios                  | Prioridad          | Implementado en                                              |
| --------------------------------- | -------------- | ------------------------------ | ------------------ | ------------------------------------------------------------ |
| **Tickets**                       |                |                                |                    |                                                              |
| Ticket creado                     | ✅             | Admins de la familia           | important          | `NotificationService.notifyTicketCreated`                    |
| Ticket asignado                   | ✅             | Técnico asignado               | important          | `NotificationService.notifyTicketAssigned`                   |
| Ticket resuelto                   | ✅             | Técnico asignado               | important          | `NotificationService.notifyTicketResolved`                   |
| Ticket transferido de área        | ✅             | Admins de ambas familias       | important          | `NotificationService.notifyFamilyChange`                     |
| Cliente comenta en ticket         | ✅             | Técnico asignado               | important\*        | `NotificationService.notifyNewComment`                       |
| Técnico comenta en ticket         | ❌             | —                              | optional → omitido | In-app + WebPush cubren este caso                            |
| **Inventario**                    |                |                                |                    |                                                              |
| Acta pendiente de firma           | ✅             | Admins de la familia           | important          | `InventoryNotificationService.notifyDeliveryActFamilyAdmins` |
| Alerta de stock bajo/crítico      | ✅             | Admins de la familia           | important          | `BatchAlertService`                                          |
| Backup fallido                    | ✅             | Admins configurados            | critical           | `backup-utils.ts`                                            |
| **Rondas**                        |                |                                |                    |                                                              |
| Ronda asignada (schedule nuevo)   | ✅             | Agente asignado                | important          | `schedules/route.ts` POST                                    |
| Ronda reasignada (agente nuevo)   | ✅             | Agente nuevo + agente anterior | important          | `schedules/[id]/route.ts` PATCH                              |
| Ronda reprogramada (mismo agente) | ✅             | Agente asignado                | important          | `schedules/[id]/route.ts` PATCH                              |
| Programación cancelada            | ✅             | Todos los agentes afectados    | important          | `schedules/[id]/route.ts` DELETE                             |
| Recordatorio pre-ronda            | ✅             | Agente asignado                | important          | `PatrolReminderService`                                      |
| Ronda no iniciada (MISSED)        | ✅             | Supervisores + agente          | important          | `PatrolSchedulerService.notifyMissed`                        |
| Ronda cerrada automáticamente     | ✅             | Supervisores + agente          | important          | `PatrolSchedulerService.notifyAutoClose`                     |
| **Seguridad**                     |                |                                |                    |                                                              |
| Cuenta bloqueada (login fallido)  | ✅             | Super admins                   | critical           | `SecurityConfigService.recordFailedLogin`                    |

\* `priority: 'important'` explícita — override de la política `optional` para `newComments`.

#### Cola de alertas salientes (`telegram_queue`)

Las alertas **no se envían síncronamente** — se encolan en BD y un cron las procesa con reintentos (hasta 3 intentos, backoff 60 s):

```bash
# Procesar cola manualmente
curl -sk "${NEXTAUTH_URL}/api/cron/process-telegram-queue" \
  -H "Authorization: Bearer $CRON_SECRET"

# Instalar crons de limpieza + cola (recomendado en producción)
chmod +x ./docker/scripts/setup-telegram-cleanup-cron.sh
./docker/scripts/setup-telegram-cleanup-cron.sh
```

Frecuencia recomendada de la cola: **cada 1–5 minutos** (el script instala cada 2 min).

Las alertas **`critical`** (p. ej. backup fallido, cuenta bloqueada) disparan un procesamiento inmediato de la cola tras encolar, además del cron periódico.

En **Admin → Configuración → Telegram** hay un panel **Cola de alertas Telegram** (pendientes/fallidos, procesar ahora, reintentar fallidos) — API: `/api/admin/settings/telegram-queue`.

#### Checklist de cierre (Telegram listo para producción)

| Paso                   | Verificación                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| 1. Migraciones         | `npx prisma migrate deploy` — incluye `telegram_chat_id` unique y tabla `telegram_queue`          |
| 2. Bot configurado     | Admin → Telegram: token, username, switch habilitado, **Probar conexión** OK                      |
| 3. Webhook Secret      | Generar (`openssl rand -hex 32`), guardar en Admin → Telegram → **Webhook Secret**                |
| 4. Alertas globales    | Admin → Notificaciones: switch **Alertas Telegram** activo                                        |
| 5. Inbound (elige uno) | **Red local:** `setup-telegram-poll-cron.sh` · **Producción:** Registrar Webhook + quitar polling |
| 6. Cola saliente       | `setup-telegram-cleanup-cron.sh` (cola cada 2 min + limpieza tokens diaria)                       |
| 7. Vincular usuarios   | Perfil → Telegram → `/vincular CÓDIGO` en el bot                                                  |
| 8. Smoke test          | Crear ticket de prueba o pulsar **Procesar cola ahora** en el panel admin                         |

#### Lógica del recordatorio pre-ronda

El cron `/api/cron/patrol` (cada 5 min) ejecuta `PatrolReminderService.sendPendingReminders()`:

1. Lee todas las familias con `reminderMinutesBefore > 0` desde `patrol_family_config`
2. Busca patrullas `PENDING` sin `reminderSentAt` cuyo `scheduledStart` esté dentro de la ventana
3. Envía notificación in-app + **Telegram** al agente
4. Marca `reminderSentAt` en la patrulla (idempotencia — no se envía dos veces)

La ventana se configura en **Rondas → Configuración → Recordatorio (minutos antes)** por área.

#### Configurar el cron de patrol

```bash
# El cron de patrol ya debería estar instalado — verificar:
crontab -l | grep cron/patrol

# Si no está, instalarlo manualmente (cada 5 min):
CRON_SECRET=$(grep '^CRON_SECRET=' .env.production | cut -d= -f2 | tr -d '"')
(crontab -l 2>/dev/null; echo "*/5 * * * * curl -fsS \"${NEXTAUTH_URL}/api/cron/patrol\" -H \"Authorization: Bearer ${CRON_SECRET}\" >> logs/patrol-cron.log 2>&1 # tickets-patrol-cron") | crontab -
```

| Comando               | Acceso                   | Descripción                                             |
| --------------------- | ------------------------ | ------------------------------------------------------- |
| `/start`              | Todos                    | Bienvenida y estado de vinculación                      |
| `/vincular <código>`  | Todos                    | Vincular cuenta del sistema                             |
| `/estado`             | Todos                    | Nombre, email, teléfono, rol y estado de alertas        |
| `/desvincular`        | Todos                    | Desconectar cuenta                                      |
| `/ayuda`              | Todos                    | Lista dinámica filtrada por módulos activos del usuario |
| **— Tickets —**       |                          |                                                         |
| `/mis_tickets`        | ticketsEnabled           | Tickets activos filtrados por rol                       |
| `/mi_tecnico`         | Cliente                  | Técnico asignado al ticket abierto más reciente         |
| `/pendientes`         | Admin / Técnico          | Tickets OPEN ordenados por prioridad                    |
| **— Inventario —**    |                          |                                                         |
| `/mis_equipos`        | Todos (con asignaciones) | Equipos asignados actualmente                           |
| `/mis_actas`          | Todos                    | Actas de entrega y devolución propias (últimos 90 días) |
| `/mis_mantenimientos` | inventoryEnabled         | Equipos propios en mantenimiento o registros asignados  |
| `/mis_solicitudes`    | canRequestAssets / Admin | Solicitudes de activos activas                          |
| `/inventario`         | inventoryEnabled / Admin | Resumen global de equipos por estado                    |
| `/bajas`              | Admin / Técnico          | Solicitudes de baja pendientes de revisión              |
| `/actas`              | Admin                    | Todas las actas pendientes de firma del sistema         |
| `/catalogo`           | Todos                    | Equipos disponibles para la venta                       |
| **— Rondas —**        |                          |                                                         |
| `/mis_rondas`         | patrolsEnabled           | Rondas activas y programadas (agente o supervisor)      |
| **— Noticias —**      |                          |                                                         |
| `/noticias`           | newsEnabled              | Últimas 5 noticias publicadas ordenadas por prioridad   |
| **— Contratos —**     |                          |                                                         |
| `/mis_contratos`      | Custodio / Admin         | Contratos activos asignados como custodio               |
| **— Admin —**         |                          |                                                         |
| `/sistema`            | Admin                    | Resumen: tickets, rondas, actas, mantenimientos, backup |

#### Limpieza de tokens expirados

Los tokens de vinculación se acumulan en `telegram_link_tokens`. Instala limpieza diaria + cola de alertas con:

```bash
chmod +x ./docker/scripts/setup-telegram-cleanup-cron.sh
./docker/scripts/setup-telegram-cleanup-cron.sh
```

O manualmente (solo limpieza, una vez al día a las 03:00):
CRON_SECRET=$(grep '^CRON_SECRET=' .env.production | cut -d= -f2 | tr -d '"')
(crontab -l 2>/dev/null; echo "0 3 * * * curl -fsS \"${NEXTAUTH_URL}/api/cron/telegram-cleanup\" -H \"Authorization: Bearer ${CRON_SECRET}\" >> logs/telegram-cleanup.log 2>&1") | crontab -

````

#### Solución de problemas Telegram

| Problema | Solución |
|---|---|
| Card muestra "bot no habilitado" | Admin → Configuración → Telegram → verificar token y switch activo → Guardar |
| `/vincular` no responde en 30 s | Verificar que el cron de polling está activo: `crontab -l \| grep telegram` |
| `bad webhook: IP address is reserved` | Esperado en red local — usa el modo polling, no "Registrar Webhook" |
| Webhook activo pero polling no funciona | Desregistrar webhook primero desde @BotFather: `/deletewebhook` |
| Bot responde pero no vincula | Verificar que el código no esté expirado (15 min) — generar uno nuevo |
| Alertas tardan en llegar | Verificar cron de cola: `crontab -l \| grep telegram-queue` o ejecutar `process-telegram-queue` manualmente |
| Demasiados intentos `/vincular` | Rate limit: 8 intentos / 15 min por chat — esperar o vincular desde otro chat |

---

### Auditoría y cumplimiento

- **UI:** Admin → Backups → **Dashboard** → tarjeta _Guía de auditoría_ (checklist en vivo + **Exportar informe** JSON)
- **CLI evidencia:**

```bash
./docker/scripts/disaster-recovery.sh check
./docker/scripts/disaster-recovery.sh info
````

- **Mensual recomendado:** Export .dump desde UI + guardar informe JSON + copia off-site de volumen `pgbackrest_repo`

### Comandos manuales

```bash
# Estado del repositorio pgBackRest
./docker/scripts/disaster-recovery.sh info

# Backup completo manual
./docker/scripts/disaster-recovery.sh backup-full

# Backup diferencial
./docker/scripts/disaster-recovery.sh backup-diff

# Reparar pgBackRest / recovery mode (sin borrar datos):
./docker/scripts/fix-pgbackrest.sh
```

### Recuperación ante desastre

```bash
# Restaurar último backup disponible
./docker/scripts/disaster-recovery.sh restore --latest

# Restaurar backup específico por etiqueta
./docker/scripts/disaster-recovery.sh restore --set 20260708-120000F

# PITR — punto en el tiempo (UTC)
./docker/scripts/disaster-recovery.sh pitr "2026-07-08 14:30:00"
```

### Exportación portable (migración)

Desde UI: **Exportar .dump** o API `POST /api/admin/backups` con `{ "mode": "export" }`.

```bash
# Restaurar export manualmente
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T app \
  pg_restore -h postgres -U tickets_user -d tickets_db --clean --if-exists /app/backups/export-XXXX.dump
```

---

## Acceso desde la Red

Cada equipo necesita en su archivo hosts (`/etc/hosts` o `C:\Windows\System32\drivers\etc\hosts`):

```
TU_IP    gestion.local www.gestion.local
```

Si cambia tu IP: ejecutar `sudo ./start-production.sh` y actualizar hosts en los clientes.

### Confianza en el certificado SSL (mkcert)

El certificado es autofirmado con mkcert. El browser muestra **"La conexión no es privada" / `NET::ERR_CERT_AUTHORITY_INVALID`** hasta que se instale la CA raíz de mkcert en cada dispositivo cliente. Esto es un paso **de una sola vez por dispositivo**.

#### Mac donde corre el servidor (misma máquina)

```bash
# Instalar mkcert si no está
brew install mkcert

# Registrar la CA en el sistema (solo una vez)
mkcert -install
```

Reiniciar Chrome completamente después (cerrar todas las ventanas, no solo la pestaña).

#### Ver dónde está la CA para distribuirla

```bash
mkcert -CAROOT
# Ejemplo: /Users/cosmesoto/Library/Application Support/mkcert
# El archivo a distribuir es: rootCA.pem
```

#### Instalar la CA en otros dispositivos

| Dispositivo                 | Pasos                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Mac**                     | Doble clic en `rootCA.pem` → Llavero de acceso → Confiar siempre en SSL/TLS                                       |
| **Windows**                 | Doble clic en `rootCA.pem` → Instalar certificado → Equipo local → "Entidades de certificación raíz de confianza" |
| **Android**                 | Ajustes → Seguridad → Instalar certificado → desde archivo                                                        |
| **iOS / iPadOS**            | Enviar `rootCA.pem` por AirDrop o correo → Ajustes → General → VPN y gestión del dispositivo → Confiar            |
| **Linux (Chrome/Chromium)** | `certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n mkcert -i rootCA.pem`                                            |

#### Atajo temporal (solo para pruebas rápidas)

En Chrome, con la pantalla de error visible, escribe **`thisisunsafe`** directamente (sin campo de texto). Chrome acepta el certificado para esa sesión. No es solución permanente.

#### Regenerar certificado si cambias de IP

```bash
cd docker/certs

mkcert -cert-file gestion.local.pem -key-file gestion.local-key.pem \
  gestion.local www.gestion.local TU_IP localhost 127.0.0.1

# Luego reconstruir nginx:
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate nginx
```

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
┌───────▼───────────────┐  ┌──────▼───────┐
│  PostgreSQL + WAL     │  │    Redis     │
│  (pgBackRest archive) │  │  (caché/SSE) │
└───────┬───────────────┘  └──────────────┘
        │ volúmenes compartidos
┌───────▼───────────────────────────────────┐
│  backup-worker (pgBackRest)               │
│  - Respaldos FULL/DIFF automáticos        │
│  - Repositorio: pgbackrest_repo         │
└───────────────────────────────────────────┘
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

| Acción                              | Admin normal (con familia)   | Super Admin |
| ----------------------------------- | ---------------------------- | ----------- |
| Crear / editar equipo               | ✅                           | ✅          |
| Asignar equipo                      | ✅                           | ✅          |
| **Devolver equipo a bodega**        | ✅                           | ✅          |
| Crear acta de devolución            | ✅                           | ✅          |
| Retirar equipo (baja)               | ✅                           | ✅          |
| Aprobar / rechazar bajas            | ✅ (familias asignadas)      | ✅          |
| Transferir activo entre áreas       | ✅ (acceso a ambas familias) | ✅          |
| Copiar tipos entre áreas            | ✅                           | ✅          |
| **Importar equipos (CSV/Excel)**    | ✅ (familias asignadas)      | ✅          |
| **Eliminar equipo permanentemente** | ❌                           | ✅          |
| **Eliminar actas**                  | ❌                           | ✅          |

### Cómo se resuelve el scope de inventario para Admin normal

El sistema usa `inventory_manager_families` (no `admin_family_assignments`) para determinar qué familias puede gestionar un admin en el módulo de inventario. Si no tiene ninguna familia asignada en inventario, puede gestionar todas.

### Asignación de áreas por módulo (unificado + legacy)

**Fuente de verdad nueva:** `user_family_access`  
`(userId, familyId, module)` + flags `canConsume` / `canOperate` / `canView`.

- `module` es **string** (registry en `src/lib/auth/family-access-modules.ts`) → agregar un módulo futuro **no requiere** migración de enum.
- Familia **nativa** = departamento (no se guarda en esta tabla).
- Documentos + Noticias comparten `module = content`.
- API: `GET/PUT/POST/DELETE /api/admin/users/:id/family-access`
- Sync: `npm run db:sync-family-access` (también en entrypoint de producción).

| Módulo datos | Clave `module` | Legacy (dual-write en transición) |
| ------------ | -------------- | --------------------------------- |
| Tickets      | `tickets`      | tech / client / admin*family*\*   |
| Inventario   | `inventory`    | `inventory_manager_families`      |
| Rondas       | `patrols`      | `patrol_family_assignments`       |
| Docs+News    | `content`      | _(solo tabla unificada)_          |

Para un módulo nuevo: registrar en `FAMILY_ACCESS_MODULES` + card en Usuarios + usar `resolveModuleFamilyScopeIds(userId, 'mi_modulo', …)`.

#### Cómo agregar un módulo futuro (checklist)

1. **Registry** — `src/lib/auth/family-access-modules.ts`  
   Añadir clave (`crm`, `hr`, …) con `defaultsByRole` y `hasLegacyTables: false`.
2. **Permisos de usuario** — flags en `users` / `system_modules` si el módulo se enciende por toggle.
3. **UI Usuarios** — `ModuleAccessCard` + handlers vía  
   `POST/PUT/DELETE /api/admin/users/:id/family-access` con `module: 'crm'`.
4. **Backend del módulo** — scope con  
   `resolveModuleFamilyScopeIds(userId, 'crm', 'canOperate' | 'canView' | 'canConsume')`.
5. **Tests** — registrar en `family-access-modules.test.ts` y un caso de scope.
6. **Sin migración Prisma** — `module` es `VARCHAR`; no hace falta alterar enum.

Lectura: si `user_family_access` ya tiene filas para ese usuario+módulo, es la **única** fuente (legacy no “revive” desasignaciones).

```bash
npm run db:sync-family-access              # import 1ª vez
npm run db:diagnose-family-access          # drift legacy vs unificado
npx tsx prisma/sync-user-family-access.ts --diagnose --fix   # reimport force
npx tsx prisma/sync-user-family-access.ts --force
npm run test:family-access                 # suite de regresión (81+ tests)
```

#### Módulo Credenciales (bóveda) — MVP

| Pieza                                                                   | Estado                                          |
| ----------------------------------------------------------------------- | ----------------------------------------------- |
| Tablas `credential_vaults` / `credential_entries` / `credential_shares` | ✅ migración `20260806200000_credentials_vault` |
| Flags `credentialsEnabled` + `canManageCredentials` + `system_modules`  | ✅                                              |
| Family-access módulo `credentials`                                      | ✅                                              |
| API CRUD + reveal cifrado (AES-GCM) + auditoría                         | ✅                                              |
| UI `/credentials` + card en ficha de equipo                             | ✅                                              |
| Compartir usuario→usuario (VIEW) + notificación + auditoría             | ✅                                              |
| Backup módulo `credentials` (secretos cifrados en dump)                 | ✅                                              |
| Export KeePass / shares por familia / capability EDIT                   | ⏳ post-MVP                                     |

**Uso:** habilitar módulo en Usuarios, asignar áreas `credentials`, gestionar en menú Credenciales. Secretos solo en `/reveal` (auditado).

**Compartir:** un gestor (`canManageCredentials` / Admin con módulo) puede compartir una entrada con otro usuario que tenga Credenciales activo. El destinatario ve la tarjeta («Compartida contigo»), revela con auditoría y recibe notificación in-app **sin** la clave en el mensaje.

**Backups / seguridad:** pgBackRest y exports incluyen `secretEncrypted` (AES-GCM), nunca plaintext. Tras restaurar se necesita la misma `ENCRYPTION_KEY`. En restore selectivo elige el módulo «Credenciales (secretos cifrados)».

#### Cierre de fase (áreas unificadas) — DONE

Esta sección queda **cerrada** para uso en producción con el siguiente contrato:

| Pieza                                                            | Estado                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------ |
| Tabla `user_family_access` + migration                           | ✅                                                           |
| Registry extensible (`family-access-modules.ts`)                 | ✅                                                           |
| API canónica `/api/admin/users/:id/family-access`                | ✅                                                           |
| UI Usuarios (tickets/inv/rondas/content)                         | ✅                                                           |
| Lectura prefer-unified + sync 1×                                 | ✅                                                           |
| `/api/user/modules`, dashboards, knowledge, rondas/colaboradores | ✅                                                           |
| Dual-write a tablas legacy                                       | ✅ retirado (solo `user_family_access`)                      |
| Drop de tablas legacy                                            | ✅ migración `20260806120000_drop_legacy_family_assignments` |

**Fuente única:** `user_family_access` (módulos `tickets` | `inventory` | `patrols` | `content`).
Las APIs legacy de asignación quedan como wrappers thin hacia helpers unificados.
**Operación post-deploy:** aplicar migraciones (`prisma migrate deploy` o flujo Docker); `sync` solo siembra `content` desde tickets si hace falta. Validar con `npm run db:diagnose-family-access`.

### Importación masiva de equipos (CSV / Excel)

Ruta UI: `/inventory/import` (botón **Importar** en el listado de inventario).

1. **Catálogo fijo (wizard):** familia, tipo, marca, modelo y modo de adquisición. No van en el archivo.
2. **Plantilla dinámica:** columnas fijas + atributos del tipo seleccionado (nombre o etiqueta del atributo).
3. **Límite:** máximo **100** filas por importación (`MAX_IMPORT_ROWS`).
4. **Validación:** `POST /api/inventory/equipment/import` con `dryRun=true` antes de confirmar.
5. **Modos de importación** (`mode` en multipart):
   - **`add` (solo agregar):** crea equipos nuevos; series ya existentes se **omiten** (no error).
   - **`update` (agregar y actualizar):** crea nuevos y **fusiona metadatos** de existentes (condición, bodega, notas, atributos dinámicos). No cambia código, serie, tipo, modelo ni estado.
   - Equipos en estado `ASSIGNED`, `MAINTENANCE`, `RETIRED`, `FOR_SALE` o `SOLD` **no se actualizan** por importación.
   - **No hay modo `replace`** (a diferencia de categorías): eliminar/reemplazar equipos masivamente sería riesgoso por asignaciones, actas e historial.
6. **Condiciones válidas:** `NEW`, `USED`, `DAMAGED` (aliases `LIKE_NEW`, `GOOD`, `USADO`, etc. → `USED`).
7. **Auth:** `assertInventoryManageByFamily` — mismo scope que crear equipo manual.

API:

- `GET /api/inventory/equipment/import/template?familyId&typeId&brandId&modelId&acquisitionMode&format=xlsx|csv`
- `POST /api/inventory/equipment/import` — multipart: `file`, `dryRun`, `mode` (`add`|`update`), catálogo fijo

Módulo: `src/lib/inventory/equipment-import/`

**UX profesional:** cada error incluye mensaje + solución sugerida (`hint`). La plantilla Excel trae hoja "Instrucciones" con bodegas, modos y reglas.

### Coordinación importación ↔ exportación

Definiciones compartidas en `src/lib/inventory/equipment-field-definitions.ts` (etiquetas y alias de columnas).

| Campo                                      | Import (plantilla)             | Export (listado)                                                                |
| ------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------- |
| N° de Serie                                | Obligatorio                    | Incluido                                                                        |
| Condición, Bodega, Ubicación física, Notas | Columnas fijas                 | Mismas etiquetas                                                                |
| Precio de compra                           | Numérico (`1200.00`)           | Mismo formato (sin `$`)                                                         |
| Fecha de compra                            | `YYYY-MM-DD` o `DD/MM/YYYY`    | `DD/MM/YYYY`                                                                    |
| Accesorios                                 | Separados por coma             | Join con coma                                                                   |
| Atributos                                  | Columnas por atributo del tipo | Columna `Atributos` legible (`Etiqueta: Valor`); import la acepta como respaldo |
| Catálogo (familia/tipo/marca/modelo)       | Wizard (no va en archivo)      | Columnas del informe (solo lectura)                                             |

**Flujos recomendados:**

1. **Edición masiva confiable:** Import → catálogo → **Equipos existentes** → editar → reimportar con `update`.
2. **Desde listado general:** Export CSV del inventario (filtro por familia/tipo) → editar columnas alineadas → import con mismo catálogo.
3. **Alta masiva:** Plantilla vacía → completar filas → import con `add`.

API plantilla con datos existentes:

- `GET .../import/template?...&prefill=true` — exporta hasta 100 equipos del catálogo seleccionado en formato importable.

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

## Patrones de UI (listados)

Para pantallas nuevas o al tocar un listado existente, usar este estándar (migración gradual; no reescribir todo de golpe):

| Necesidad                                                | Pieza canónica                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Filtros + stats                                          | `FilterBar` + `useFilters` → `@/components/common/filters`                  |
| Toolbar Card+Table (refresh / vista / columnas / export) | `ListTableToolbar`                                                          |
| Export CSV/Excel/PDF                                     | `useExport` + `ExportButton` (`exportToExcelMulti` si hay varias hojas)     |
| Tabla con paginación/cards ya armada                     | `DataTable` (`@/components/ui/data-table`) + `actions={<ExportButton … />}` |

**No usar** `legacy-role-filters.tsx` (antes `filters.tsx`; sombreaba el paquete `filters/`).

Referencias ya migradas: Credenciales, Familias, Proveedores, Contratos, Mantenimientos, Ventas, Equipos en venta, Mis Novedades (agente), Reportes inventario (detalle), Dashboard rondas (activas). Tickets/Usuarios/Knowledge y listados con `DataTable` siguen con `actions={<ExportButton />}` (correcto).

---

## Solución de Problemas

| Problema                                                         | Solución                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App no arranca                                                   | `docker logs tickets-app` — verificar DATABASE_URL                                                                                                                                                                                                                                                                                                                      |
| No accede a gestion.local                                        | Verificar `/etc/hosts` y que nginx esté corriendo                                                                                                                                                                                                                                                                                                                       |
| Certificado SSL no confiable (`NET::ERR_CERT_AUTHORITY_INVALID`) | Ver sección **Acceso desde la Red → Confianza en el certificado SSL** para instalar la CA de mkcert por dispositivo                                                                                                                                                                                                                                                     |
| **404 en `/api/admin/news` u otros módulos**                     | `sudo ./start-production.sh`. Si persiste: `sudo ./start-production.sh --clean` (⚠️ borra BD)                                                                                                                                                                                                                                                                           |
| pgBackRest no disponible / recovery mode                         | `./docker/scripts/fix-pgbackrest.sh`                                                                                                                                                                                                                                                                                                                                    |
| `VersionNotSupportedError` control version 1700                  | Reconstruir **backup-worker** (pgBackRest 2.50+ para PG 17): `docker compose -f docker-compose.prod.yml build backup-worker && ./docker/scripts/init-pgbackrest.sh`                                                                                                                                                                                                     |
| `archive_mode must be enabled`                                   | Bootstrap incompleto — `./docker/scripts/init-pgbackrest.sh` y reinicia postgres                                                                                                                                                                                                                                                                                        |
| PostgreSQL bucle recovery / P1017 en app                         | `archive-push` falló — ejecutar fix script y rebuild `postgres`                                                                                                                                                                                                                                                                                                         |
| Módulo carga vacío tras restaurar backup                         | Igual que arriba — si se reconstruyó sin `start-production.sh`, el `NEXTAUTH_URL` puede quedar con dominio errado                                                                                                                                                                                                                                                       |
| Dashboard rondas vacío                                           | Verificar que hay patrullas programadas para hoy (UTC-5)                                                                                                                                                                                                                                                                                                                |
| Técnico no aparece en categorías                                 | Verificar que `users.departmentId` apunte a un departamento de la familia de la categoría, o que exista un grant en `user_family_access` (módulo `tickets`) — tras un `--clean` + restore, un restore viejo puede haber dejado ese vínculo en NULL (ver `cleanupOrphanedForeignKeys` en `backup-restore.ts`); reasignar el departamento en Admin → Técnicos lo resuelve |
| Agente no aparece en programación                                | Verificar `patrol_family_assignments` + `patrolsEnabled=true`                                                                                                                                                                                                                                                                                                           |
| Telegram: card muestra "bot no habilitado"                       | Admin → Configuración → Telegram → verificar token y switch → Guardar                                                                                                                                                                                                                                                                                                   |
| Telegram: `/vincular` no responde                                | Verificar cron de polling: `crontab -l \| grep telegram-poll` — si falta, ejecutar `setup-telegram-poll-cron.sh`                                                                                                                                                                                                                                                        |
| Telegram: `bad webhook: IP address is reserved`                  | Normal en red local — no pulsar "Registrar Webhook"; usar modo polling                                                                                                                                                                                                                                                                                                  |

---

## Archivos de Configuración

| Archivo                                      | Propósito                                            |
| -------------------------------------------- | ---------------------------------------------------- |
| `.env.local`                                 | Variables desarrollo (npm run dev)                   |
| `.env.production`                            | Variables producción (Docker)                        |
| `docker-compose.yml`                         | Solo postgres + redis (dev sin Docker)               |
| `docker-compose.dev.yml`                     | Todo en Docker (desarrollo)                          |
| `docker-compose.prod.yml`                    | Producción con nginx + SSL                           |
| `docker/entrypoint.sh`                       | Migraciones + seed + arranque (producción)           |
| `docker/nginx.local.conf`                    | Proxy reverso + SSL                                  |
| `start-production.sh`                        | Script automático de despliegue                      |
| `docker/scripts/setup-telegram-poll-cron.sh` | Instala/desinstala cron polling Telegram (red local) |
