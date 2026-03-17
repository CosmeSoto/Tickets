# Características del Sistema

## Roles de Usuario

| Rol        | Descripción                                      |
|------------|--------------------------------------------------|
| ADMIN      | Acceso total, gestión de usuarios y configuración |
| TECHNICIAN | Gestión de tickets asignados e inventario          |
| CLIENT     | Crear tickets y ver sus propios tickets            |

## Módulo de Tickets

- Creación de tickets con categorías jerárquicas (3 niveles)
- Asignación automática y manual a técnicos
- Sistema de SLA con 4 niveles de prioridad (Urgent, High, Medium, Low)
- Comentarios y adjuntos en tickets
- Estados: OPEN, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED
- Reportes y métricas (tiempo de respuesta, resolución, SLA compliance)
- Base de conocimientos integrada
- Auditoría completa de todas las acciones

## Módulo de Inventario

### Equipos
- Registro de equipos con código único y QR
- Tipos dinámicos (Laptop, Desktop, Monitor, Impresora, etc.)
- Estados: AVAILABLE, ASSIGNED, MAINTENANCE, DAMAGED, RETIRED
- Soporte para equipos propios, rentados y en préstamo
- Asignación a usuarios con actas de entrega digitales
- Historial de asignaciones y mantenimientos
- Vinculación de tickets con equipos

### Licencias de Software
- Registro de licencias con claves encriptadas
- Tipos dinámicos (Windows, Office 365, Antivirus, etc.)
- Control de vencimiento con alertas automáticas
- Asignación a usuarios y equipos

### Consumibles
- Control de stock con movimientos (entrada, salida, ajuste)
- Asignación de consumibles a equipos y usuarios
- Alertas de stock bajo y agotado (notificación + email a admins)
- Tipos dinámicos (Tóner, Tinta, Papel, Cable, etc.)
- Unidades de medida configurables

### Catálogos Dinámicos
- Tipos de equipo, licencia y consumible editables desde la UI
- Unidades de medida configurables
- Cada catálogo con código único, nombre, icono y orden

### Actas Digitales
- Actas de entrega y devolución de equipos
- Generación de PDF
- Flujo de verificación y aceptación/rechazo
- Folio secuencial automático por año

## Notificaciones

- In-app (campana de notificaciones)
- Email (cola de emails con reintentos)
- Tipos: INFO, SUCCESS, WARNING, ERROR, INVENTORY
- Alertas automáticas de stock bajo, licencias por vencer, equipos rentados por vencer

## Landing Page (CMS)

- Página pública configurable desde el panel admin
- Secciones: Hero, Servicios, Stats, FAQ
- Editable sin tocar código

## Configuración

- Configuración del sitio (nombre, email soporte, archivos permitidos)
- Configuración de inventario (permisos técnicos, alertas, días de expiración)
- Políticas de SLA editables
- Preferencias de notificación por usuario
