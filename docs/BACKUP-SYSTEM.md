# Sistema de Respaldos — Arquitectura y Recuperación ante Desastres

Documento de referencia para operación, desarrollo y DR (Disaster Recovery).

## Resumen ejecutivo

| Capa                | Responsabilidad                                       | Herramienta             |
| ------------------- | ----------------------------------------------------- | ----------------------- |
| **Infraestructura** | Respaldos automáticos, incrementales, WAL, PITR       | pgBackRest              |
| **Aplicación**      | Orquestación, UI, auditoría, exportaciones portátiles | Next.js + backup-worker |
| **Exportación**     | Archivo `.dump` descargable para migración            | pg_dump (bajo demanda)  |
| **Importación**     | Cargar respaldos externos legacy                      | pg_restore / JSON       |

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin UI (/admin/backups)                                      │
│  Dashboard · Historial · Restaurar · Config · Monitoreo         │
└────────────────────────────┬────────────────────────────────────┘
                             │ API REST
┌────────────────────────────▼────────────────────────────────────┐
│  App (Next.js) — orquestación                                   │
│  · Registra respaldos en tabla `backups`                        │
│  · Notificaciones, cifrado de exports, cloud upload             │
└────────────┬───────────────────────────────┬────────────────────┘
             │ HTTP (BACKUP_WORKER_URL)        │ pg_dump (exports)
┌────────────▼──────────────┐    ┌────────────▼──────────────────┐
│  backup-worker            │    │  BACKUP_DIR (exports .dump)   │
│  pgbackrest backup/info   │    │  Volumen app_backups          │
│  pgbackrest restore       │    └───────────────────────────────┘
└────────────┬──────────────┘
             │
┌────────────▼──────────────────────────────────────────────────┐
│  PostgreSQL 17 + pgBackRest (WAL archiving)                     │
│  postgres_data  ←→  pgbackrest_repo                             │
└─────────────────────────────────────────────────────────────────┘
```

## Tipos de respaldo

| `engine`     | `backupKind` | Uso                            | Restauración                 |
| ------------ | ------------ | ------------------------------ | ---------------------------- |
| `pgbackrest` | `full`       | Base semanal / manual completo | DR vía pgBackRest (UI o CLI) |
| `pgbackrest` | `diff`       | Diario diferencial             | DR vía pgBackRest            |
| `pgbackrest` | `incr`       | Incremental opcional           | DR vía pgBackRest            |
| `export`     | `export`     | Descarga / migración / nube    | UI: pg_restore               |
| `import`     | `export`     | Archivo subido externamente    | UI: pg_restore / JSON        |

## Política de retención (pgBackRest)

Configurada en `docker/pgbackrest/pgbackrest.conf`:

- **Full:** 2 copias (`repo1-retention-full=2`)
- **Differential:** 7 copias (`repo1-retention-diff=7`)
- **Compresión:** zstd nivel 3

La app sincroniza el historial en la tabla `backups` para la UI; pgBackRest es la fuente de verdad del repositorio.

## Escenarios de desastre

### Escenario 1 — Corrupción de datos (error humano, DELETE masivo)

**Objetivo:** Volver a un punto en el tiempo antes del incidente.

**Opción A — PITR (requiere WAL archiving activo):**

```bash
# 1. Modo mantenimiento — detener app
docker compose -f docker-compose.prod.yml --env-file .env.production stop app nginx

# 2. Restaurar al timestamp (UTC) antes del incidente
./docker/scripts/disaster-recovery.sh pitr "2026-07-08 14:30:00"

# 3. Reiniciar servicios
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

**Opción B — Restaurar último diff/full:**

Desde UI: **Restaurar → Respaldos pgBackRest → Seleccionar set → Restauración completa**

O CLI:

```bash
./docker/scripts/disaster-recovery.sh restore --set 20260708-120000F
```

### Escenario 2 — Pérdida total del contenedor PostgreSQL

```bash
# 1. Recrear volúmenes si postgres_data se perdió
docker compose -f docker-compose.prod.yml --env-file .env.production down
# pgbackrest_repo debe seguir intacto

# 2. Restaurar data directory desde repositorio
./docker/scripts/disaster-recovery.sh restore --latest

# 3. Levantar stack
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Escenario 3 — Migración a nuevo servidor

1. Copiar volumen `pgbackrest_repo` al nuevo host
2. Copiar `docker/pgbackrest/pgbackrest.conf`
3. Ejecutar `disaster-recovery.sh restore --latest`
4. Levantar compose con `.env.production` actualizado

**Alternativa portable:** Crear **Exportación** desde UI → descargar `.dump` → importar en destino.

### Escenario 4 — Solo necesito un módulo (tickets, usuarios…)

pgBackRest restaura el **cluster completo**. Para restauración parcial:

1. Crear **Exportación** del respaldo deseado (o usar uno existente)
2. UI → Restaurar → seleccionar módulos → modo merge/replace

### Escenario 5 — Repositorio pgBackRest corrupto

1. Verificar: `docker compose exec backup-worker pgbackrest check --stanza=main`
2. Si falla: restaurar desde copia off-site del volumen `pgbackrest_repo`
3. Fallback: usar última **Exportación** en nube/local

## Checklist operativo

### Diario (automático)

- [ ] Cron del servidor llama `POST /api/admin/cron/backup` (`./docker/scripts/setup-backup-cron.sh`)
- [ ] Revisar pestaña **Monitoreo** — estado pgBackRest verde
- [ ] Dashboard → **Guía de auditoría** — checklist en verde

### Semanal

- [ ] Verificar espacio en `pgbackrest_repo` y `app_backups`
- [ ] Ejecutar `pgbackrest verify --stanza=main` (via script o UI health)
- [ ] Exportar informe JSON desde Admin → Backups → Dashboard

### Mensual (prueba de DR y auditoría)

- [ ] Crear **Export .dump**, descargarlo y guardarlo fuera del servidor
- [ ] Ejecutar `disaster-recovery.sh check` y archivar salida
- [ ] Restaurar export a entorno de prueba
- [ ] Copia off-site del volumen `pgbackrest_repo` (rsync/NAS)
- [ ] Documentar tiempo de recuperación (RTO/RPO)

## Variables de entorno

| Variable                | Descripción                                                                       |
| ----------------------- | --------------------------------------------------------------------------------- |
| `BACKUP_WORKER_URL`     | URL interna del worker (ej. `http://backup-worker:8080`)                          |
| `BACKUP_WORKER_SECRET`  | Token Bearer para API del worker                                                  |
| `PGBACKREST_STANZA`     | Nombre del stanza (default: `main`)                                               |
| `BACKUP_DIR`            | Exports portátiles (`/app/backups`)                                               |
| `BACKUP_ENCRYPTION_KEY` | Cifrado AES de exports (opcional)                                                 |
| `BACKUP_ALLOW_RESTORE`  | Legacy/informativo en worker health — usar Config → Restauración pgBackRest en UI |

## Desarrollo local

- **Con Docker completo:** pgBackRest activo igual que producción
- **Solo BD + app en host:** exports via pg_dump; pgBackRest deshabilitado (health lo indica)

## Límites conocidos

- Restauración pgBackRest requiere **modo mantenimiento** (app detenida)
- PITR depende de WAL archiving continuo
- Cloud upload (Drive/OneDrive) aplica solo a **exports**, no al repositorio pgBackRest
- Copia off-site del repo pgBackRest es responsabilidad operativa (rsync, S3, etc.)
