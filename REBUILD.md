# Guía de Despliegue y Mantenimiento

## 🚀 Comandos Rápidos

### Producción (red local con HTTPS)

```bash
# Primer despliegue o cuando cambia tu IP:
sudo ./start-production.sh

# Si solo necesitas levantar (IP no cambió):
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# Reconstruir después de cambios en código:
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# Ver logs en tiempo real:
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app

# Ver logs de todos los servicios:
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f

# Detener todo:
docker compose --env-file .env.production -f docker-compose.prod.yml down

# Detener y borrar datos (⚠️ DESTRUCTIVO):
docker compose --env-file .env.production -f docker-compose.prod.yml down -v
```

### Desarrollo local

```bash
# ─── Opción A: Solo BD + Redis (app corre con npm run dev en tu Mac) ───
docker compose up -d
npm run dev
# Acceder en: http://localhost:3000

# ─── Opción B: Todo en Docker (app + nginx + postgres + redis) ─────────
# Primera vez (instala deps + compila):
docker compose -f docker-compose.dev.yml up -d --build

# Siguientes veces (más rápido):
docker compose -f docker-compose.dev.yml up -d

# Ver logs de la app:
docker compose -f docker-compose.dev.yml logs -f app

# Acceder en: http://localhost:3000 o https://gestion.local (si tienes hosts configurado)

# Detener:
docker compose -f docker-compose.dev.yml down

# Detener y borrar datos (⚠️ DESTRUCTIVO):
docker compose -f docker-compose.dev.yml down -v
```

### Migraciones y Seed en desarrollo

```bash
# Si usas Opción A (npm run dev):
npx prisma migrate dev --name nombre_del_cambio
npx prisma db seed

# Si usas Opción B (Docker):
docker exec tickets-app-dev npx prisma migrate dev --name nombre_del_cambio
docker exec tickets-app-dev npx prisma generate
docker compose -f docker-compose.dev.yml restart app

# Seed manual:
docker exec tickets-app-dev npx prisma db seed
```

---

## 📋 Despliegue a Producción (paso a paso)

### 1. Preparar el entorno

```bash
# Copiar variables de entorno si no existen
cp .env.example .env.production  # Solo la primera vez

# Editar con tus valores reales:
# - DB_PASSWORD
# - NEXTAUTH_SECRET
# - ENCRYPTION_KEY
```

### 2. Levantar con el script automático

```bash
sudo ./start-production.sh
```

Este script hace todo automáticamente:

- Detecta tu IP actual
- Actualiza `/etc/hosts` → `gestion.local`
- Actualiza `NEXTAUTH_URL` en los archivos `.env`
- Regenera certificados SSL si la IP cambió
- Ejecuta `docker compose -f docker-compose.prod.yml up -d --build`

### 3. Ejecutar migraciones (solo primera vez o tras cambios de schema)

```bash
# Las migraciones se ejecutan automáticamente en el entrypoint.
# Si necesitas forzarlas manualmente:
docker exec tickets-app npx prisma migrate deploy
```

### 4. Ejecutar seed (solo primera vez)

```bash
docker exec tickets-app sh -c "node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts"
```

### 5. Verificar que funciona

```bash
# Estado de los contenedores:
docker compose -f docker-compose.prod.yml ps

# Deberías ver:
# tickets-postgres  (healthy)
# tickets-redis     (healthy)
# tickets-app       (healthy)
# tickets-nginx     (running)

# Probar acceso:
curl -k https://gestion.local/api/health
```

---

## 🌐 Acceso desde otros equipos de la red

Cada equipo cliente necesita agregar en su archivo hosts:

```
# Windows: C:\Windows\System32\drivers\etc\hosts
# Mac/Linux: /etc/hosts

TU_IP_ACTUAL    gestion.local www.gestion.local
```

Para ver tu IP actual:

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

---

## 🔄 Cuando cambia tu IP

```bash
sudo ./start-production.sh
```

Luego actualizar `/etc/hosts` en los equipos clientes con la nueva IP.

---

## 🗄️ Base de Datos

### Migraciones (tras cambios en prisma/schema.prisma)

```bash
# ─── Desarrollo (npm run dev) ──────────────────
npx prisma migrate dev --name nombre_del_cambio

# ─── Desarrollo (Docker) ──────────────────────
docker exec tickets-app-dev npx prisma migrate dev --name nombre_del_cambio
docker exec tickets-app-dev npx prisma generate
docker compose -f docker-compose.dev.yml restart app

# ─── Producción ────────────────────────────────
# Las migraciones se ejecutan automáticamente al iniciar el contenedor.
# Si necesitas forzar manualmente:
docker exec tickets-app npx prisma migrate deploy
docker compose --env-file .env.production -f docker-compose.prod.yml restart app
```

### Conectarse a la BD directamente

```bash
# Desarrollo (Opción A — postgres en Docker, app en host):
docker exec -it tickets-postgres psql -U tickets_user -d tickets_db

# Desarrollo (Opción B — todo en Docker):
docker exec -it tickets-postgres-dev psql -U tickets_user -d tickets_db

# Producción:
docker compose --env-file .env.production -f docker-compose.prod.yml exec postgres psql -U tickets_user -d tickets_db
```

### Backup manual

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec postgres \
  pg_dump -U tickets_user tickets_db | gzip > backup-$(date +%Y%m%d).sql.gz
```

### Restaurar backup

```bash
gunzip -c backup-YYYYMMDD.sql.gz | \
  docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  psql -U tickets_user -d tickets_db
```

---

## 🧹 Limpieza y Reconstrucción Total

⚠️ **ESTO BORRA TODOS LOS DATOS**

```bash
# ─── Desarrollo ────────────────────────────────
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d --build
docker exec tickets-app-dev npx prisma db seed

# ─── Producción ────────────────────────────────
docker compose --env-file .env.production -f docker-compose.prod.yml down -v

# Eliminar imágenes del proyecto
docker images | grep tickets | awk '{print $3}' | xargs docker rmi -f 2>/dev/null

# Limpiar caché de Docker (opcional — libera espacio)
docker system prune -a --volumes

# Reconstruir desde cero
sudo ./start-production.sh

# Ejecutar seed manualmente (si la BD está vacía se ejecuta solo)
docker exec tickets-app sh -c "node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts"
```

---

## 🔧 Solución de Problemas

### El contenedor `app` no arranca

```bash
# Ver logs detallados:
docker compose -f docker-compose.prod.yml logs app

# Causas comunes:
# - DATABASE_URL incorrecto → verificar .env.production
# - Puerto 3000 ocupado → docker ps -a
# - Error de build → reconstruir con --build --no-cache
docker compose -f docker-compose.prod.yml up -d --build --no-cache
```

### No puedo acceder a gestion.local

```bash
# 1. Verificar que resuelve:
dscacheutil -q host -a name gestion.local

# 2. Si no resuelve, ejecutar:
sudo ./start-production.sh

# 3. Verificar que nginx está corriendo:
docker compose -f docker-compose.prod.yml ps nginx

# 4. Verificar certificados:
curl -vk https://gestion.local 2>&1 | grep "SSL certificate"
```

### Error de certificado SSL en otros equipos

Los equipos clientes verán un aviso de certificado no confiable. Opciones:

1. Aceptar la excepción en el navegador (más rápido)
2. Instalar el CA de mkcert en cada equipo (más limpio):
   ```bash
   # En tu Mac, exportar el CA:
   mkcert -CAROOT  # muestra la ruta del CA
   # Copiar rootCA.pem a los equipos clientes e instalarlo
   ```

### Contenedor postgres no está healthy

```bash
# Verificar logs:
docker compose -f docker-compose.prod.yml logs postgres

# Reiniciar solo postgres:
docker compose -f docker-compose.prod.yml restart postgres

# Esperar a que esté healthy:
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U tickets_user
```

### Cron de patrullas no se ejecuta

El cron debe llamarse externamente cada 5 minutos. Opciones:

```bash
# Opción 1: crontab del host
crontab -e
# Agregar:
*/5 * * * * curl -s -H "Authorization: Bearer TU_CRON_SECRET" https://gestion.local/api/cron/patrol > /dev/null

# Opción 2: ejecutar manualmente para probar
curl -H "Authorization: Bearer TU_CRON_SECRET" https://gestion.local/api/cron/patrol
```

---

## 📁 Archivos de Configuración Importantes

| Archivo                   | Propósito                                     |
| ------------------------- | --------------------------------------------- |
| `.env.local`              | Variables para desarrollo (`npm run dev`)     |
| `.env.production`         | Variables para producción (Docker)            |
| `.env.local.production`   | Override local de producción                  |
| `docker-compose.yml`      | Solo postgres + redis (desarrollo sin Docker) |
| `docker-compose.dev.yml`  | Todo en Docker (desarrollo)                   |
| `docker-compose.prod.yml` | Producción con nginx + SSL                    |
| `docker/nginx.local.conf` | Configuración de nginx (proxy + SSL)          |
| `docker/certs/`           | Certificados SSL (generados por mkcert)       |
| `start-production.sh`     | Script automático de despliegue               |

---

## 🏗️ Arquitectura de Servicios

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
