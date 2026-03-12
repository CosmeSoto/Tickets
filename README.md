# Sistema de Tickets de Soporte

Sistema profesional de gestión de tickets con SLA, notificaciones, reportes y base de conocimientos.

## 🚀 Inicio Rápido

```bash
# Clonar repositorio
git clone <repo-url>
cd sistema-tickets-nextjs

# Configurar entorno
cp .env.example .env

# Iniciar con Docker
docker-compose up -d

# Ejecutar migraciones y seed
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma db seed

# Acceder
http://localhost:3000
```

## 👤 Credenciales por Defecto

```
Email: admin@tickets.com
Contraseña: admin123
```

## ✨ Características Principales

- ✅ Gestión completa de tickets
- ✅ Sistema de SLA automático
- ✅ Notificaciones (Email, Teams, In-App)
- ✅ Reportes y métricas avanzadas
- ✅ Base de conocimientos (CMS)
- ✅ Auditoría completa
- ✅ Multi-departamento
- ✅ Categorías jerárquicas
- ✅ API REST

## 📚 Documentación

- [Instalación y Configuración](./docs/SETUP.md)
- [Despliegue con Docker](./docs/DEPLOYMENT.md)
- [Características](./docs/FEATURES.md)
- [Solución de Problemas](./docs/TROUBLESHOOTING.md)

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Base de Datos**: PostgreSQL 15
- **Autenticación**: NextAuth.js
- **UI**: Shadcn/UI, Radix UI
- **Despliegue**: Docker, Docker Compose

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

# Migraciones
npx prisma migrate dev
npx prisma migrate deploy

# Seed
npx prisma db seed

# Tests
npm test

# Lint
npm run lint
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
