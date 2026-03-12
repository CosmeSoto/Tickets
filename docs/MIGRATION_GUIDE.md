# 🚀 Guía de Migración a Otro Equipo

## 📋 Requisitos del Nuevo Equipo

- Docker y Docker Compose instalados
- Git instalado
- Puerto 3000 y 5432 disponibles

## 🎯 Pasos de Migración

### 1. Preparar el Repositorio

```bash
# En el equipo actual (opcional - hacer commit de cambios)
cd sistema-tickets-nextjs
git add .
git commit -m "Proyecto limpio y listo para migración"
git push origin main
```

### 2. En el Nuevo Equipo

```bash
# Clonar repositorio
git clone <url-del-repositorio>
cd sistema-tickets-nextjs

# Verificar estructura
ls -la
```

### 3. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar configuración
nano .env  # o usar tu editor preferido
```

**Configuración mínima requerida:**

```env
# Base de datos (usar estos valores para Docker)
DATABASE_URL="postgresql://tickets_user:tickets_pass@postgres:5432/tickets_db"

# NextAuth (generar nuevo secret)
NEXTAUTH_SECRET="ejecutar: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# Node
NODE_ENV="development"
```

**Configuración opcional (Email):**

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="tu-email@gmail.com"
SMTP_PASSWORD="tu-password-app"
SMTP_FROM="soporte@tuempresa.com"
```

### 4. Iniciar Servicios con Docker

```bash
# Construir e iniciar contenedores
docker-compose up -d

# Ver logs para verificar
docker-compose logs -f
```

**Espera a ver:**
```
app_1       | ✓ Ready in 3.2s
postgres_1  | database system is ready to accept connections
```

### 5. Ejecutar Migraciones

```bash
# Aplicar migraciones a la base de datos
docker-compose exec app npx prisma migrate deploy
```

**Salida esperada:**
```
✓ Migrations applied successfully
```

### 6. Ejecutar Seed (Base de Datos Limpia)

```bash
# Poblar base de datos con datos iniciales
docker-compose exec app npx prisma db seed
```

**Salida esperada:**
```
✅ Departamento creado
✅ Usuario administrador creado
✅ Preferencias de notificación creadas
✅ Configuración del sitio creada
✅ Políticas de SLA creadas (4 políticas)

🎉 Seed completado exitosamente!

📋 Credenciales de acceso:
👤 Administrador:
   Email: admin@tickets.com
   Contraseña: admin123
```

### 7. Verificar Instalación

```bash
# Verificar que el seed se ejecutó correctamente
docker-compose exec app node scripts/verify-seed.js
```

### 8. Acceder al Sistema

Abre tu navegador en: **http://localhost:3000**

**Credenciales:**
- Email: `admin@tickets.com`
- Contraseña: `admin123`

## ✅ Verificación Post-Migración

### Verificar Servicios

```bash
# Ver estado de contenedores
docker-compose ps

# Debe mostrar:
# app       Up      0.0.0.0:3000->3000/tcp
# postgres  Up      5432/tcp
```

### Verificar Base de Datos

```bash
# Conectar a PostgreSQL
docker-compose exec postgres psql -U tickets_user -d tickets_db

# Dentro de psql:
\dt                    # Ver tablas
SELECT * FROM users;   # Ver usuarios
\q                     # Salir
```

### Verificar Aplicación

1. Login con admin@tickets.com / admin123
2. Crear un departamento de prueba
3. Crear una categoría de prueba
4. Crear un ticket de prueba
5. Verificar que las notificaciones funcionen

## 🔧 Comandos Útiles

### Gestión de Contenedores

```bash
# Ver logs
docker-compose logs -f app

# Reiniciar servicios
docker-compose restart

# Detener servicios
docker-compose down

# Detener y eliminar volúmenes (⚠️ borra datos)
docker-compose down -v
```

### Gestión de Base de Datos

```bash
# Backup
docker-compose exec postgres pg_dump -U tickets_user tickets_db > backup.sql

# Restaurar
docker-compose exec -T postgres psql -U tickets_user tickets_db < backup.sql

# Resetear (⚠️ borra todos los datos)
docker-compose exec app npx prisma migrate reset
```

### Desarrollo

```bash
# Instalar dependencias localmente (opcional)
npm install

# Ejecutar en modo desarrollo (sin Docker)
npm run dev

# Ejecutar tests
npm test

# Lint
npm run lint
```

## 🐛 Solución de Problemas

### Puerto 3000 ocupado

```bash
# Cambiar puerto en docker-compose.yml
ports:
  - "3001:3000"  # Usar puerto 3001 en lugar de 3000
```

### Error de conexión a base de datos

```bash
# Verificar que PostgreSQL esté corriendo
docker-compose ps postgres

# Ver logs de PostgreSQL
docker-compose logs postgres

# Reiniciar PostgreSQL
docker-compose restart postgres
```

### Migraciones fallan

```bash
# Resetear base de datos (⚠️ borra datos)
docker-compose exec app npx prisma migrate reset

# O eliminar volumen y empezar de nuevo
docker-compose down -v
docker-compose up -d
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma db seed
```

### Contenedor no inicia

```bash
# Ver logs detallados
docker-compose logs app

# Reconstruir imagen
docker-compose build --no-cache app
docker-compose up -d
```

## 📚 Documentación Adicional

Consulta la documentación completa en `sistema-tickets-nextjs/docs/`:

- **README.md**: Índice general
- **SETUP.md**: Instalación detallada
- **DEPLOYMENT.md**: Despliegue en producción
- **FEATURES.md**: Características del sistema
- **TROUBLESHOOTING.md**: Solución de problemas

## 🎉 ¡Listo!

El sistema está completamente funcional y listo para usar. Puedes:

1. Crear usuarios adicionales
2. Configurar departamentos y categorías
3. Configurar email SMTP
4. Personalizar políticas de SLA
5. Comenzar a crear tickets

**Credenciales de administrador:**
- Email: admin@tickets.com
- Contraseña: admin123

⚠️ **Importante**: Cambia la contraseña del administrador después del primer login.
