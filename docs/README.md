# Sistema de Tickets - Documentación

## 📚 Índice

1. [Instalación y Configuración](./SETUP.md)
2. [Despliegue con Docker](./DEPLOYMENT.md)
3. [Características del Sistema](./FEATURES.md)
4. [Solución de Problemas](./TROUBLESHOOTING.md)
5. [Configuración OAuth (Google/Microsoft)](./OAUTH_SETUP_GUIDE.md)
6. [Integración del Selector de Categorías](./CATEGORY_SELECTOR_INTEGRATION.md)
7. [Guía de Desarrollo del Selector de Categorías](./CATEGORY_SELECTOR_DEVELOPER.md)

## 🎯 Descripción

Sistema profesional de gestión de tickets de soporte con:

- ✅ Gestión completa de tickets
- ✅ Sistema de SLA automático
- ✅ Notificaciones en tiempo real
- ✅ Reportes y métricas
- ✅ Sistema de auditoría
- ✅ Base de conocimientos (CMS)
- ✅ Multi-departamento y categorías jerárquicas

## 🚀 Inicio Rápido

```bash
# Clonar repositorio
git clone <repo-url>
cd sistema-tickets-nextjs

# Configurar variables de entorno
cp .env.example .env

# Iniciar con Docker
docker-compose up -d

# Ejecutar migraciones y seed
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma db seed

# Acceder al sistema
http://localhost:3000
```

## 👤 Credenciales por Defecto

```
Email: admin@tickets.com
Contraseña: admin123
```

## 📖 Documentación Detallada

Consulta los archivos en esta carpeta para información específica.
