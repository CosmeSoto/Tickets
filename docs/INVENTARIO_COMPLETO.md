# 📋 Documento Completo del Sistema

## 1. Descripción General

Sistema profesional multi-módulo para gestión de tickets de soporte, inventario, contratos, rondas de patrullaje y base de conocimientos. Construido con Next.js 16 y PostgreSQL, con caché Redis de alto rendimiento.

---

## 2. Stack Tecnológico Completo

| **Capa**             | **Tecnologías**                                                                |
| -------------------- | ------------------------------------------------------------------------------ |
| **Frontend**         | React 19.2.3, Next.js 16.1.1 (App Router), Tailwind CSS 3, Shadcn/UI, Radix UI |
| **Backend**          | Next.js API Routes, TypeScript 5, Node.js 20 (Alpine)                          |
| **Base de Datos**    | PostgreSQL 15/17 (Alpine)                                                      |
| **ORM**              | Prisma 5.22                                                                    |
| **Caché**            | Redis 7 (Alpine) + ioredis                                                     |
| **Autenticación**    | NextAuth.js 4, JWT, OAuth 2.0 (Google, Microsoft Azure)                        |
| **Validación**       | Zod 3                                                                          |
| **State Management** | Zustand 5, React Query 5                                                       |
| **UI Components**    | Lucide Icons, Recharts, Framer Motion, React Window                            |
| **Contenerización**  | Docker + Docker Compose                                                        |
| **Proxy**            | Nginx (Alpine) - HTTPS, HTTP/2, Gzip, Rate Limiting                            |
| **Testing**          | Jest, Playwright                                                               |

---

## 3. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 Cliente front Web                                      │docker
│                        (Browser / Aplicación Móvil)                              │
└───────────────────────────────────┬─────────────────────────────────────────────┘
                                    │ HTTPS / WSS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Nginx (Proxy Reverso)   Public                               │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ • Puerto 80 → Redirige a HTTPS                                             │  │
│  │ • Puerto 443 → SSL + HTTP/2                                                │  │
│  │ • Gzip Compression                                                         │  │
│  │ • Rate Limiting (30 req/seg API, 3 req/seg Login)                         │  │
│  │ • Cache de archivos estáticos (_next, uploads)                             │  │
│  │ • Health Check endpoint /health                                            │  │
│  └───────────────────────────────────┬───────────────────────────────────────┘  │
└───────────────────────────────────────┼──────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Next.js App  (:3000)  docker                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ • App Router (Server Components + Client Components)                      │  │
│  │ • API Routes (REST)                                                       │  │
│  │ • React Query Cache (Cliente)                                             │  │
│  │ • Server-Sent Events (Notificaciones en tiempo real)                     │  │
│  └───────────────────────────────────┬───────────────────────────────────────┘  │
└───────────────────────────────────────┼──────────────────────────────────────────┘
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
┌───────────────────────────┐ ┌───────────────────┐ ┌───────────────────────┐
│  PostgreSQL 15/17         │ │  Redis 7          │ │  Volúmenes Docker     │
│  (:5432)                  │ │  (:6379)          │ │  (uploads, backups)   │ fuera de docker y configurar paraproduccion
│  ┌─────────────────────┐  │ │  ┌─────────────┐  │ └───────────────────────┘
│  │ • ~70 Modelos      │  │ │  │ • Caché     │  │
│  │ • Índices múltiples│  │ │  • Rate Limit │  │
│  │ • Prisma Client    │  │ │  • Sesiones   │  │
│  └─────────────────────┘  │ └──────────────┘  │
└───────────────────────────┘ └───────────────────┘
```

---

## 4. Componentes Principales

### 4.1 Proxy Reverso: Nginx

**Archivo:** `docker/nginx.conf`

| **Característica** | **Detalles**                                                                      |
| ------------------ | --------------------------------------------------------------------------------- |
| **SSL/TLS**        | Certificados (mkcert para desarrollo local), TLS 1.2/1.3, HSTS (max-age 63072000) |
| **Compresión**     | Gzip activado para text/plain, text/css, application/json, etc.                   |
| **Rate Limiting**  | - API: 30 req/segundo (burst 50)<br>- Login: 3 req/segundo (burst 5)              |
| **Caché**          | - Archivos estáticos (\_next/static): 1 año<br>- Uploads: 1 año                   |
| **Proxy**          | HTTP/1.1, Upgrade para WebSockets/SSE, timeouts extendidos                        |
| **Health Check**   | `/health` → 200 "healthy"                                                         |

### 4.2 Aplicación: Next.js 16

**Archivos clave:**

- `next.config.ts` - Configuración de Next.js
- `Dockerfile` - Build multi-stage optimizado
- `src/app/` - App Router (Server + Client Components)

**Configuración de Rendimiento (`next.config.ts`):**
| **Optimización** | **Detalles** |
|---------------------------|---------------------------------------------------------------------------------|
| **Modo Standalone** | `output: 'standalone'` → Imagen Docker mínima |
| **Turbopack** | Resolución de módulos optimizada |
| **Optimizacion de CSS** | `experimental.optimizeCss: true` |
| **Optimizacion de Imports**| `optimizePackageImports` para Lucide, Radix UI, Recharts, Date-fns |
| **Imágenes** | Formatos WebP/AVIF, TTL 1 año, CDN configurable |
| **Headers** | Cache-Control, X-Frame-Options, X-Content-Type-Options, HSTS |
| **Asset Prefix** | CDN compatible (variables `CDN_ENABLED`, `CDN_BASE_URL`) |

**Build Docker (Multi-Stage):**

1. **Stage 1 (deps):** Instala dependencias (npm ci)
2. **Stage 2 (builder):** Genera Prisma Client → Compila Next.js
3. **Stage 3 (runner):** Imagen mínima (Node.js Alpine) con solo lo necesario

### 4.3 Caché: Redis 7

**Archivos clave:**

- `src/lib/cache/redis-cache.ts` - Implementación principal
- `src/lib/cache.ts` - Servicio avanzado con estadísticas
- `src/services/cached-services.ts` - Decoradores y patrones de caché
- `docker/redis.conf` - Configuración Redis

**Arquitectura de 3 Capas:**

```
Request Browser
    ↓
L1: Browser Cache (Cache-Control header) → 0ms
    ↓ (si expiró)
L2: Redis → ~1ms
    ↓ (si expiró)
L3: PostgreSQL → 100-900ms
```

**Clases y Métodos Principales:**

| **Clase/Patrón**     | **Descripción**                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `RedisCache`         | Métodos: `get()`, `set()`, `del()`, `delPattern()`, `wrap()`, `isAvailable()`             |
| `CacheService`       | Estadísticas (hits/misses/sets/errors), tags para invalidación, multi-level               |
| `@Cache()`           | Decorador para métodos → Cacha automática                                                 |
| `@InvalidateCache()` | Decorador → Invalida caché por tags                                                       |
| `CachePatterns`      | - `cacheWithRefresh()` → Refresh en background<br>- `multiLevelCache()` → Memoria + Redis |

**TTLs Predefinidos (`CacheTTL`):**

- SHORT: 2 min
- MEDIUM: 5 min
- LONG: 15 min
- VERY_LONG: 30 min
- HOUR: 60 min

**Rate Limiting con Redis:**
Distribuido, funciona en múltiples instancias → `INCR` + `EXPIRE`

### 4.4 Base de Datos: PostgreSQL 15/17

**Archivo:** `prisma/schema.prisma` (~860 líneas, ~70 modelos)

**Modelos Principales:**
| **Módulo** | **Modelos** |
|---------------------------|---------------------------------------------------------------------------------|
| **Tickets** | `tickets`, `categories`, `comments`, `attachments`, `ticket_history`, `ticket_ratings`, `sla_policies`, `sla_violations` |
| **Inventario** | `equipment`, `software_licenses`, `consumables`, `stock_movements`, `equipment_assignments`, `warehouses`, `suppliers`, `contracts` |
| **Usuarios y Seguridad** | `users`, `departments`, `families`, `sessions`, `accounts`, `oauth_configs`, `audit_logs` |
| **Notificaciones** | `notifications`, `notification_preferences`, `email_queue` |
| **Base de Conocimientos** | `knowledge_articles`, `article_votes`, `ticket_knowledge_articles` |
| **Rondas** | `patrols`, `patrol_schedules`, `patrol_check_ins`, `patrol_family_configs` |
| **Webhooks** | `webhooks`, `webhook_logs` |

**Índices Optimizados:**
Múltiples índices compuestos por:

- `status`, `createdAt`
- `clientId`, `status`
- `categoryId`, `isActive`
- `userId`, `isRead`, `createdAt`
- etc.

---

## 5. Docker y Contenerización

### 5.1 Servicios (Docker Compose)

| **Archivo**               | **Servicios**                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `docker-compose.yml`      | - `postgres` (:5432)<br>- `redis` (:6379)                                             |
| `docker-compose.dev.yml`  | - `postgres`<br>- `redis`<br>- `app` (:3000)<br>- `nginx` (:80/:443)                  |
| `docker-compose.prod.yml` | - `postgres` (17-alpine)<br>- `redis` (7-alpine)<br>- `app` (standalone)<br>- `nginx` |

### 5.2 Volúmenes Persistentes

| **Volumen**     | **Uso**                                         |
| --------------- | ----------------------------------------------- |
| `postgres_data` | Datos de PostgreSQL                             |
| `redis_data`    | Datos de Redis (persistencia RDB)               |
| `app_uploads`   | Archivos subidos (compartido entre app y nginx) |
| `app_logs`      | Logs de la aplicación                           |
| `app_backups`   | Backups de la base de datos                     |

### 5.3 Networks

- `tickets-network`: Driver `bridge` para comunicación entre contenedores

---

## 6. Módulos del Sistema

| **Módulo**            | **Características Principales**                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **🎫 Tickets**        | Estados, prioridades, SLA, categorías jerárquicas, comentarios, adjuntos, colaboradores, base de conocimientos, reportes |
| **📦 Inventario**     | Equipos (QR), licencias (encriptadas), consumibles (stock), contratos, actas digitales, proveedores, reportes            |
| **👥 Usuarios**       | Roles (SUPER_ADMIN/ADMIN/TECHNICIAN/CLIENT), familias, departamentos, permisos por módulo                                |
| **🔔 Notificaciones** | In-app (SSE), email (cola + reintentos), notificaciones navegador, alertas automáticas                                   |
| **🏠 Landing Page**   | CMS configurable (hero, servicios, banners)                                                                              |
| **⚙️ Configuración**  | Global, por familia, por usuario; OAuth (Google/Microsoft); SMTP                                                         |

---

## 7. Seguridad

| **Aspecto**       | **Medidas**                                                          |
| ----------------- | -------------------------------------------------------------------- |
| **Autenticación** | JWT, NextAuth.js, OAuth 2.0, verificación de email                   |
| **Autorización**  | Control por rol + familia asignada                                   |
| **Rate Limiting** | Distribuido con Redis (30 req/seg API, 3 req/seg Login)              |
| **Auditoría**     | `audit_logs` - Todas las acciones con usuario, IP, User-Agent        |
| **Encriptación**  | Claves de licencias, credenciales OAuth                              |
| **Headers**       | X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, HSTS, CSP |
| **Backup**        | Backups cifrados y comprimidos                                       |

---

## 8. Variables de Entorno (.env.example)

| **Variable**            | **Descripción**                    |
| ----------------------- | ---------------------------------- |
| `DATABASE_URL`          | Connection string PostgreSQL       |
| `REDIS_URL`             | Connection string Redis            |
| `NEXTAUTH_URL`          | URL del servidor para NextAuth     |
| `NEXTAUTH_SECRET`       | Secret para JWT                    |
| `ENCRYPTION_KEY`        | Key para encriptar credenciales    |
| `BACKUP_ENCRYPTION_KEY` | Key para cifrar backups            |
| `DB_PASSWORD`           | Contraseña PostgreSQL (producción) |
| `CDN_ENABLED`           | Activar CDN (true/false)           |
| `CDN_BASE_URL`          | URL del CDN                        |
| `SMTP_*`                | Configuración de email             |
| `GOOGLE_*`, `AZURE_*`   | Credenciales OAuth                 |

---

## 9. Comandos Útiles

| **Acción**          | **Comando**                                                                    |
| ------------------- | ------------------------------------------------------------------------------ |
| Dev (Docker)        | `docker compose -f docker-compose.dev.yml up --build`                          |
| Prod (Docker)       | `docker compose -f docker-compose.prod.yml up --build -d`                      |
| Migrar BD           | `docker exec tickets-app npx prisma migrate deploy`                            |
| Seed BD             | `docker exec tickets-app npm run db:seed`                                      |
| Backup BD           | `docker exec tickets-postgres pg_dump -U tickets_user tickets_db > backup.sql` |
| Logs en tiempo real | `docker compose -f docker-compose.prod.yml logs -f app`                        |
| Limpiar caché Redis | `docker exec tickets-redis redis-cli FLUSHALL`                                 |

---

## 10. Documentación Adicional

| **Documento**            | **Ubicación**                      |
| ------------------------ | ---------------------------------- |
| SETUP                    | `docs/SETUP.md`                    |
| DEPLOYMENT               | `docs/DEPLOYMENT.md`               |
| DATABASE                 | `docs/DATABASE.md`                 |
| MANUAL_TICKETS           | `docs/MANUAL_TICKETS.md`           |
| OAUTH_SETUP_GUIDE        | `docs/OAUTH_SETUP_GUIDE.md`        |
| GUIA_CONFIGURACION_EMAIL | `docs/GUIA_CONFIGURACION_EMAIL.md` |
