# Características del Sistema

## Roles de Usuario

| Rol             | Descripción                     | Acceso                                              |
| --------------- | ------------------------------- | --------------------------------------------------- |
| **SUPER_ADMIN** | Administrador total del sistema | Todo, incluyendo auditoría y configuración avanzada |
| **ADMIN**       | Administrador de área           | Familias asignadas, usuarios, tickets, inventario   |
| **TECHNICIAN**  | Técnico de soporte              | Tickets asignados, inventario de sus familias       |
| **CLIENT**      | Usuario final                   | Crear y ver sus propios tickets, ver sus activos    |

> Los ADMIN pueden tener `canManageInventory = true` para delegar gestión de inventario a técnicos o usuarios específicos.

---

## 🎫 Módulo de Tickets

### Gestión de Tickets

- Creación con título, descripción, prioridad y categoría
- Estados: `OPEN` → `IN_PROGRESS` → `RESOLVED` → `CLOSED` (también `CANCELLED`)
- Asignación automática basada en categoría, carga de trabajo y disponibilidad
- Asignación manual por administradores
- Colaboradores en tickets (múltiples técnicos)
- Timeline de actividad completo (comentarios, cambios de estado, asignaciones)
- Adjuntos (imágenes, PDF, documentos Office)
- Calificación de resolución por el cliente

### Categorías

- Jerarquía de hasta 4 niveles (Principal → Subcategoría → Especialidad → Detalle)
- Configuración por familia (área)
- Sugerencias inteligentes basadas en historial

### SLA (Service Level Agreement)

- 4 niveles de prioridad: URGENT, HIGH, MEDIUM, LOW
- Políticas configurables (tiempo de respuesta y resolución)
- Horarios laborales vs 24/7
- Métricas de cumplimiento por técnico y categoría
- Alertas de violación de SLA

### Base de Conocimientos

- Artículos creados desde tickets resueltos
- Búsqueda full-text
- Votación y utilidad
- Acceso por rol (público, técnicos, admins)

### Reportes de Tickets

- Tiempo promedio de respuesta y resolución
- Cumplimiento de SLA por período
- Carga por técnico y categoría
- Exportación CSV / Excel / PDF

---

## 📦 Módulo de Inventario

### Equipos

- Registro con código único autogenerado y código QR
- Tipos dinámicos configurables (Laptop, Desktop, Monitor, Impresora, etc.)
- Modalidades: activo fijo, arrendamiento, préstamo de tercero
- Estados: `AVAILABLE`, `ASSIGNED`, `MAINTENANCE`, `DAMAGED`, `RETIRED`
- Condiciones: NEW, LIKE_NEW, GOOD, FAIR, POOR
- Asignación a usuarios con actas de entrega digitales
- Historial completo de asignaciones y mantenimientos
- Vinculación con tickets de soporte
- Depreciación configurable por área (línea recta, saldo decreciente, unidades de producción)
- Adjuntos (fotos, manuales, facturas)

### Licencias de Software

- Claves de licencia encriptadas en BD
- Tipos dinámicos (Windows, Office 365, Antivirus, etc.)
- Control de vencimiento con alertas automáticas (primera alerta + segunda alerta)
- Asignación a usuarios y equipos
- Adjuntos de licencia

### Consumibles / MRO

- Control de stock con movimientos (entrada, salida, ajuste)
- Asignación a equipos y usuarios
- Alertas de stock bajo y agotado (notificación in-app + email a admins)
- Tipos dinámicos (Tóner, Tinta, Papel, Cable, etc.)
- Unidades de medida configurables

### Contratos

- Gestión de contratos de servicio con proveedor
- Líneas de contrato (ítems/servicios)
- Adjuntos de contrato
- Alertas de vencimiento configurables

### Actas Digitales

- **Acta de entrega**: al asignar un equipo a un usuario
- **Acta de devolución**: al devolver un equipo
- **Acta de baja**: al retirar un activo del inventario
- Folio secuencial automático por año (ACT-2026-0001, DEV-2026-0001, BAJ-2026-0001)
- Generación de PDF
- Flujo de aceptación/rechazo por el receptor
- Expiración configurable (días para aceptar)

### Proveedores

- CRUD completo con tipos de proveedor
- Asignación por familia (proveedor global o específico de área)
- Gestión inline desde formularios de activos (crear, editar, desactivar, eliminar)
- Control de permisos: crear/editar para gestores, desactivar/eliminar solo ADMIN

### Configuración de Inventario por Área

- Tipos de activos permitidos por familia (EQUIPMENT, MRO, LICENSE)
- Secciones del formulario visibles y obligatorias (global o por modalidad de adquisición)
- Reglas de registro (requerir datos financieros, requerir acta, auto-aprobar baja)
- Depreciación por defecto (método, vida útil, valor residual)
- Prefijo de código de activo por área
- Habilitar/deshabilitar inventario por familia

### Catálogos Dinámicos

- Tipos de equipo, licencia, consumible y proveedor editables desde la UI
- Unidades de medida configurables
- Cada catálogo con código único, nombre, descripción y orden

### Reportes de Inventario

- Inventario por familia y estado
- Activos por usuario
- Consumibles con stock bajo
- Licencias por vencer
- Exportación CSV / Excel / PDF

---

## 👥 Módulo de Usuarios y Familias

### Usuarios

- Roles: SUPER_ADMIN, ADMIN, TECHNICIAN, CLIENT
- Gestión de avatar (upload de foto)
- Configuración de notificaciones por usuario
- Preferencias de tema, idioma y zona horaria
- Historial de acceso y actividad
- Bloqueo por intentos fallidos de login
- OAuth (Google, Microsoft)
- Exportación de usuarios con filtros activos (CSV/Excel/PDF)

### Familias (Áreas)

- Agrupación lógica de departamentos, técnicos y gestores
- Configuración independiente de tickets e inventario por familia
- Asignación de administradores específicos por familia
- Estadísticas: departamentos, tickets, técnicos, gestores

### Departamentos

- Pertenecen a una familia
- Color identificador
- Conteo de usuarios asignados
- Activar/desactivar sin eliminar

---

## 🔔 Notificaciones

- **In-app**: campana en tiempo real via SSE (Server-Sent Events)
- **Email**: cola con reintentos automáticos
- **Navegador**: notificaciones nativas (cuando la app está en segundo plano)
- **Sonido**: tono configurable por usuario
- Tipos: INFO, SUCCESS, WARNING, ERROR
- Alertas automáticas:
  - Stock bajo de consumibles
  - Licencias por vencer (primera y segunda alerta)
  - Contratos por vencer
  - Garantías por vencer
  - Actas de entrega pendientes de aceptación

---

## 🏠 Landing Page (CMS)

- Página pública configurable desde el panel admin sin tocar código
- Secciones: Hero (título, subtítulo, CTA, imagen de fondo), Servicios, Banners
- Logo claro y oscuro configurables
- Metadatos SEO (título, descripción)

---

## ⚙️ Configuración del Sistema

### Configuración Global

- Nombre y descripción del sistema
- Email de soporte
- Configuración SMTP (con prueba de envío desde la UI)
- Límite de archivos adjuntos
- Timeout de sesión por inactividad
- Intentos máximos de login
- Auto-cierre de tickets resueltos (días)
- Backups automáticos (frecuencia, retención)

### Configuración de Tickets por Familia

- Habilitar/deshabilitar tickets por familia
- Familias de origen permitidas (restricción de acceso)

### Configuración de Inventario por Familia

- Ver sección "Configuración de Inventario por Área" arriba

### Configuración de Inventario Global

- Alertas de stock bajo (habilitar/deshabilitar)
- Alertas de licencias y contratos (días de anticipación, primera y segunda alerta)
- Alertas de garantías (días de anticipación)
- Días para aceptar actas de entrega antes de expirar

### Políticas de SLA

- Editables desde la UI
- Por prioridad: tiempo de respuesta, tiempo de resolución, horario

---

## 🔐 Seguridad

- JWT con refresco de permisos cacheado (2 min TTL en Redis)
- Rate limiting distribuido por usuario/IP (Redis `INCR + EXPIRE`)
- Control de acceso por rol + familia asignada
- Auditoría completa de todas las acciones (quién, qué, cuándo, desde dónde)
- Bloqueo de cuenta por intentos fallidos (configurable)
- Encriptación de claves de licencias en BD
- Headers de seguridad HTTP (X-Frame-Options, X-Content-Type-Options)
- Protección CSRF via NextAuth

---

## ⚡ Rendimiento (Redis)

Caché en 3 capas para resistir alta carga:

| Capa | Tecnología                   | Latencia  |
| ---- | ---------------------------- | --------- |
| L1   | Cache-Control HTTP (browser) | 0ms       |
| L2   | Redis (withCache)            | ~1ms      |
| L3   | PostgreSQL (Prisma)          | 100-900ms |

Endpoints cacheados: familias, departamentos, categorías, usuarios, settings, landing page, JWT callback, permisos de inventario.

---

## 📊 Auditoría

- Registro de todas las acciones: creación, edición, eliminación, login, logout
- Filtros por tipo de entidad, acción, usuario y período
- Estadísticas de actividad
- Solo accesible para SUPER_ADMIN
- Caché de 1-2 minutos para queries pesadas de agregación
