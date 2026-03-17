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

## 👤 Credenciales por Defecto

```
Email: admin@tickets.com
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
- [Características](./docs/FEATURES.md)
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
