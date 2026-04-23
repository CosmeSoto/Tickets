# Sistema de Gestión — Tickets e Inventario

Sistema profesional multi-módulo con gestión de tickets, inventario, contratos, base de conocimientos, notificaciones en tiempo real y caché Redis de alto rendimiento.

## 🚀 Inicio Rápido (Docker — Desarrollo)

```bash
# Clonar repositorio
git clone https://github.com/CosmeSoto/Tickets.git
cd Tickets/sistema-tickets-nextjs

# Configurar entorno
cp .env.example .env.local
# Editar .env.local con tus valores (ver docs/SETUP.md)

# Levantar todos los servicios (PostgreSQL + Redis + App)
docker compose -f docker-compose.dev.yml up -d

# Acceder
https://gestion.local  (o http://localhost:3000)
```

## 👤 Credenciales por Defecto

```
Email:     internet.freecom@gmail.com
Contraseña: admin123
```

---

## 🐳 Referencia Docker

### Desarrollo (`docker-compose.dev.yml`)

| Situación                           | Comando                                                         |
| ----------------------------------- | --------------------------------------------------------------- |
| Trabajo diario                      | `docker compose -f docker-compose.dev.yml up -d`                |
| Primera vez / cambios en Dockerfile | `docker compose -f docker-compose.dev.yml up --build`           |
| Cambios en .env                     | `docker compose -f docker-compose.dev.yml restart app`          |
| Reiniciar app                       | `docker restart tickets-app-dev`                                |
| Problemas de caché de dependencias  | `docker compose -f docker-compose.dev.yml build --no-cache app` |
| Limpieza total (borra BD)           | `docker compose -f docker-compose.dev.yml down -v`              |
| Ver logs en tiempo real             | `docker compose -f docker-compose.dev.yml logs -f app`          |
| Borrar caché de Next.js             | `docker exec tickets-app-dev rm -rf /app/.next`                 |

### Producción (`docker-compose.prod.yml`)

```bash
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml down
```

---

## 🗄️ Prisma dentro de Docker

> El volumen `dev_node_modules` es independiente del host. Siempre que modifiques
> `schema.prisma` hay que regenerar el cliente **dentro del contenedor**.

```bash
# Crear migración
docker exec tickets-app-dev npx prisma migrate dev --name nombre_migracion

# Regenerar cliente Prisma
docker exec tickets-app-dev npx prisma generate

# Reiniciar app
docker compose -f docker-compose.dev.yml restart app

# Seed (seguro repetirlo — usa upsert)
docker exec tickets-app-dev npm run db:seed
```

---

## ✨ Módulos del Sistema

### 🎫 Tickets

- Gestión completa con estados: OPEN → IN_PROGRESS → RESOLVED → CLOSED
- SLA automático con 4 niveles de prioridad (Urgent, High, Medium, Low)
- Asignación automática y manual a técnicos
- Categorías jerárquicas (hasta 4 niveles) con sugerencias inteligentes
- Comentarios, adjuntos y timeline de actividad
- Colaboradores en tickets
- Base de conocimientos integrada (artículos desde tickets resueltos)
- Reportes y métricas (tiempo de respuesta, SLA compliance, carga por técnico)
- Exportación CSV / Excel / PDF

### 📦 Inventario

- **Equipos**: registro con código único, QR, historial de asignaciones y mantenimientos
- **Licencias**: claves encriptadas, control de vencimiento con alertas automáticas
- **Consumibles**: control de stock con movimientos (entrada/salida/ajuste), alertas de stock bajo
- **Contratos**: gestión de contratos de servicio con líneas y adjuntos
- **Actas digitales**: entrega, devolución y baja con folio secuencial y PDF
- **Configuración por área**: tipos de activos, secciones del formulario y reglas por familia
- **Proveedores**: CRUD completo con tipos y asignación por familia
- Catálogos dinámicos (tipos de equipo, licencia, consumible, unidades de medida)
- Reportes de inventario con exportación

### 👥 Usuarios y Familias

- Roles: SUPER_ADMIN, ADMIN, TECHNICIAN, CLIENT
- Gestión de inventario delegada a gestores (`canManageInventory`)
- Familias (áreas) con departamentos, técnicos asignados y gestores
- Configuración de tickets e inventario por familia
- Exportación de usuarios con filtros activos

### 🔔 Notificaciones

- In-app en tiempo real (SSE — Server-Sent Events)
- Email con cola y reintentos automáticos
- Notificaciones nativas del navegador
- Alertas automáticas: stock bajo, licencias por vencer, contratos por vencer, garantías

### 🏠 Landing Page (CMS)

- Página pública configurable desde el panel admin
- Hero, servicios, banners — sin tocar código

### ⚙️ Configuración

- Configuración global del sistema (SMTP, SLA, timeouts, tamaño de archivos)
- Configuración de tickets por familia (categorías habilitadas, reglas)
- Configuración de inventario por familia (subtipos, secciones del formulario, depreciación)
- Preferencias de notificación por usuario
- OAuth (Google, Microsoft)

---

## 🛠️ Stack Tecnológico

| Capa          | Tecnología                                        |
| ------------- | ------------------------------------------------- |
| Framework     | Next.js 16.1.1 (App Router, Turbopack)            |
| Lenguaje      | TypeScript 5                                      |
| UI            | React 19, Tailwind CSS, Shadcn/UI, Radix UI       |
| ORM           | Prisma 6                                          |
| Base de datos | PostgreSQL 15                                     |
| Caché         | Redis 7 (3 capas: browser → Redis → DB)           |
| Autenticación | NextAuth.js (JWT + OAuth Google/Microsoft)        |
| Tiempo real   | SSE (Server-Sent Events)                          |
| Validación    | Zod                                               |
| Gráficas      | Recharts                                          |
| Exportación   | CSV, Excel (xlsx), PDF (jsPDF)                    |
| Contenedores  | Docker + Docker Compose                           |
| Proxy         | Nginx (HTTPS local con certificados autofirmados) |

---

## ⚡ Arquitectura de Caché (Redis)

El sistema usa caché en 3 capas para máximo rendimiento:

```
Request del browser
    ↓
L1: Cache-Control header (browser) → 0ms, sin llegar al servidor
    ↓ (si expiró)
L2: Redis (withCache) → ~1ms, sin query a DB
    ↓ (si expiró)
L3: PostgreSQL (Prisma) → 100-900ms
```

**Endpoints cacheados y sus TTLs:**

| Endpoint                      | Redis TTL | Browser TTL          |
| ----------------------------- | --------- | -------------------- |
| `/api/public/landing-page`    | 30 min    | 30 min (public)      |
| `/api/config/session-timeout` | 10 min    | 10 min (public)      |
| `/api/families`               | 5 min     | 1 min (private, swr) |
| `/api/departments`            | 5 min     | 1 min (private, swr) |
| `/api/categories`             | 3 min     | —                    |
| `/api/users`                  | 2 min     | —                    |
| `/api/admin/settings`         | 5 min     | 2 min (private, swr) |
| `/api/user/settings`          | 3 min     | 1 min (private, swr) |
| `/api/inventory/families`     | 5 min     | —                    |
| JWT callback (auth)           | 2 min     | —                    |
| `canManageInventory`          | 5 min     | —                    |
| Audit stats/logs              | 1-2 min   | —                    |

**Rate limiting:** Redis distribuido (`INCR + EXPIRE`) — funciona en múltiples instancias.

---

## 📁 Estructura del Proyecto

```
sistema-tickets-nextjs/
├── src/
│   ├── app/
│   │   ├── admin/          # Panel administrador
│   │   ├── (dashboard)/    # Módulos autenticados (inventario, settings)
│   │   ├── technician/     # Panel técnico
│   │   ├── client/         # Portal cliente
│   │   └── api/            # API Routes (REST)
│   ├── components/
│   │   ├── common/         # Componentes compartidos (DataTable, ModuleLayout)
│   │   ├── inventory/      # Componentes de inventario
│   │   ├── tickets/        # Componentes de tickets
│   │   ├── users/          # Componentes de usuarios
│   │   └── ui/             # Primitivos UI (Shadcn)
│   ├── lib/
│   │   ├── api-cache.ts    # Helpers de caché Redis (withCache, createModuleCache)
│   │   ├── auth.ts         # Configuración NextAuth
│   │   ├── prisma.ts       # Cliente Prisma singleton
│   │   ├── rate-limit.ts   # Rate limiting Redis distribuido
│   │   └── utils/          # ticket-utils, inventory-utils, export
│   ├── hooks/              # React hooks (useFetch, useExport, useUsers...)
│   └── contexts/           # Contextos globales (families, departments, users)
├── prisma/
│   ├── schema.prisma       # Esquema de BD (~70 modelos)
│   ├── migrations/         # Migraciones SQL
│   └── seed.ts             # Datos iniciales
├── docs/                   # Documentación detallada
├── docker/                 # nginx.conf, redis.conf, entrypoint.sh
└── docker-compose.dev.yml  # Entorno de desarrollo
```

---

## 📊 Políticas de SLA por Defecto

| Prioridad | Respuesta | Resolución | Horario |
| --------- | --------- | ---------- | ------- |
| URGENT    | 1h        | 4h         | 24/7    |
| HIGH      | 4h        | 24h        | Laboral |
| MEDIUM    | 8h        | 48h        | Laboral |
| LOW       | 24h       | 72h        | Laboral |

---

## 🔐 Seguridad

- JWT con refresco de permisos cacheado (2 min TTL)
- Rate limiting distribuido por usuario/IP
- Control de acceso por rol + familia asignada
- Auditoría completa de todas las acciones
- Bloqueo de cuenta por intentos fallidos
- Encriptación de claves de licencias
- Headers de seguridad (X-Frame-Options, X-Content-Type-Options)

---

## 📚 Documentación

| Documento                                                         | Descripción                           |
| ----------------------------------------------------------------- | ------------------------------------- |
| [SETUP.md](./docs/SETUP.md)                                       | Instalación y configuración inicial   |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md)                             | Despliegue en producción              |
| [FEATURES.md](./docs/FEATURES.md)                                 | Características detalladas por módulo |
| [DATABASE.md](./docs/DATABASE.md)                                 | Esquema de base de datos              |
| [MANUAL_TICKETS.md](./docs/MANUAL_TICKETS.md)                     | Manual de uso por rol                 |
| [OAUTH_SETUP_GUIDE.md](./docs/OAUTH_SETUP_GUIDE.md)               | Configuración Google/Microsoft        |
| [GUIA_CONFIGURACION_EMAIL.md](./docs/GUIA_CONFIGURACION_EMAIL.md) | Configuración SMTP                    |
| [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)                   | Solución de problemas comunes         |

---

## 🔧 Comandos de Desarrollo

```bash
npm run dev          # Servidor de desarrollo (Turbopack)
npm run build        # Build de producción
npm run lint         # ESLint
npm run db:seed      # Cargar datos iniciales
npm run db:reset     # Reset completo de BD + seed
```

---

## 📝 Licencia

MIT
