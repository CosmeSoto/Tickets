# Alcance del Proyecto

**Documento para la selección y configuración del servidor**

---

## 1. ¿Qué es este documento?

Esta guía te ayudará a elegir el servidor adecuado en la nube para que tu sistema de gestión funcione perfectamente. Aquí encontrarás todo lo que necesitas saber: requisitos técnicos, seguridad, rendimiento y mantenimiento.

---

## 2. Nuestro Sistema: ¿Qué hace?

El sistema es una herramienta completa para gestionar tu empresa, con estos módulos principales:

### 🎫 Tickets de Soporte

- Gestiona solicitudes de soporte con estados: Abierto → En Progreso → Resuelto → Cerrado
- SLA automático (tiempos de respuesta garantizados: Urgente, Alto, Medio, Bajo)
- Asignación automática y manual a técnicos
- Categorías organizadas en 4 niveles
- Comentarios, archivos adjuntos y seguimiento de actividades
- Reportes y estadísticas (tiempo de respuesta, cumplimiento SLA, carga por técnico)
- Exportación a Excel, PDF y CSV

### 📦 Inventario Completo

- **Equipos**: registro con código único, QR, historial de asignaciones y mantenimientos
- **Licencias**: claves encriptadas, alertas de vencimiento automáticas
- **Consumibles**: control de stock, alertas de stock bajo
- **Contratos**: gestión de contratos de servicio con archivos adjuntos
- **Actas digitales**: entrega, devolución y baja con PDF automático y folio secuencial
- **Proveedores**: gestión completa con tipos y asignación por área
- Catálogos personalizables (tipos de equipo, licencia, consumible, unidades de medida)
- Reportes de inventario con exportación

### 📚 Base de Conocimientos y Documentos

- Artículos creados desde tickets resueltos
- Búsqueda avanzada (full-text)
- Votación y clasificación por utilidad
- Acceso controlado por roles (público, técnicos, admins)
- Organización por categorías
- Archivos adjuntos en artículos

### 📰 Noticias y Comunicaciones

- Publicación de noticias y anuncios internos
- Notificaciones a usuarios cuando hay nuevas noticias
- Archivos adjuntos en noticias
- Control de publicación (fechas de inicio y fin)
- Estadísticas de visualización

### 📋 Formularios Personalizados

- Creación de formularios con campos configurables
- Tipos de campos: texto, número, fecha, selección, archivos
- Asignación de formularios a familias/áreas
- Respuestas organizadas y exportables
- Integración con tickets y otros módulos

### 🚶 Rondas y Patrullas

- Planificación de rutas de patrulla
- Puntos de control geolocalizados
- Registro de incidencias durante la ronda
- Horarios y programación automática
- Reportes de cumplimiento de rondas
- Evidencia fotográfica en cada punto

### 👥 Usuarios y Áreas (Familias)

- Roles: Super Administrador, Administrador, Técnico, Cliente
- Gestión de inventario delegada a gestores específicos
- Áreas (familias) con departamentos, técnicos y gestores asignados
- Configuración independiente de tickets e inventario por área
- Exportación de usuarios con filtros

### 🔔 Notificaciones en Tiempo Real

- Notificaciones dentro de la aplicación (inmediatas)
- Emails con reintentos automáticos
- Notificaciones del navegador
- Alertas automáticas: stock bajo, licencias por vencer, contratos por vencer, garantías

### 🏠 Página Pública (CMS)

- Página principal editable desde el panel sin tocar código
- Secciones: Hero, Servicios, Banners
- SEO optimizado

### ⚙️ Configuración Completa

- Configuración global del sistema (SMTP, SLA, límites de archivos)
- Configuración de tickets por área
- Configuración de inventario por área
- Preferencias de notificación por usuario
- Login con Google y Microsoft

### 🔐 Seguridad Avanzada

- Control de acceso por roles y áreas
- Auditoría completa de todas las acciones
- Bloqueo de cuenta por intentos fallidos
- Encriptación de datos sensibles
- Rate limiting (protección contra ataques)

---

## 3. Tecnologías que usamos

| Parte del Sistema      | Tecnología                |
| ---------------------- | ------------------------- |
| Aplicación Web         | Next.js 16 (App Router)   |
| Lenguaje               | TypeScript                |
| Base de Datos          | PostgreSQL 15             |
| Caché (para velocidad) | Redis 7                   |
| Contenedores           | Docker + Docker Compose   |
| Login seguro           | NextAuth.js (JWT + OAuth) |
| Proxy (seguridad web)  | Nginx                     |

---

## 4. ¿Qué necesita nuestro servidor?

### 4.1 Planes recomendados según tu empresa

| Tamaño de Empresa            | vCPU | RAM   | Almacenamiento |
| ---------------------------- | ---- | ----- | -------------- |
| Pequeña (hasta 20 usuarios)  | 2    | 4 GB  | 50 GB SSD      |
| Mediana (20-100 usuarios)    | 4    | 8 GB  | 100 GB SSD     |
| Grande (más de 100 usuarios) | 8    | 16 GB | 200 GB SSD     |

### 4.2 Sistema Operativo

- **Recomendado**: Ubuntu 22.04 LTS (fácil de usar y muy estable)
- También puedes elegir el sistema operativo que más te resulte más conveniente
- **Importante**: El servidor debe poder usar Docker y Docker Compose

### 4.3 Lo que debe tener la conexión

- Velocidad mínima: 100 Mbps (simétrica, igual de rápido para subir y bajar)
- IP pública fija (no cambia con el tiempo)
- Certificado SSL gratuito (Let's Encrypt) o pagado
- Firewall configurable
- Soporte para backups automáticos

---

## 5. ¿Cómo se organiza todo en el servidor?

Todo funciona dentro de contenedores Docker, lo que hace que sea fácil de instalar y mantener:

```
Tu Servidor en la Nube
├── Base de Datos (PostgreSQL) - Guarda toda la información
├── Caché (Redis) - Hace que el sistema sea más rápido
├── Aplicación Web (Next.js) - El sistema que usas
└── Nginx - Protege y sirve la web de forma segura
```

---

## 6. Seguridad: ¿Qué hay que tener en cuenta?

### 6.1 Seguridad del servidor

1. **Firewall**: Sólo abrir los puertos necesarios (80 para web, 443 para web segura, 22 para acceso remoto)
2. **Acceso seguro**: Usar claves SSH en lugar de contraseñas
3. **SSL/TLS**: Siempre usar HTTPS para proteger los datos
4. **Backups**: Copias de seguridad automáticas todos los días, guardarlas por 30 días
5. **Monitorización**: Saber en todo momento cómo está funcionando el servidor
6. **Actualizaciones**: Instalar actualizaciones de seguridad cada semana

### 6.2 Seguridad del sistema

- No guardar contraseñas o secretos en el código
- Cambiar las claves de acceso periódicamente
- Registrar todo lo que hace cada usuario

---

## 7. ¿Qué rendimiento esperar?

| Cosas que medir                       | Nuestro objetivo       |
| ------------------------------------- | ---------------------- |
| Tiempo que tarda la página en cargar  | Menos de 2 segundos    |
| Tiempo de respuesta del sistema       | Menos de medio segundo |
| Tiempo que el sistema está disponible | 99.9% al mes           |
| Tiempo para hacer un backup           | Menos de 1 hora        |
| Tiempo para restaurar desde backup    | Menos de 4 horas       |

---

## 8. Mantenimiento: ¿Cómo cuidar el servidor?

### 8.1 Todos los días

- Backups automáticos
- Monitorizar que todo funcione
- Revisar los registros de actividad

### 8.2 Plan de emergencia

- Backup completo cada semana
- Backup de cambios cada día
- Guardar backups por 30 días
- Probar restaurar backups cada mes

---

## 9. Lista de cosas que hacer antes de empezar

- [ ] Elegir proveedor y plan de hosting
- [ ] Configurar el servidor con el sistema operativo que elijas
- [ ] Instalar Docker y Docker Compose
- [ ] Configurar el firewall
- [ ] Comprar y configurar el dominio
- [ ] Configurar certificado SSL (HTTPS)
- [ ] Configurar backups automáticos
- [ ] Configurar monitorización
- [ ] Instalar el sistema
- [ ] Probar que todo funcione bien
- [ ] Hacer pruebas de seguridad
- [ ] Documentar todo

---

## 10. Después de instalar: ¿Qué sigue?

1. **Validación inicial**: Probar que todo funcione las primeras 24-48 horas
2. **Mantenimiento mensual**: Revisar el rendimiento y costos
3. **Actualizaciones semanales**: Instalar parches de seguridad
4. **Revisión anual**: Evaluar si necesitamos más recursos

---

## 11. Más información

Si quieres saber más, consulta estos documentos:

- [README.md](./README.md) - Todo sobre el sistema
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Cómo instalar el sistema
- [SETUP.md](./SETUP.md) - Configuración inicial

---

**Fecha del documento**: 2026-06-01
**Versión**: 1.3
