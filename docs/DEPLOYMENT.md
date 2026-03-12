# Despliegue con Docker

## 🐳 Despliegue en Producción

### Arquitectura

```
┌─────────────────┐
│   Nginx/Traefik │  (Reverse Proxy)
└────────┬────────┘
         │
┌────────▼────────┐
│   Next.js App   │  (Puerto 3000)
└────────┬────────┘
         │
┌────────▼────────┐
│   PostgreSQL    │  (Puerto 5432)
└─────────────────┘
```

### 1. Preparar Servidor

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Clonar Proyecto

```bash
git clone <repo-url>
cd sistema-tickets-nextjs
```

### 3. Configurar Variables de Entorno

```bash
cp .env.example .env
nano .env
```

**Variables importantes para producción:**

```env
# Base de datos
DATABASE_URL="postgresql://tickets_user:STRONG_PASSWORD@postgres:5432/tickets_db"

# NextAuth
NEXTAUTH_SECRET="GENERATE_STRONG_SECRET_HERE"
NEXTAUTH_URL="https://tu-dominio.com"

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="soporte@tu-dominio.com"
SMTP_PASSWORD="tu-password-app"
SMTP_FROM="soporte@tu-dominio.com"

# Node
NODE_ENV="production"
```

### 4. Construir y Desplegar

```bash
# Construir imágenes
docker-compose build

# Iniciar servicios
docker-compose up -d

# Ejecutar migraciones
docker-compose exec app npx prisma migrate deploy

# Ejecutar seed (solo primera vez)
docker-compose exec app npx prisma db seed
```

### 5. Verificar Despliegue

```bash
# Ver logs
docker-compose logs -f app

# Ver estado
docker-compose ps
```

## 🔒 Seguridad

### SSL/TLS con Let's Encrypt

Usa Nginx o Traefik como reverse proxy:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Firewall

```bash
# Permitir solo puertos necesarios
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

## 📊 Monitoreo

### Ver Logs

```bash
# Logs de la aplicación
docker-compose logs -f app

# Logs de la base de datos
docker-compose logs -f postgres

# Últimas 100 líneas
docker-compose logs --tail=100 app
```

### Métricas de Recursos

```bash
docker stats
```

## 🔄 Actualización

```bash
# Detener servicios
docker-compose down

# Actualizar código
git pull

# Reconstruir
docker-compose build

# Iniciar
docker-compose up -d

# Ejecutar migraciones
docker-compose exec app npx prisma migrate deploy
```

## 💾 Backup Automático

Crea un cron job para backups diarios:

```bash
# Editar crontab
crontab -e

# Agregar backup diario a las 2 AM
0 2 * * * cd /ruta/proyecto && docker-compose exec -T postgres pg_dump -U tickets_user tickets_db > /backups/tickets_$(date +\%Y\%m\%d).sql
```

### Script de Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/tickets_$DATE.sql"

# Crear backup
docker-compose exec -T postgres pg_dump -U tickets_user tickets_db > $BACKUP_FILE

# Comprimir
gzip $BACKUP_FILE

# Eliminar backups antiguos (más de 30 días)
find $BACKUP_DIR -name "tickets_*.sql.gz" -mtime +30 -delete

echo "Backup completado: $BACKUP_FILE.gz"
```

## 🚨 Troubleshooting

### Contenedor no inicia

```bash
docker-compose logs app
```

### Base de datos no conecta

```bash
docker-compose exec postgres psql -U tickets_user -d tickets_db
```

### Reiniciar servicios

```bash
docker-compose restart
```

### Limpiar todo y empezar de nuevo

```bash
# ⚠️ Esto eliminará todos los datos
docker-compose down -v
docker-compose up -d
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma db seed
```

## 📈 Escalabilidad

### Múltiples Instancias

Para escalar horizontalmente, usa Docker Swarm o Kubernetes:

```bash
# Docker Swarm
docker swarm init
docker stack deploy -c docker-compose.yml tickets
docker service scale tickets_app=3
```

### Load Balancer

Configura Nginx como load balancer:

```nginx
upstream tickets_backend {
    server app1:3000;
    server app2:3000;
    server app3:3000;
}

server {
    listen 80;
    location / {
        proxy_pass http://tickets_backend;
    }
}
```

## 🔐 Checklist de Seguridad

- [ ] NEXTAUTH_SECRET generado con openssl
- [ ] Contraseña de base de datos fuerte
- [ ] SSL/TLS configurado
- [ ] Firewall habilitado
- [ ] Backups automáticos configurados
- [ ] Logs monitoreados
- [ ] Contraseña de admin cambiada
- [ ] Variables de entorno seguras
- [ ] Puerto 5432 no expuesto públicamente
- [ ] Actualizaciones de seguridad aplicadas

## 📚 Más Información

- [Instalación y Configuración](./SETUP.md)
- [Solución de Problemas](./TROUBLESHOOTING.md)
