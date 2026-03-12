# Solución de Problemas

## 🔧 Problemas Comunes

### 1. Error de Conexión a Base de Datos

**Síntoma**: `Error: Can't reach database server`

**Solución**:
```bash
# Verificar que PostgreSQL esté corriendo
docker-compose ps

# Reiniciar base de datos
docker-compose restart postgres

# Ver logs
docker-compose logs postgres
```

### 2. Migraciones Pendientes

**Síntoma**: `Prisma schema is out of sync`

**Solución**:
```bash
# Ejecutar migraciones
docker-compose exec app npx prisma migrate deploy

# Si falla, resetear (⚠️ borra datos)
docker-compose exec app npx prisma migrate reset
```

### 3. Tiempo Promedio de Primera Respuesta Muestra 0min

**Causa**: No hay tickets con respuestas de técnicos.

**Solución**:
```bash
# Agregar respuesta de prueba
docker-compose exec app node scripts/add-test-response.js
```

**Explicación**: El cálculo es correcto, pero necesita tickets con comentarios de técnicos para mostrar un promedio real.

### 4. Emails No Se Envían

**Verificar configuración SMTP**:
1. Ve a Admin → Configuración → Email
2. Verifica host, puerto, usuario y contraseña
3. Usa "Probar Conexión"

**Para Gmail**:
- Usa contraseña de aplicación (no tu contraseña normal)
- Genera en: https://myaccount.google.com/apppasswords
- Habilita IMAP en configuración de Gmail

**Variables de entorno**:
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="tu-email@gmail.com"
SMTP_PASSWORD="tu-password-app"
SMTP_FROM="soporte@tuempresa.com"
```

### 5. Sesión Expira Muy Rápido

**Solución**:
```env
# En .env
SESSION_TIMEOUT=3600  # 1 hora en segundos
```

Reinicia el servidor después de cambiar.

### 6. Error 500 en Producción

**Verificar logs**:
```bash
docker-compose logs -f app
```

**Verificar variables de entorno**:
```bash
docker-compose exec app env | grep DATABASE_URL
docker-compose exec app env | grep NEXTAUTH
```

**Causas comunes**:
- NEXTAUTH_SECRET no configurado
- DATABASE_URL incorrecto
- Migraciones no aplicadas

### 7. Archivos No Se Suben

**Verificar límites**:
1. Admin → Configuración → General
2. Ajustar "Tamaño máximo de archivo"
3. Verificar tipos permitidos

**Verificar permisos**:
```bash
docker-compose exec app ls -la /app/uploads
docker-compose exec app chmod 777 /app/uploads
```

### 8. OAuth No Funciona

**Google OAuth**:
- Verifica que las URIs de redirección coincidan exactamente
- URI correcta: `http://localhost:3000/api/auth/callback/google`
- Verifica que GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET estén configurados

**Microsoft OAuth**:
- URI correcta: `http://localhost:3000/api/auth/callback/azure-ad`
- Verifica AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET y AZURE_AD_TENANT_ID
- Usa `AZURE_AD_TENANT_ID="common"` para cuentas personales

Ver guía completa: [OAUTH_SETUP_GUIDE.md](./OAUTH_SETUP_GUIDE.md)

## 🗄️ Base de Datos

### Resetear Base de Datos

```bash
# ⚠️ Esto borrará todos los datos
docker-compose exec app npx prisma migrate reset
```

### Backup Manual

```bash
docker-compose exec postgres pg_dump -U tickets_user tickets_db > backup_$(date +%Y%m%d).sql
```

### Restaurar Backup

```bash
docker-compose exec -T postgres psql -U tickets_user tickets_db < backup.sql
```

### Ver Tablas

```bash
docker-compose exec postgres psql -U tickets_user -d tickets_db -c "\dt"
```

### Verificar Datos

```bash
# Ver usuarios
docker-compose exec postgres psql -U tickets_user -d tickets_db -c "SELECT id, email, name, role FROM users;"

# Ver tickets
docker-compose exec postgres psql -U tickets_user -d tickets_db -c "SELECT id, title, status, priority FROM tickets LIMIT 10;"
```

## 🔍 Debugging

### Ver Logs en Tiempo Real

```bash
# Aplicación
docker-compose logs -f app

# Base de datos
docker-compose logs -f postgres

# Todos los servicios
docker-compose logs -f

# Últimas 100 líneas
docker-compose logs --tail=100 app
```

### Acceder al Contenedor

```bash
# Acceder a shell
docker-compose exec app sh

# Ejecutar comandos
docker-compose exec app node --version
docker-compose exec app npm list
```

### Verificar Estado de Servicios

```bash
docker-compose ps
```

### Reiniciar Servicios

```bash
# Reiniciar todo
docker-compose restart

# Reiniciar solo app
docker-compose restart app

# Reiniciar solo postgres
docker-compose restart postgres
```

## 🚨 Errores Específicos

### "NEXTAUTH_SECRET is not set"

```bash
# Generar secret
openssl rand -base64 32

# Agregar a .env
NEXTAUTH_SECRET="tu-secret-generado"

# Reiniciar
docker-compose restart app
```

### "Port 3000 is already in use"

```bash
# Encontrar proceso
lsof -i :3000

# Matar proceso
kill -9 <PID>

# O cambiar puerto en docker-compose.yml
ports:
  - "3001:3000"
```

### "Cannot find module '@prisma/client'"

```bash
docker-compose exec app npm install
docker-compose exec app npx prisma generate
docker-compose restart app
```

### "Database 'tickets_db' does not exist"

```bash
# Crear base de datos
docker-compose exec postgres psql -U tickets_user -c "CREATE DATABASE tickets_db;"

# Ejecutar migraciones
docker-compose exec app npx prisma migrate deploy
```

### "Migration failed"

```bash
# Ver estado de migraciones
docker-compose exec app npx prisma migrate status

# Resolver migraciones pendientes
docker-compose exec app npx prisma migrate resolve --applied <migration-name>

# O resetear (⚠️ borra datos)
docker-compose exec app npx prisma migrate reset
```

## 🐛 Problemas de Rendimiento

### Aplicación Lenta

```bash
# Ver uso de recursos
docker stats

# Aumentar recursos en docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
```

### Base de Datos Lenta

```bash
# Ver consultas lentas
docker-compose exec postgres psql -U tickets_user -d tickets_db -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Analizar índices
docker-compose exec app npx prisma db execute --stdin < analyze.sql
```

## 🔄 Problemas de Actualización

### Error al Actualizar

```bash
# Limpiar y reconstruir
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker-compose exec app npx prisma migrate deploy
```

### Conflictos de Migraciones

```bash
# Ver estado
docker-compose exec app npx prisma migrate status

# Resolver manualmente
docker-compose exec app npx prisma migrate resolve --applied <migration>
```

## 📱 Problemas de UI

### Estilos No Se Cargan

```bash
# Limpiar caché de Next.js
docker-compose exec app rm -rf .next
docker-compose restart app
```

### Componentes No Se Actualizan

```bash
# Limpiar todo y reconstruir
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 🆘 Cuando Todo Falla

### Reinicio Completo

```bash
# Detener todo
docker-compose down -v

# Limpiar imágenes
docker-compose build --no-cache

# Iniciar de nuevo
docker-compose up -d

# Migraciones y seed
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma db seed
```

### Verificar Instalación

```bash
# Verificar Docker
docker --version
docker-compose --version

# Verificar Node (en contenedor)
docker-compose exec app node --version
docker-compose exec app npm --version

# Verificar Prisma
docker-compose exec app npx prisma --version
```

## 📞 Soporte

Si el problema persiste:

1. Revisa los logs completos: `docker-compose logs app > logs.txt`
2. Verifica las variables de entorno: `docker-compose exec app env`
3. Consulta la documentación específica:
   - [Instalación](./SETUP.md)
   - [Despliegue](./DEPLOYMENT.md)
   - [OAuth](./OAUTH_SETUP_GUIDE.md)
4. Crea un issue en el repositorio con:
   - Descripción del problema
   - Logs relevantes
   - Pasos para reproducir
   - Versión del sistema

## 📚 Recursos Adicionales

- [Docker Documentation](https://docs.docker.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
