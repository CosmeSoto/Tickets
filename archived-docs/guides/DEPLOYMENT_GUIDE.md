# Deployment Guide

## Sistema de Tickets Next.js - Guía de Despliegue

### Tabla de Contenidos
1. [Requisitos Previos](#requisitos-previos)
2. [Configuración de Entorno](#configuración-de-entorno)
3. [Despliegue en Desarrollo](#despliegue-en-desarrollo)
4. [Despliegue en Producción](#despliegue-en-producción)
5. [Configuración de Base de Datos](#configuración-de-base-de-datos)
6. [Configuración de Redis](#configuración-de-redis)
7. [Variables de Entorno](#variables-de-entorno)
8. [Monitoreo y Logs](#monitoreo-y-logs)
9. [Procedimientos de Rollback](#procedimientos-de-rollback)
10. [Troubleshooting](#troubleshooting)

---

## Requisitos Previos

### Software Requerido
- **Node.js**: v18.0.0 o superior
- **npm**: v8.0.0 o superior
- **Docker**: v20.0.0 o superior (para contenedores)
- **PostgreSQL**: v14.0 o superior
- **Redis**: v6.0 o superior (opcional, para caching)

### Recursos del Sistema
- **RAM**: Mínimo 2GB, recomendado 4GB
- **CPU**: Mínimo 2 cores, recomendado 4 cores
- **Almacenamiento**: Mínimo 10GB disponibles
- **Red**: Acceso a internet para dependencias

---

## Configuración de Entorno

### 1. Clonar el Repositorio
```bash
git clone <repository-url>
cd sistema-tickets-nextjs
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
```bash
cp .env.example .env.local
```

Editar `.env.local` con los valores apropiados:
```env
# Base de Datos
DATABASE_URL="postgresql://username:password@localhost:5432/tickets_db"

# Autenticación
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Redis (Opcional)
REDIS_URL="redis://localhost:6379"

# Logging
LOG_LEVEL="info"

# Monitoreo (Opcional)
SENTRY_DSN="your-sentry-dsn"
```

---

## Despliegue en Desarrollo

### Inicio Rápido
```bash
# 1. Configurar base de datos
npm run db:setup

# 2. Ejecutar migraciones
npm run db:migrate

# 3. Sembrar datos iniciales (opcional)
npm run db:seed

# 4. Iniciar servidor de desarrollo
npm run dev
```

### Con Docker
```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar servicios
docker-compose down
```

### Verificación
- Aplicación: http://localhost:3000
- Health Check: http://localhost:3000/api/health
- Admin Panel: http://localhost:3000/admin

---

## Despliegue en Producción

### Opción 1: Despliegue Tradicional

#### 1. Preparación del Servidor
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2 para gestión de procesos
sudo npm install -g pm2
```

#### 2. Configuración de la Aplicación
```bash
# Clonar código
git clone <repository-url> /var/www/tickets-app
cd /var/www/tickets-app

# Instalar dependencias de producción
npm ci --only=production

# Construir aplicación
npm run build

# Configurar variables de entorno
sudo nano .env.production
```

#### 3. Configurar PM2
```bash
# Crear archivo de configuración PM2
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'tickets-app',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/tickets-app',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    error_file: '/var/log/tickets-app/error.log',
    out_file: '/var/log/tickets-app/out.log',
    log_file: '/var/log/tickets-app/combined.log',
    time: true
  }]
}
EOF

# Iniciar aplicación
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Opción 2: Despliegue con Docker

#### 1. Construcción de Imagen
```bash
# Construir imagen de producción
docker build -f Dockerfile -t tickets-app:latest .

# O usar docker-compose
docker-compose -f docker-compose.prod.yml build
```

#### 2. Despliegue
```bash
# Iniciar servicios de producción
docker-compose -f docker-compose.prod.yml up -d

# Verificar estado
docker-compose -f docker-compose.prod.yml ps
```

### Opción 3: Despliegue en la Nube

#### Vercel (Recomendado para Next.js)
```bash
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel --prod
```

#### Railway
```bash
# Conectar repositorio en railway.app
# Configurar variables de entorno en el dashboard
# El despliegue es automático
```

#### DigitalOcean App Platform
```bash
# Crear app.yaml
cat > app.yaml << EOF
name: tickets-app
services:
- name: web
  source_dir: /
  github:
    repo: your-username/tickets-app
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
EOF
```

---

## Configuración de Base de Datos

### PostgreSQL Local
```bash
# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib

# Crear usuario y base de datos
sudo -u postgres psql
CREATE USER tickets_user WITH PASSWORD 'secure_password';
CREATE DATABASE tickets_db OWNER tickets_user;
GRANT ALL PRIVILEGES ON DATABASE tickets_db TO tickets_user;
\q
```

### PostgreSQL en Docker
```bash
# Usar docker-compose.yml incluido
docker-compose up -d postgres

# O ejecutar manualmente
docker run -d \
  --name tickets-postgres \
  -e POSTGRES_DB=tickets_db \
  -e POSTGRES_USER=tickets_user \
  -e POSTGRES_PASSWORD=secure_password \
  -p 5432:5432 \
  postgres:14
```

### Migraciones
```bash
# Ejecutar migraciones
npx prisma migrate deploy

# Generar cliente Prisma
npx prisma generate

# Verificar conexión
npx prisma db pull
```

---

## Configuración de Redis

### Redis Local
```bash
# Instalar Redis
sudo apt install redis-server

# Configurar Redis
sudo nano /etc/redis/redis.conf
# Descomentar: requirepass your_password

# Reiniciar Redis
sudo systemctl restart redis-server
```

### Redis en Docker
```bash
# Usar configuración incluida
docker-compose up -d redis

# O ejecutar manualmente
docker run -d \
  --name tickets-redis \
  -p 6379:6379 \
  redis:6-alpine redis-server --requirepass secure_password
```

---

## Variables de Entorno

### Producción (.env.production)
```env
# Aplicación
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# Base de Datos
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# Autenticación
NEXTAUTH_SECRET="super-secure-secret-key-min-32-chars"
NEXTAUTH_URL="https://your-domain.com"

# Redis
REDIS_URL="redis://:password@host:6379"

# Logging
LOG_LEVEL="warn"
LOG_FILE="/var/log/tickets-app/app.log"

# Monitoreo
SENTRY_DSN="https://your-sentry-dsn"
SENTRY_ENVIRONMENT="production"

# Email (si aplica)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Almacenamiento (si aplica)
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
AWS_BUCKET="your-bucket-name"
```

### Validación de Variables
```bash
# Verificar configuración
npm run config:validate

# O manualmente
node -e "
const config = require('./src/lib/config/configuration-service');
console.log('Config validation:', config.validate());
"
```

---

## Monitoreo y Logs

### Configuración de Logs
```bash
# Crear directorio de logs
sudo mkdir -p /var/log/tickets-app
sudo chown $USER:$USER /var/log/tickets-app

# Configurar rotación de logs
sudo nano /etc/logrotate.d/tickets-app
```

Contenido de logrotate:
```
/var/log/tickets-app/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reload tickets-app
    endscript
}
```

### Monitoreo con PM2
```bash
# Ver estado de la aplicación
pm2 status

# Ver logs en tiempo real
pm2 logs tickets-app

# Monitoreo de recursos
pm2 monit

# Reiniciar aplicación
pm2 restart tickets-app

# Recargar sin downtime
pm2 reload tickets-app
```

### Health Checks
```bash
# Script de health check
cat > health-check.sh << 'EOF'
#!/bin/bash
HEALTH_URL="http://localhost:3000/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "✅ Application is healthy"
    exit 0
else
    echo "❌ Application is unhealthy (HTTP $RESPONSE)"
    exit 1
fi
EOF

chmod +x health-check.sh
```

### Configurar Cron para Monitoreo
```bash
# Agregar a crontab
crontab -e

# Agregar línea:
*/5 * * * * /path/to/health-check.sh >> /var/log/tickets-app/health.log 2>&1
```

---

## Procedimientos de Rollback

### Rollback de Aplicación
```bash
# 1. Identificar versión anterior
git log --oneline -10

# 2. Crear branch de rollback
git checkout -b rollback-$(date +%Y%m%d-%H%M%S)

# 3. Revertir a commit específico
git reset --hard <commit-hash>

# 4. Reconstruir aplicación
npm run build

# 5. Reiniciar servicios
pm2 restart tickets-app

# 6. Verificar funcionamiento
./health-check.sh
```

### Rollback de Base de Datos
```bash
# 1. Crear backup antes del rollback
pg_dump -h localhost -U tickets_user tickets_db > rollback_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Ejecutar rollback de migraciones
npx prisma migrate reset --force

# 3. Aplicar migraciones hasta punto específico
npx prisma migrate deploy --to <migration-name>

# 4. Verificar integridad
npm run db:validate
```

### Rollback con Docker
```bash
# 1. Parar servicios actuales
docker-compose -f docker-compose.prod.yml down

# 2. Usar imagen anterior
docker tag tickets-app:previous tickets-app:latest

# 3. Reiniciar servicios
docker-compose -f docker-compose.prod.yml up -d

# 4. Verificar logs
docker-compose -f docker-compose.prod.yml logs -f
```

---

## Troubleshooting

### Problemas Comunes

#### 1. Error de Conexión a Base de Datos
```bash
# Verificar conexión
pg_isready -h localhost -p 5432

# Verificar credenciales
psql -h localhost -U tickets_user -d tickets_db

# Verificar configuración
echo $DATABASE_URL
```

#### 2. Error de Memoria
```bash
# Verificar uso de memoria
free -h
ps aux --sort=-%mem | head

# Ajustar límites de PM2
pm2 restart tickets-app --max-memory-restart 512M
```

#### 3. Error de Permisos
```bash
# Verificar permisos de archivos
ls -la /var/www/tickets-app

# Corregir permisos
sudo chown -R $USER:$USER /var/www/tickets-app
chmod -R 755 /var/www/tickets-app
```

#### 4. Error de Puerto en Uso
```bash
# Verificar qué proceso usa el puerto
sudo lsof -i :3000

# Matar proceso si es necesario
sudo kill -9 <PID>
```

### Logs de Diagnóstico
```bash
# Ver logs de aplicación
tail -f /var/log/tickets-app/combined.log

# Ver logs de sistema
sudo journalctl -u tickets-app -f

# Ver logs de Docker
docker-compose logs -f tickets-app

# Ver logs de base de datos
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Comandos de Diagnóstico
```bash
# Estado general del sistema
./scripts/system-status.sh

# Verificar configuración
npm run config:check

# Ejecutar tests de integración
npm run test:integration

# Verificar conectividad de servicios
npm run health:check
```

---

## Checklist de Despliegue

### Pre-Despliegue
- [ ] Código revisado y aprobado
- [ ] Tests pasando (unit, integration, e2e)
- [ ] Variables de entorno configuradas
- [ ] Base de datos migrada
- [ ] Backup de datos actual creado
- [ ] Certificados SSL configurados
- [ ] DNS configurado correctamente

### Durante el Despliegue
- [ ] Aplicación construida exitosamente
- [ ] Servicios iniciados correctamente
- [ ] Health checks pasando
- [ ] Logs sin errores críticos
- [ ] Funcionalidades principales verificadas

### Post-Despliegue
- [ ] Monitoreo activo
- [ ] Alertas configuradas
- [ ] Performance baseline establecido
- [ ] Documentación actualizada
- [ ] Equipo notificado del despliegue
- [ ] Plan de rollback preparado

---

## Contacto y Soporte

Para problemas de despliegue o soporte técnico:
- **Documentación**: Consultar este archivo y README.md
- **Logs**: Revisar logs de aplicación y sistema
- **Health Checks**: Usar endpoints de monitoreo
- **Rollback**: Seguir procedimientos documentados

---

**Última actualización**: Enero 2026
**Versión del documento**: 1.0