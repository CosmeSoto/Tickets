# Instalación y Configuración

## Requisitos Previos

- Docker Desktop 4.x+
- Node.js 20+ (solo para desarrollo local sin Docker)
- Git

---

## Opción A — Docker (Recomendado)

Todo corre dentro de contenedores: PostgreSQL, Redis, Nginx y la app Next.js.

### 1. Clonar el repositorio

```bash
git clone https://github.com/CosmeSoto/Tickets.git
cd Tickets/sistema-tickets-nextjs
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Variables mínimas requeridas en `.env.local`:

```env
# Base de datos
DATABASE_URL="postgresql://tickets_user:tickets_password@localhost:5432/tickets_db"

# Redis
REDIS_URL="redis://localhost:6379"

# NextAuth
NEXTAUTH_SECRET="genera-con: openssl rand -base64 32"
NEXTAUTH_URL="https://gestion.local"

# Encriptación para claves de licencias
ENCRYPTION_KEY="genera-con: openssl rand -base64 32"
```

Para generar secrets seguros:

```bash
openssl rand -base64 32
```

### 3. Levantar servicios

```bash
docker compose -f docker-compose.dev.yml up -d
```

Esto levanta:
| Contenedor | Puerto | Descripción |
|------------|--------|-------------|
| `tickets-app-dev` | 3000 | App Next.js (Turbopack) |
| `tickets-postgres-dev` | 5432 | PostgreSQL 15 |
| `tickets-redis-dev` | 6379 | Redis 7 |
| `tickets-nginx-dev` | 443 | Nginx (HTTPS local) |

El seed se ejecuta automáticamente al iniciar. Acceder en `https://gestion.local` o `http://localhost:3000`.

### 4. Credenciales por defecto

| Rol         | Email                      | Contraseña |
| ----------- | -------------------------- | ---------- |
| Super Admin | internet.freecom@gmail.com | admin123   |

---

## Opción B — Local (sin Docker)

### 1. Instalar dependencias

```bash
npm install
```

### 2. Levantar PostgreSQL y Redis

```bash
# Solo la BD y Redis en Docker
docker compose up postgres redis -d
```

### 3. Configurar BD

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

### 4. Iniciar

```bash
npm run dev
```

---

## Variables de Entorno Completas

```env
# ── Base de datos ──────────────────────────────────────────────────────────
DATABASE_URL="postgresql://tickets_user:tickets_password@localhost:5432/tickets_db"

# ── Redis ──────────────────────────────────────────────────────────────────
REDIS_URL="redis://localhost:6379"

# ── NextAuth ───────────────────────────────────────────────────────────────
NEXTAUTH_SECRET="tu-secret-super-seguro"
NEXTAUTH_URL="https://gestion.local"

# ── Encriptación (claves de licencias) ────────────────────────────────────
ENCRYPTION_KEY="tu-encryption-key-base64"

# ── Email (opcional) ───────────────────────────────────────────────────────
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER="tu-email@gmail.com"
EMAIL_SERVER_PASSWORD="tu-app-password"
EMAIL_FROM="tu-email@gmail.com"

# ── OAuth (opcional) ───────────────────────────────────────────────────────
GOOGLE_CLIENT_ID="tu-google-client-id"
GOOGLE_CLIENT_SECRET="tu-google-client-secret"
AZURE_AD_CLIENT_ID="tu-azure-client-id"
AZURE_AD_CLIENT_SECRET="tu-azure-client-secret"
AZURE_AD_TENANT_ID="common"

# ── Logs ───────────────────────────────────────────────────────────────────
LOG_LEVEL="ERROR"
NEXT_PUBLIC_LOG_LEVEL="ERROR"
NODE_ENV="development"
```

---

## Comandos de Referencia

### Desarrollo diario

```bash
# Iniciar (si ya está construido)
docker compose -f docker-compose.dev.yml up -d

# Ver logs
docker compose -f docker-compose.dev.yml logs -f app

# Reiniciar solo la app
docker restart tickets-app-dev

# Detener todo
docker compose -f docker-compose.dev.yml down
```

### Prisma (dentro del contenedor)

```bash
# Crear migración
docker exec tickets-app-dev npx prisma migrate dev --name descripcion

# Aplicar migraciones existentes
docker exec tickets-app-dev npx prisma migrate deploy

# Regenerar cliente (después de cambiar schema)
docker exec tickets-app-dev npx prisma generate

# Seed (seguro repetirlo)
docker exec tickets-app-dev npm run db:seed

# Reset completo de BD
docker exec tickets-app-dev npm run db:reset
```

### Redis

```bash
# Ver claves en caché
docker exec tickets-redis-dev redis-cli KEYS "*"

# Ver estadísticas de hits/misses
docker exec tickets-redis-dev redis-cli INFO stats | grep keyspace

# Limpiar caché completo
docker exec tickets-redis-dev redis-cli FLUSHALL
```

### Git (trabajo en múltiples equipos)

```bash
# Al llegar a otro equipo
git pull origin main
npm install          # si hubo cambios en package.json
# Reiniciar Docker para tomar cambios de código
docker restart tickets-app-dev
```

---

## Solución de Problemas Comunes

### La app no arranca

```bash
# Ver logs detallados
docker compose -f docker-compose.dev.yml logs app

# Reconstruir desde cero
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up --build -d
```

### Error de Prisma "Table does not exist"

```bash
docker exec tickets-app-dev npx prisma migrate deploy
docker exec tickets-app-dev npx prisma generate
docker restart tickets-app-dev
```

### Redis no conecta

```bash
# Verificar que Redis está corriendo
docker exec tickets-redis-dev redis-cli ping
# Debe responder: PONG
```

### Cambios de código no se reflejan

```bash
# Turbopack debería detectarlos automáticamente
# Si no, reiniciar la app
docker restart tickets-app-dev
```

Ver [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) para más casos.
