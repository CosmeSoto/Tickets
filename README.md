# Sistema de Tickets de Soporte

Sistema profesional de gestión de tickets con SLA, notificaciones, reportes, inventario y base de conocimientos.

## 🚀 Inicio Rápido

```bash
# Clonar repositorio
git clone https://github.com/CosmeSoto/Tickets.git
cd Tickets

# Configurar entorno
cp .env.example .env
# Editar .env con tus valores reales (ver docs/SETUP.md)

# Levantar PostgreSQL y Redis con Docker
docker-compose up -d

# Instalar dependencias
npm install

# Generar cliente Prisma y sincronizar BD
npx prisma generate
npx prisma db push

# Cargar datos iniciales
npm run db:seed

# Iniciar en desarrollo
npm run dev

# Acceder
http://localhost:3000
```

# Comandos de referencia

## Git
```bash
git status                                      # Ver archivos modificados
git add .                                       # Preparar todos los cambios
git commit -m "descripción del cambio"          # Guardar cambios
git push origin main                            # Subir a GitHub
git pull origin main                            # Bajar cambios de GitHub
git checkout main                               # Cambiar a rama main
```

## Docker — Desarrollo (docker-compose.dev.yml)

| Situación | Comando |
|-----------|---------|
| **Trabajo diario** (ya está corriendo) | `docker compose -f docker-compose.dev.yml up -d` |
| **Primera vez o cambios en Dockerfile/deps** | `docker compose -f docker-compose.dev.yml up --build` |
| **Cambios en .env o config** (sin rebuild) | `docker compose -f docker-compose.dev.yml restart app` |
| **Cambios en schema.prisma** | Ver sección Prisma abajo |
| **Problemas de caché en dependencias** | `docker compose -f docker-compose.dev.yml build --no-cache app` |
| **Limpieza total** (borra volúmenes y BD) | `docker compose -f docker-compose.dev.yml down -v` |
| **Ver logs en tiempo real** | `docker compose -f docker-compose.dev.yml logs -f app` |
| **Borrar caché de Next.js** | `docker exec tickets-app-dev rm -rf /app/.next` |

## Prisma dentro de Docker ⚠️

> El volumen `dev_node_modules` es independiente del host. Siempre que modifiques
> `schema.prisma` hay que regenerar el cliente **dentro del contenedor** y reiniciar.

```bash
# 1. Aplicar migración o push del schema
docker exec tickets-app-dev npx prisma migrate dev --name nombre_migracion
# o si no usas migraciones:
docker exec tickets-app-dev npx prisma db push

# 2. Regenerar el cliente Prisma dentro del contenedor
docker exec tickets-app-dev npx prisma generate

# 3. Reiniciar la app para que tome el nuevo cliente
docker compose -f docker-compose.dev.yml restart app

# Ejecutar seed (es seguro repetirlo — usa upsert, no duplica datos)
docker exec tickets-app-dev npm run db:seed
```

sudo bash sistema-tickets-nextjs/scripts/setup-domain-mac.sh

## Docker — Producción (docker-compose.prod.yml)

```bash
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml down
```
## 👤 Credenciales por Defecto

```
Email: internet.freecom@gmail.com
Contraseña: admin123
```

## ✨ Características Principales

### Sistema de Tickets

- ✅ Gestión completa de tickets
- ✅ Sistema de SLA automático
- ✅ Notificaciones (Email, Teams, In-App)
- ✅ Reportes y métricas avanzadas
- ✅ Base de conocimientos (CMS)
- ✅ Auditoría completa
- ✅ Multi-departamento
- ✅ Categorías jerárquicas con sugerencias inteligentes
- ✅ API REST

### Módulo de Inventario

- ✅ Gestión de equipos (laptops, desktops, impresoras, etc.)
- ✅ Asignación de equipos a usuarios
- ✅ Actas de entrega digitales con firma electrónica
- ✅ Actas de devolución
- ✅ Códigos QR para identificación rápida
- ✅ Historial completo de asignaciones
- ✅ Registro de mantenimientos
- ✅ Gestión de licencias de software (encriptadas)
- ✅ Control de consumibles y stock
- ✅ Reportes de inventario
- ✅ Vinculación de tickets con equipos

## 📚 Documentación

- [Instalación y Configuración](./docs/SETUP.md)
- [Despliegue con Docker](./docs/DEPLOYMENT.md)
- [Características del Sistema](./docs/FEATURES.md)
- [Base de Datos](./docs/DATABASE.md)
- [**Manual del Módulo de Tickets**](./docs/MANUAL_TICKETS.md) ← Guía completa por rol
- [Configuración OAuth (Google/Microsoft)](./docs/OAUTH_SETUP_GUIDE.md)
- [Configuración de Email/SMTP](./docs/GUIA_CONFIGURACION_EMAIL.md)
- [SMTP desde la Interfaz](./docs/CONFIGURACION_SMTP_INTERFAZ.md)
- [Solución de Problemas](./docs/TROUBLESHOOTING.md)

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 16.1.1, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Base de Datos**: PostgreSQL 15 (Docker)
- **Cache**: Redis 7 (Docker)
- **Autenticación**: NextAuth.js
- **UI**: Shadcn/UI, Radix UI, Lucide Icons
- **Gráficas**: Recharts
- **Validación**: Zod
- **Estado**: Zustand, React Query

## 📦 Estructura del Proyecto

```
sistema-tickets-nextjs/
├── src/
│   ├── app/              # Rutas y páginas
│   ├── components/       # Componentes React
│   ├── lib/              # Utilidades y servicios
│   └── types/            # Tipos TypeScript
├── prisma/
│   ├── schema.prisma     # Esquema de base de datos
│   └── seed.ts           # Datos iniciales
├── docs/                 # Documentación
├── docker/               # Configuración Docker
└── scripts/              # Scripts de utilidad
```

## 🔧 Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Base de datos (sin migraciones, usamos db push)
npx prisma db push          # Sincronizar schema con BD
npx prisma generate          # Regenerar cliente Prisma
npm run db:seed              # Cargar datos iniciales
npm run db:reset             # Reset completo (push + seed)

# Tests
npm test
npm run test:e2e

# Calidad de código
npm run quality:check        # Lint + format check
npm run quality:fix          # Lint fix + format

# Calidad de código
rm -rf .next        # Limpiar cache
```

## 🐳 Docker

```bash
# Iniciar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down

# Reiniciar
docker-compose restart
```

## 📊 Políticas de SLA por Defecto

- **URGENT**: Respuesta 1h, Resolución 4h (24/7)
- **HIGH**: Respuesta 4h, Resolución 24h (Laboral)
- **MEDIUM**: Respuesta 8h, Resolución 48h (Laboral)
- **LOW**: Respuesta 24h, Resolución 72h (Laboral)

## 🔐 Seguridad

- Autenticación con NextAuth.js
- Sesiones seguras con JWT
- Control de acceso por roles
- Auditoría de todas las acciones
- Protección CSRF
- Sanitización de inputs

## 📝 Licencia

MIT

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request
