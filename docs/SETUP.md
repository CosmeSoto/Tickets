# Instalación y Configuración

## 📋 Requisitos Previos

- Docker y Docker Compose
- Node.js 18+ (solo para desarrollo local)
- PostgreSQL 15+ (incluido en Docker)

## 🚀 Instalación con Docker (Recomendado)

### 1. Clonar el Repositorio

```bash
git clone <repo-url>
cd sistema-tickets-nextjs
```

### 2. Configurar Variables de Entorno

```bash
cp .env.example .env
```

Edita `.env` con tus configuraciones:

```env
# Base de datos
DATABASE_URL="postgresql://tickets_user:tickets_pass@postgres:5432/tickets_db"

# NextAuth
NEXTAUTH_SECRET="tu-secret-key-aqui"
NEXTAUTH_URL="http://localhost:3000"

# Email (opcional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="tu-email@gmail.com"
SMTP_PASSWORD="tu-password"
SMTP_FROM="soporte@tuempresa.com"
```

**Generar NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 3. Iniciar Contenedores

```bash
docker-compose up -d
```

### 4. Ejecutar Migraciones y Seed

```bash
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma db seed
```

### 5. Acceder al Sistema

Abre tu navegador en: `http://localhost:3000`

**Credenciales:**
- Email: `admin@tickets.com`
- Contraseña: `admin123`

## 💻 Instalación Local (Desarrollo)

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Base de Datos

```bash
# Iniciar PostgreSQL con Docker
docker-compose up -d postgres

# Ejecutar migraciones
npx prisma migrate deploy

# Ejecutar seed
npx prisma db seed
```

### 3. Iniciar Servidor de Desarrollo

```bash
npm run dev
```

## 🔧 Configuración Adicional

### Configurar Email (SMTP)

1. Ve a **Admin → Configuración → Email**
2. Ingresa los datos de tu servidor SMTP
3. Prueba la conexión

**Para Gmail:**
- Usa contraseña de aplicación (no tu contraseña normal)
- Genera en: https://myaccount.google.com/apppasswords

### Configurar SLA

Las políticas de SLA se crean automáticamente con el seed:

- **URGENT**: Respuesta 1h, Resolución 4h (24/7)
- **HIGH**: Respuesta 4h, Resolución 24h (Laboral)
- **MEDIUM**: Respuesta 8h, Resolución 48h (Laboral)
- **LOW**: Respuesta 24h, Resolución 72h (Laboral)

Puedes modificarlas en **Admin → Configuración → SLA**

### Configurar OAuth (Opcional)

Para habilitar login con Google/Microsoft, consulta:
[OAUTH_SETUP_GUIDE.md](./OAUTH_SETUP_GUIDE.md)

## 🗄️ Base de Datos

### Verificar Seed

```bash
docker-compose exec app node scripts/verify-seed.js
```

### Resetear Base de Datos

```bash
# ⚠️ Esto borrará todos los datos
docker-compose exec app npx prisma migrate reset
```

### Backup de Base de Datos

```bash
docker-compose exec postgres pg_dump -U tickets_user tickets_db > backup.sql
```

### Restaurar Base de Datos

```bash
docker-compose exec -T postgres psql -U tickets_user tickets_db < backup.sql
```

## 🔍 Verificación

### Ver Logs

```bash
docker-compose logs -f app
```

### Ver Estado de Servicios

```bash
docker-compose ps
```

### Acceder al Contenedor

```bash
docker-compose exec app sh
```

## 🎯 Próximos Pasos

1. ✅ Cambiar contraseña del administrador
2. ✅ Crear departamentos
3. ✅ Crear categorías
4. ✅ Crear usuarios técnicos
5. ✅ Configurar email SMTP
6. ✅ Personalizar configuración del sitio
7. ✅ Crear primer ticket de prueba

## 📚 Más Información

- [Despliegue en Producción](./DEPLOYMENT.md)
- [Características del Sistema](./FEATURES.md)
- [Solución de Problemas](./TROUBLESHOOTING.md)
