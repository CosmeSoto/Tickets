# ANÁLISIS TÉCNICO-PROFESIONAL DEL SISTEMA DE GESTIÓN INTEGRAL

**Documento de Especificación de Requerimientos, Alcance y Consideraciones Técnicas**

---

## TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Análisis del Proyecto](#2-análisis-del-proyecto)
3. [Objetivos del Sistema](#3-objetivos-del-sistema)
4. [Alcance del Sistema](#4-alcance-del-sistema)
5. [Limitaciones del Sistema](#5-limitaciones-del-sistema)
6. [Requisitos del Sistema](#6-requisitos-del-sistema)
7. [Riesgos Identificados](#7-riesgos-identificados)
8. [Arquitectura Técnica](#8-arquitectura-técnica)
9. [Conclusiones y Recomendaciones](#9-conclusiones-y-recomendaciones)

---

## 1. RESUMEN EJECUTIVO

### 1.1 Descripción General del Proyecto

El **Sistema de Gestión Integral** es una plataforma web empresarial de arquitectura modular desarrollada en **Next.js 16** con **TypeScript**, diseñada para automatizar y centralizar procesos operativos, gestión de recursos y comunicación organizacional. El sistema integra funcionalidades de soporte técnico, gestión de inventario, control de seguridad física, base de conocimientos y comunicaciones internas en un único entorno seguro y escalable.

### 1.2 Objetivo Principal

Proporcionar una solución integral de gestión que reduzca fragmentación de procesos, mejore respuesta operativa mediante SLA automatizado, optimice utilización de recursos tecnológicos y físicos, y centralice la información organizacional en una plataforma de acceso controlado con auditoría completa.

### 1.3 Justificación del Sistema

**Contexto empresarial:**

- Gestión dispersa de solicitudes de soporte sin métricas centralizadas
- Inventario no consolidado de activos tecnológicos
- Ausencia de trazabilidad en procesos de seguridad física
- Información operativa fragmentada sin repositorio centralizado
- Necesidad de control de acceso granular por roles y áreas organizacionales

**Valor agregado:**

- Automatización de procesos manuales, reduciendo tiempo de respuesta
- Visibilidad en tiempo real mediante dashboards y reportes
- Cumplimiento de SLA con alertas automáticas
- Auditoría completa para gobiernos corporativo
- Escalabilidad horizontal mediante arquitectura containerizada
- Bajo costo operativo con stack open source y plataformas cloud estándar

---

## 2. ANÁLISIS DEL PROYECTO

### 2.1 Problema o Necesidad que Resuelve

| Problemática                           | Solución Propuesta                            |
| -------------------------------------- | --------------------------------------------- |
| Solicitudes de soporte sin seguimiento | Gestión centralizada con SLA y notificaciones |
| Inventario fragmentado                 | Módulo único consolidado con trazabilidad     |
| Rondas de seguridad sin registro       | Patrullas geolocalizadas con evidencia        |
| Información diseminada                 | Base de conocimientos integrada               |
| Sin control de acceso por rol          | RBAC jerárquico por familia/departamento      |
| Capacidad de reporte limitada          | 11+ reportes con exportación múltiple         |

### 2.2 Contexto Organizacional

El sistema es aplicable a organizaciones de **cualquier tamaño** que requieran:

- Estructura jerárquica con múltiples áreas/familias operativas
- Equipos de soporte técnico distribuidos
- Control de activos tecnológicos y consumibles
- Procesos de seguridad física o vigilancia
- Necesidad de trazabilidad y auditoría

**Modelos de implementación:**

| Modelo                  | Caso de Uso                              |
| ----------------------- | ---------------------------------------- |
| **Departamental**       | Un área / familia con grupos funcionales |
| **Multi-familia**       | Múltiples sedes / líneas de negocio      |
| **Matrices/Grupos**     | Empresas grandes con estructura compleja |
| **Integración externa** | Terceros como proveedores de servicios   |

### 2.3 Procesos Involucrados

#### **Ciclo de vida operativo:**

```
1. CREACIÓN → 2. ASIGNACIÓN → 3. EJECUCIÓN → 4. RESOLUCIÓN → 5. DOCUMENTACIÓN
   (Solicitud)  (Recursos)    (Seguimiento) (Cumplimiento)  (Conocimiento)
```

#### **Procesos por módulo:**

| Módulo             | Procesos Clave                                                    |
| ------------------ | ----------------------------------------------------------------- |
| **Tickets**        | Recepción → Clasificación → Asignación → Seguimiento → Resolución |
| **Inventario**     | Adquisición → Asignación → Mantenimiento → Auditoría → Baja       |
| **Patrullas**      | Programación → Ejecución → Validación → Reportes → Análisis       |
| **Conocimiento**   | Captura → Indexación → Búsqueda → Votación → Actualización        |
| **Comunicaciones** | Redacción → Publicación → Segmentación → Medición → Análisis      |

### 2.4 Actores o Usuarios del Sistema

**Matriz de Actores:**

| Actor               | Rol Principal | Responsabilidades                           | Cantidad |
| ------------------- | ------------- | ------------------------------------------- | -------- |
| **Super Admin**     | Administrador | Configuración global, auditoría, usuarios   | 1-2      |
| **Admin de Área**   | Gestor        | Usuarios, inventario, tickets de su familia | 3-10     |
| **Técnico**         | Ejecutor      | Resolución de tickets, mantenimiento        | 10-50    |
| **Gestor Inv.**     | Especialista  | Control de activos, contratos, proveedores  | 2-5      |
| **Cliente/Usuario** | Solicitante   | Creación de tickets, consulta de estado     | 50-500   |
| **Auditor**         | Observador    | Revisión de logs, métricas de cumplimiento  | 1-2      |

---

## 3. OBJETIVOS DEL SISTEMA

### 3.1 Objetivo General

Implementar una plataforma integrada de gestión empresarial que centralice procesos operativos, recursos tecnológicos y comunicaciones organizacionales, proporcionando visibilidad en tiempo real, control de acceso granular y auditoría completa para mejorar eficiencia operativa y trazabilidad.

### 3.2 Objetivos Específicos

#### **O1. Gestión de Tickets de Soporte**

- Establecer canal centralizado para solicitudes con SLA automático
- Reducir tiempo de respuesta promedio mediante asignación inteligente
- Garantizar cumplimiento de acuerdos de nivel de servicio
- Proporcionar trazabilidad completa de resoluciones

#### **O2. Control de Inventario**

- Mantener registro actualizado de todos los activos empresariales
- Reducir pérdida de equipamiento mediante seguimiento de movimientos
- Automatizar alertas de vencimiento y stock bajo
- Facilitar depreciación contable de activos

#### **O3. Seguridad Física**

- Documentar rondas de patrullas con evidencia geolocalizada
- Crear registro auditable de actividades de vigilancia
- Soporte offline para zonas sin conectividad

#### **O4. Captura y Reutilización de Conocimiento**

- Convertir tickets resueltos en artículos reutilizables
- Reducir ticket duplicados mediante búsqueda de soluciones previas
- Facilitar onboarding de nuevos técnicos

#### **O5. Comunicación Organizacional**

- Centralizar noticias y anuncios de empresa
- Segmentar comunicaciones por rol, área o usuario
- Medir impacto de comunicaciones mediante reacciones y visualizaciones

#### **O6. Control Acceso y Auditoría**

- Implementar RBAC granular por familia y rol
- Registrar todas las acciones para auditoría regulatoria
- Detectar y prevenir acceso no autorizado

---

## 4. ALCANCE DEL SISTEMA

### 4.1 Funcionalidades Incluidas

#### **Módulo 1: Tickets de Soporte**

- ✅ Creación, lectura, actualización de tickets
- ✅ Ciclo de vida: OPEN → IN_PROGRESS → RESOLVED → CLOSED
- ✅ Prioridad y SLA automático (URGENT, HIGH, MEDIUM, LOW)
- ✅ Asignación automática y manual con validación de familia
- ✅ Categorías jerárquicas hasta 4 niveles
- ✅ Comentarios, adjuntos y timeline de actividad
- ✅ Colaboradores múltiples por ticket
- ✅ Planes de resolución con tareas
- ✅ Base de conocimientos integrada
- ✅ Reportes de SLA, respuesta y satisfacción
- ✅ Exportación CSV/Excel/PDF

#### **Módulo 2: Inventario**

- ✅ Registro de equipos con código QR
- ✅ Gestión de licencias de software con encriptación
- ✅ Control de consumibles con stock e historial
- ✅ Gestión de contratos con alertas de vencimiento
- ✅ Actas digitales (entrega, devolución, baja)
- ✅ Asignación de equipos a usuarios
- ✅ Depreciación configurable (3 métodos)
- ✅ Proveedores y almacenes
- ✅ Solicitudes y ventas de activos
- ✅ 11 tipos de reportes con exportación
- ✅ Configuración granular por familia

#### **Módulo 3: Rondas y Patrullas**

- ✅ Planificación de rutas con puntos geolocalizados
- ✅ Ejecución offline con sincronización posterior
- ✅ Validación QR dinámica/estática con ventana temporal
- ✅ Registro de incidencias con fotos
- ✅ Programación recurrente (diaria, semanal, personalizada)
- ✅ Reportes de cumplimiento con porcentaje

#### **Módulo 4: Base de Conocimientos**

- ✅ Creación de artículos desde tickets resueltos
- ✅ Búsqueda full-text con Fuse.js
- ✅ Sistema de votación por usuario
- ✅ Clasificación por categorías y familias
- ✅ Control de acceso por rol

#### **Módulo 5: Comunicaciones Internas**

- ✅ Publicación de noticias, anuncios, eventos
- ✅ Segmentación por rol, departamento, familia, usuarios
- ✅ Fechas de vigencia (inicio y fin)
- ✅ Reacciones y comentarios
- ✅ Archivos adjuntos
- ✅ Estadísticas de visualización

#### **Módulo 6: Usuarios y Familias**

- ✅ 4 roles principales: SUPER_ADMIN, ADMIN, TECHNICIAN, CLIENT
- ✅ Gestión de avatar y perfil
- ✅ Asignación a familias y departamentos
- ✅ Configuración de notificaciones por usuario
- ✅ OAuth (Google, Microsoft)
- ✅ Exportación de usuarios

#### **Módulo 7: Notificaciones**

- ✅ In-app en tiempo real (SSE)
- ✅ Email con cola y reintentos
- ✅ Push del navegador
- ✅ Alertas automáticas (stock, vencimientos, SLA)

#### **Módulo 8: Landing Page (CMS)**

- ✅ Página pública editable sin código
- ✅ Secciones Hero, Servicios, Banners
- ✅ Meta datos SEO
- ✅ Estadísticas de clics

#### **Módulo 9: Configuración**

- ✅ Parámetros SMTP
- ✅ Políticas SLA editables
- ✅ Límites de archivos
- ✅ Timeouts de sesión
- ✅ Backups automáticos

#### **Módulo 10: Auditoría**

- ✅ Log completo de acciones
- ✅ Filtros por tipo, usuario, período
- ✅ Exportación de auditoría
- ✅ Solo acceso SUPER_ADMIN

### 4.2 Módulos Contemplados

```
┌─────────────────────────────────────────────────────────────┐
│               SISTEMA DE GESTIÓN INTEGRAL                    │
├─────────────────────────────────────────────────────────────┤
│  OPERACIONES (§3)        │ CONOCIMIENTO (§4)                │
│  ├─ Tickets              │ ├─ Base de Conocimientos         │
│  ├─ Patrullas            │ └─ Comunicaciones Internas       │
│  └─ Formularios*         │                                  │
├─────────────────────────────────────────────────────────────┤
│  RECURSOS (§5)           │ PLATAFORMA (§6)                  │
│  └─ Inventario           │ ├─ Usuarios y Familias           │
│                          │ ├─ Notificaciones                │
│                          │ ├─ Landing Page (CMS)            │
│                          │ └─ Configuración & Seguridad     │
└─────────────────────────────────────────────────────────────┘

* Formularios: módulo menor para documentos / formularios por área
```

### 4.3 Procesos a Automatizar

| Proceso                     | Automatización                                |
| --------------------------- | --------------------------------------------- |
| Asignación de tickets       | Basada en categoría, carga, disponibilidad    |
| Alertas de SLA              | Notificación automática 2h antes de violación |
| Vencimiento de licencias    | Email 60/30 días antes + in-app               |
| Stock bajo de consumibles   | Alerta automática al gestor                   |
| Cierre de tickets resueltos | Cierre automático después N días sin cambios  |
| Generación de actas         | PDF automático con folio secuencial           |
| Backups de base de datos    | Diarios (incremental) + semanales (completo)  |
| Notificaciones de cambios   | Email + in-app en tiempo real vía SSE         |

### 4.4 Integraciones Previstas

| Sistema               | Tipo          | Estado          |
| --------------------- | ------------- | --------------- |
| **OAuth 2.0**         | Autenticación | ✅ Implementado |
| **Google OAuth**      | Autenticación | ✅ Implementado |
| **Microsoft OAuth**   | Autenticación | ✅ Implementado |
| **SMTP**              | Email         | ✅ Implementado |
| **Webhooks**          | Eventos       | ✅ Implementado |
| **Base de datos**     | Persistencia  | ✅ PostgreSQL   |
| **Caché distribuido** | Performance   | ✅ Redis        |
| **QR dinámico**       | Validación    | ✅ Implementado |

### 4.5 Entregables Esperados

| Entregable                 | Descripción                            |
| -------------------------- | -------------------------------------- |
| **Aplicación web**         | Next.js deployable en Docker           |
| **API REST**               | 50+ endpoints documentados             |
| **Base de datos**          | Esquema PostgreSQL con 70+ modelos     |
| **Documentación técnica**  | README, SETUP, DEPLOYMENT, FEATURES    |
| **Manuales de usuario**    | Por rol (Admin, Técnico, Cliente)      |
| **Guías de configuración** | SMTP, OAuth, SLA, notificaciones       |
| **Scripts de migración**   | Herramientas para importación de datos |
| **Tests automatizados**    | Jest (unitarios), Playwright (E2E)     |
| **Reportes de seguridad**  | Auditoría, rate limiting, encriptación |

### 4.6 Límites del Proyecto

| Límite                 | Descripción                                             |
| ---------------------- | ------------------------------------------------------- |
| **No incluye**         | Integración con sistemas legacy (ERP, CRM)              |
| **Autenticación**      | Solo NextAuth + OAuth; no LDAP/AD nativo                |
| **Comunicaciones**     | Email; sin SMS/WhatsApp nativo                          |
| **Geolocalización**    | Solo en módulo Patrullas; GPS del navegador/dispositivo |
| **Videoconferencia**   | No integrada; solo enlace a terceros                    |
| **Machine learning**   | Sin clasificación automática ni predictivos             |
| **Multi-idioma**       | Aplicación en español; sin i18n generalizado            |
| **Custodia normativa** | Cumple auditoría IT general; no regulación específica   |

---

## 5. LIMITACIONES DEL SISTEMA

### 5.1 Restricciones Técnicas

#### **5.1.1 Rendimiento**

| Limitación               | Valor      | Impacto                                         |
| ------------------------ | ---------- | ----------------------------------------------- |
| Archivos adjuntos máximo | 25 MB      | Requiere compresión para multimedia             |
| Usuarios concurrentes    | 200-500    | Escalamiento horizontal requiere load balancer  |
| Registros en tabla       | 1M+        | Queries complejas necesitan índices optimizados |
| Caché Redis TTL máximo   | 30 minutos | Datos cacheados pueden estar hasta 30 min       |
| Latencia API p95         | <500 ms    | Basado en PostgreSQL + Redis                    |

#### **5.1.2 Integraciones**

| Limitación         | Restricción                                 |
| ------------------ | ------------------------------------------- |
| **SMTP**           | Solo protocolos estándar (TLS); sin OAuth2  |
| **OAuth**          | Soportados Google y Microsoft; no AD nativo |
| **Base de datos**  | PostgreSQL 15+; no MySQL, MongoDB           |
| **Caché**          | Redis 7; sin Memcached                      |
| **Almacenamiento** | Sistema local (mounted volumes); sin S3     |
| **Webhooks**       | HTTP/HTTPS solo; payload máx 10 MB          |
| **QR dinámico**    | Generado en memoria; no API externa         |

#### **5.1.3 Contenedores y Escalabilidad**

| Aspecto           | Limitación                                    |
| ----------------- | --------------------------------------------- |
| **Instancias**    | Require load balancer exterior para múltiples |
| **Persistencia**  | PostgreSQL + volumen Docker; no replicación   |
| **Rate limiting** | Redis distribuido; requiere mismo Redis       |
| **Sesiones**      | Almacenadas en BD; requiere BD centralizad    |

### 5.2 Restricciones Operativas

#### **5.2.1 Disponibilidad y Mantenimiento**

| Restricción                   | Impacto                                       |
| ----------------------------- | --------------------------------------------- |
| **Ventana de backups**        | <1 hora; requiere scheduler externo           |
| **Actualizaciones BD**        | Requiere migration + downtime planificado     |
| **Rotación de secretos**      | Manual; sin automatización de rotación        |
| **Monitoreo**                 | Requiere herramientas externas (Datadog, etc) |
| **Alertas de infraestructra** | Sin integración nativa; requiere webhooks     |

#### **5.2.2 Cambios de Datos**

| Restricción               | Implicación                               |
| ------------------------- | ----------------------------------------- |
| **Migraciones grandes**   | Pueden tomar horas en bases >100 GB       |
| **Eliminación de datos**  | Sin reversión automática; requiere backup |
| **Cambios de estructura** | Requieren migración + downtime            |

### 5.3 Restricciones Presupuestarias

| Aspecto              | Consideración                                 |
| -------------------- | --------------------------------------------- |
| **Infraestructura**  | $50-300/mes según escala (cloud estándar)     |
| **Licencias**        | Stack open source (0 costo de software)       |
| **Soporte**          | Requiere equipo técnico interno o consultoría |
| **Mantenimiento**    | 1 DevOps + 1 Desarrollador full-stack         |
| **Datos históricos** | Storage se incrementa ~1-5 GB/mes según uso   |

### 5.4 Restricciones de Tiempo

#### **5.4.1 Implementación**

| Fase                         | Duración Estimada         |
| ---------------------------- | ------------------------- |
| **Infraestructura**          | 3-5 días                  |
| **Configuración inicial**    | 2-3 días                  |
| **Migración de datos**       | 5-15 días (según volumen) |
| **Capacitación de usuarios** | 3-5 días                  |
| **Go-live**                  | 10-15 días totales        |

#### **5.4.2 Mantenimiento Periódico**

| Actividad                   | Frecuencia                                    |
| --------------------------- | --------------------------------------------- |
| **Backups**                 | Diarios (incremental) + semanales (completo)  |
| **Prueba de restauración**  | Mensual (ejecución real)                      |
| **Actualizaciones de deps** | Trimestral (seguridad) o según vulnerabilidad |
| **Auditoría de seguridad**  | Anual + eventos específicos                   |
| **Limpieza de logs**        | Semestral (archivado a storage externo)       |

### 5.5 Dependencias Externas

| Dependencia                  | Riesgo                                      | Mitigación                            |
| ---------------------------- | ------------------------------------------- | ------------------------------------- |
| **Servidor de email (SMTP)** | Fallo de servicio → tickets no se notifican | Monitoreo + retintos automáticos      |
| **OAuth providers**          | Google/Microsoft down → login fallido       | Fallback a contraseña manual          |
| **Proveedor de hosting**     | Outage → aplicación no disponible           | SLA del proveedor (99.9%)             |
| **DNS**                      | Resolución fallida → aplicación inaccesible | Redundancia de DNS                    |
| **Certificado SSL**          | Vencimiento → conexión rechazada            | Renovación automática (Let's Encrypt) |

### 5.6 Supuestos del Proyecto

| Supuesto                  | Validez                                     |
| ------------------------- | ------------------------------------------- |
| **Conectividad**          | Conexión a Internet estable (100 Mbps min)  |
| **Hardware**              | Servidor con 4+ vCPU, 8+ GB RAM             |
| **Data correcta**         | Datos migrados verificados antes de cutover |
| **Usuarios capacitados**  | Usuarios reciben capacitación pre-go-live   |
| **Roles definidos**       | Estructura RBAC claramente definida         |
| **Volumen predecible**    | Crecimiento de datos < 2x en 12 meses       |
| **Navegadores modernos**  | Chrome, Firefox, Safari versiones actuales  |
| **JavaScript habilitado** | Cliente habilita JavaScript                 |

---

## 6. REQUISITOS DEL SISTEMA

### 6.1 Requisitos Funcionales

#### **RF1: Gestión de Tickets**

| ID    | Requisito                                                                         | Prioridad |
| ----- | --------------------------------------------------------------------------------- | --------- |
| RF1.1 | Sistema debe permitir crear tickets con título, descripción, prioridad, categoría | ALTA      |
| RF1.2 | Sistema debe asignar SLA automático basado en prioridad                           | ALTA      |
| RF1.3 | Sistema debe asignar ticket a técnico automática o manualmente                    | ALTA      |
| RF1.4 | Sistema debe mostrar timeline de cambios por ticket                               | ALTA      |
| RF1.5 | Sistema debe generar artículos de conocimiento desde tickets resueltos            | MEDIA     |
| RF1.6 | Sistema debe exportar tickets a Excel, CSV, PDF                                   | MEDIA     |

#### **RF2: Gestión de Inventario**

| ID     | Requisito                                                           | Prioridad |
| ------ | ------------------------------------------------------------------- | --------- |
| RF2.1  | Sistema debe registrar equipos con código único autogenerado        | ALTA      |
| RF2.2  | Sistema debe generar código QR por equipo                           | ALTA      |
| RF2.3  | Sistema debe permitir asignación de equipos a usuarios              | ALTA      |
| RF2.4  | Sistema debe registrar licencias con clave encriptada               | ALTA      |
| RF2.5  | Sistema debe alertar vencimientos (licencias, contratos, garantías) | ALTA      |
| RF2.6  | Sistema debe controlar stock de consumibles                         | ALTA      |
| RF2.7  | Sistema debe generar actas digitales (entrega, devolución, baja)    | ALTA      |
| RF2.8  | Sistema debe calcular depreciación según método configurable        | MEDIA     |
| RF2.9  | Sistema debe permitir solicitudes de activos con SLA                | MEDIA     |
| RF2.10 | Sistema debe exportar 11 tipos de reportes de inventario            | MEDIA     |

#### **RF3: Patrullas y Rondas**

| ID    | Requisito                                                        | Prioridad |
| ----- | ---------------------------------------------------------------- | --------- |
| RF3.1 | Sistema debe permitir planificar rutas con puntos geolocalizados | ALTA      |
| RF3.2 | Sistema debe funcionar offline con sincronización                | ALTA      |
| RF3.3 | Sistema debe validar QR dinámico/estático con ventana temporal   | ALTA      |
| RF3.4 | Sistema debe registrar incidencias con foto geolocalizada        | MEDIA     |
| RF3.5 | Sistema debe permitir programación recurrente de rondas          | MEDIA     |

#### **RF4: Base de Conocimientos**

| ID    | Requisito                                            | Prioridad |
| ----- | ---------------------------------------------------- | --------- |
| RF4.1 | Sistema debe crear artículos desde tickets resueltos | ALTA      |
| RF4.2 | Sistema debe buscar full-text en artículos           | ALTA      |
| RF4.3 | Sistema debe permitir votación de utilidad           | MEDIA     |

#### **RF5: Comunicaciones**

| ID    | Requisito                                                 | Prioridad |
| ----- | --------------------------------------------------------- | --------- |
| RF5.1 | Sistema debe permitir publicar noticias segmentadas       | ALTA      |
| RF5.2 | Sistema debe permitir fechas de vigencia en publicaciones | MEDIA     |
| RF5.3 | Sistema debe registrar reacciones y comentarios           | MEDIA     |

#### **RF6: Usuarios y Control de Acceso**

| ID    | Requisito                                                                | Prioridad |
| ----- | ------------------------------------------------------------------------ | --------- |
| RF6.1 | Sistema debe implementar 4 roles: SUPER_ADMIN, ADMIN, TECHNICIAN, CLIENT | ALTA      |
| RF6.2 | Sistema debe asignar usuarios a familias y departamentos                 | ALTA      |
| RF6.3 | Sistema debe permitir autenticación OAuth (Google, Microsoft)            | MEDIA     |
| RF6.4 | Sistema debe bloquear cuenta por intentos fallidos                       | MEDIA     |

#### **RF7: Notificaciones**

| ID    | Requisito                                                      | Prioridad |
| ----- | -------------------------------------------------------------- | --------- |
| RF7.1 | Sistema debe enviar notificaciones in-app en tiempo real (SSE) | ALTA      |
| RF7.2 | Sistema debe enviar notificaciones por email                   | ALTA      |
| RF7.3 | Sistema debe enviar notificaciones push del navegador          | MEDIA     |
| RF7.4 | Sistema debe alertar automáticamente sobre vencimientos        | ALTA      |

#### **RF8: Auditoría**

| ID    | Requisito                                                      | Prioridad |
| ----- | -------------------------------------------------------------- | --------- |
| RF8.1 | Sistema debe registrar todas las acciones (quién, qué, cuándo) | ALTA      |
| RF8.2 | Sistema debe permitir filtrar logs por usuario, tipo, período  | ALTA      |
| RF8.3 | Sistema debe exportar auditoría                                | MEDIA     |

### 6.2 Requisitos No Funcionales

#### **RNF1: Rendimiento**

| ID     | Requisito                      | Métrica de Éxito |
| ------ | ------------------------------ | ---------------- |
| RNF1.1 | Tiempo de carga de página      | < 2 segundos     |
| RNF1.2 | Latencia de API (p95)          | < 500 ms         |
| RNF1.3 | Queries complejos (reportes)   | < 5 segundos     |
| RNF1.4 | Capacidad simultánea           | 200-500 usuarios |
| RNF1.5 | Caché reduce queries DB en 80% | Cache hit rate   |

#### **RNF2: Escalabilidad**

| ID     | Requisito                                  | Métrica de Éxito              |
| ------ | ------------------------------------------ | ----------------------------- |
| RNF2.1 | Sistema debe soportar crecimiento de datos | Hasta 5 años sin re-arquitect |
| RNF2.2 | Arquitectura horizontal                    | Múltiples instancias          |
| RNF2.3 | Base de datos distribuida                  | Replicación posible           |

#### **RNF3: Disponibilidad**

| ID     | Requisito                    | Métrica de Éxito    |
| ------ | ---------------------------- | ------------------- |
| RNF3.1 | Disponibilidad mensual       | ≥ 99.9%             |
| RNF3.2 | Tiempo de recuperación (RTO) | < 4 horas           |
| RNF3.3 | Punto de recuperación (RPO)  | < 1 hora            |
| RNF3.4 | Backups automáticos          | Diarios + semanales |

#### **RNF4: Usabilidad**

| ID     | Requisito             | Métrica de Éxito            |
| ------ | --------------------- | --------------------------- |
| RNF4.1 | Interfaz intuitiva    | Tasks completables <3 clics |
| RNF4.2 | Responsive design     | Mobile + desktop            |
| RNF4.3 | Accesibilidad         | WCAG 2.1 AA                 |
| RNF4.4 | Tiempo de aprendizaje | < 2 horas capacitación      |

#### **RNF5: Mantenibilidad**

| ID     | Requisito           | Métrica de Éxito    |
| ------ | ------------------- | ------------------- |
| RNF5.1 | Código documentado  | JSDoc + comentarios |
| RNF5.2 | Tests automatizados | > 80% cobertura     |
| RNF5.3 | API documentada     | OpenAPI / Swagger   |

### 6.3 Requisitos de Seguridad

#### **RS1: Autenticación y Autorización**

| ID    | Requisito                                           |
| ----- | --------------------------------------------------- |
| RS1.1 | Contraseñas mínimo 12 caracteres con complejidad    |
| RS1.2 | JWT con expiración y refresh tokens                 |
| RS1.3 | RBAC granular por familia + rol                     |
| RS1.4 | Bloqueo de cuenta después 5 intentos fallidos       |
| RS1.5 | Timeout de sesión (15 min inactividad) configurable |

#### **RS2: Encriptación**

| ID    | Requisito                                      |
| ----- | ---------------------------------------------- |
| RS2.1 | HTTPS en todos los entornos                    |
| RS2.2 | Claves de licencia encriptadas en BD (AES-256) |
| RS2.3 | Datos sensibles no en logs                     |
| RS2.4 | Secrets gestionados por variables de entorno   |

#### **RS3: Auditoría y Monitoreo**

| ID    | Requisito                                                  |
| ----- | ---------------------------------------------------------- |
| RS3.1 | Log completo de acciones (quién, qué, cuándo, desde dónde) |
| RS3.2 | Retención de logs ≥ 1 año                                  |
| RS3.3 | Alertas de actividad sospechosa                            |
| RS3.4 | Imposibilidad de borrar logs de auditoría                  |

#### **RS4: Control de Acceso a Datos**

| ID    | Requisito                                                 |
| ----- | --------------------------------------------------------- |
| RS4.1 | Usuario solo ve datos de su familia (excepto SUPER_ADMIN) |
| RS4.2 | Validación de acceso en cada endpoint                     |
| RS4.3 | Rate limiting por usuario/IP                              |
| RS4.4 | Protección CSRF en formularios                            |

#### **RS5: Cumplimiento Regulatorio**

| ID    | Requisito                                  |
| ----- | ------------------------------------------ |
| RS5.1 | Cumplimiento OWASP Top 10                  |
| RS5.2 | Auditoría externa anual recomendada        |
| RS5.3 | Políticas de privacidad documentadas       |
| RS5.4 | GDPR-ready (derecho al olvido documentado) |

### 6.4 Requisitos de Infraestructura

#### **RI1: Hardware**

| Componente         | Especificación Mínima | Especificación Recomendada |
| ------------------ | --------------------- | -------------------------- |
| **vCPU**           | 2                     | 4-8                        |
| **RAM**            | 4 GB                  | 8-16 GB                    |
| **Almacenamiento** | 50 GB SSD             | 100-200 GB SSD             |
| **Ancho de banda** | 100 Mbps simétrico    | 1 Gbps                     |
| **IP pública**     | Obligatoria           | Fija                       |

#### **RI2: Software**

| Componente     | Especificación               |
| -------------- | ---------------------------- |
| **OS**         | Ubuntu 22.04 LTS / Debian 13 |
| **Docker**     | 20.10+                       |
| **PostgreSQL** | 15+                          |
| **Redis**      | 7+                           |
| **Node.js**    | 18+                          |
| **Nginx**      | 1.20+                        |

#### **RI3: Networking**

| Requisito            | Especificación                           |
| -------------------- | ---------------------------------------- |
| **Puertos públicos** | 80 (HTTP), 443 (HTTPS), 22 (SSH)         |
| **Firewall**         | Bloquear todo excepto puertos necesarios |
| **Certificado SSL**  | Let's Encrypt o CA comercial             |
| **DNS**              | Dominio propio con registros A/AAAA      |
| **Backup externo**   | Almacenamiento separado al servidor      |

---

## 7. RIESGOS IDENTIFICADOS

### 7.1 Riesgos Técnicos

#### **RT1: Pérdida de Datos**

| Riesgo                 | Probabilidad | Impacto | Puntuación |
| ---------------------- | ------------ | ------- | ---------- |
| Fallo de BD sin backup | Media        | Crítico | 16/25      |

**Mitigación:**

- Backups automáticos diarios (incremental) + semanales (completo)
- Pruebas de restauración mensual (ejecución real)
- Almacenamiento de backups en ubicación separada
- Documentación clara del procedimiento RTO

---

#### **RT2: Escalabildad Insuficiente**

| Riesgo                               | Probabilidad | Impacto | Puntuación |
| ------------------------------------ | ------------ | ------- | ---------- |
| Aumento de usuarios supera capacidad | Media        | Alto    | 12/25      |

**Mitigación:**

- Monitoreo de métricas (CPU, RAM, queries/seg)
- Benchmarking con carga esperada pre-go-live
- Arquitectura containerizada (escalamiento horizontal)
- Índices de BD optimizados para queries críticas
- Caché Redis en 3 capas

---

#### **RT3: Vulnerabilidades de Seguridad**

| Riesgo                   | Probabilidad | Impacto | Puntuación |
| ------------------------ | ------------ | ------- | ---------- |
| SQL Injection, XSS, CSRF | Media        | Crítico | 16/25      |

**Mitigación:**

- ORM (Prisma) protege de SQL Injection
- Validación Zod en entrada de datos
- Sanitización de HTML (rehype-sanitize)
- CSRF protection via NextAuth
- Rate limiting distribuido
- Auditoría completa de acciones
- Auditoría externa anual recomendada

---

#### **RT4: Downtime No Planeado**

| Riesgo                    | Probabilidad | Impacto | Puntuación |
| ------------------------- | ------------ | ------- | ---------- |
| Fallos de infraestructura | Baja         | Alto    | 8/25       |

**Mitigación:**

- SLA del proveedor de hosting (99.9%)
- Monitoreo continuo con alertas
- Documentación clara de procedimientos de rollback
- Capacidad de fallover a segunda instancia

---

#### **RT5: Actualización Fallida de BD**

| Riesgo                             | Probabilidad | Impacto | Puntuación |
| ---------------------------------- | ------------ | ------- | ---------- |
| Migración Prisma que quiebra datos | Baja         | Alto    | 8/25       |

**Mitigación:**

- Testing de migraciones en ambiente de staging
- Backup completo antes de cada migración
- Migraciones reversibles cuando sea posible
- Documentación de cada cambio de esquema

---

### 7.2 Riesgos Operativos

#### **RO1: Falta de Capacitación de Usuarios**

| Riesgo                         | Probabilidad | Impacto | Puntuación |
| ------------------------------ | ------------ | ------- | ---------- |
| Usuarios no saben usar sistema | Media        | Medio   | 9/25       |

**Mitigación:**

- Programa de capacitación pre-go-live (3-5 días)
- Manuales de usuario por rol (Admin, Técnico, Cliente)
- Videos tutoriales en plataforma
- Help desk disponible first 30 días

---

#### **RO2: Resistencia al Cambio**

| Riesgo                                | Probabilidad | Impacto | Puntuación |
| ------------------------------------- | ------------ | ------- | ---------- |
| Usuarios siguen con procesos antiguos | Media        | Medio   | 9/25       |

**Mitigación:**

- Involucrar usuarios clave en diseño (co-diseño)
- Demostración de valor en quick wins pre-go-live
- Comunicación clara de beneficios
- Soporte de change management

---

#### **RO3: Degradación de Datos Históricos**

| Riesgo                           | Probabilidad | Impacto | Puntuación |
| -------------------------------- | ------------ | ------- | ---------- |
| Datos migratorios inconsistentes | Baja         | Alto    | 8/25       |

**Mitigación:**

- Auditoría completa de datos antes de migración
- Validación row-by-row de datos críticos
- Período de dual-run (sistema antiguo + nuevo)
- Scripts de validación post-migración

---

#### **RO4: Dependencia de Personal Clave**

| Riesgo                            | Probabilidad | Impacto | Puntuación |
| --------------------------------- | ------------ | ------- | ---------- |
| Salida de único admin del sistema | Baja         | Alto    | 8/25       |

**Mitigación:**

- Documentación completa del sistema
- Capacitación de segundo administrador
- Runbooks de operación disponibles
- Acceso a código y configuración escrow

---

### 7.3 Riesgos Organizacionales

#### **ROG1: Cambio de Requisitos**

| Riesgo                                      | Probabilidad | Impacto | Puntuación |
| ------------------------------------------- | ------------ | ------- | ---------- |
| Nuevos requisitos emerge durante desarrollo | Alta         | Medio   | 12/25      |

**Mitigación:**

- Metodología ágil con sprints 2 semanas
- Validación con stakeholders cada 2 semanas
- Backlog claro y priorizado
- Change control process

---

#### **ROG2: Presupuesto Insuficiente**

| Riesgo                                        | Probabilidad | Impacto | Puntuación |
| --------------------------------------------- | ------------ | ------- | ---------- |
| Costos de infraestructura exceden presupuesto | Baja         | Medio   | 6/25       |

**Mitigación:**

- Estimación detallada pre-implementación
- Modelo de costos cloud transparente
- Revisión mensual de gastos vs presupuesto
- Opciones de optimización (Reserved Instances, etc)

---

#### **ROG3: Alineación Organizacional**

| Riesgo                                          | Probabilidad | Impacto | Puntuación |
| ----------------------------------------------- | ------------ | ------- | ---------- |
| Áreas no alineadas en proceso de implementación | Media        | Medio   | 9/25       |

**Mitigación:**

- Steering committee con representantes de cada área
- Reuniones semanales de alineación
- Comunicación clara de objetivos y cronograma
- Escalamiento de conflictos documentado

---

### 7.4 Estrategias de Mitigación Global

| Estrategia                 | Implementación                               |
| -------------------------- | -------------------------------------------- |
| **Gobernanza de Proyecto** | PMO con sprints 2 semanas, burndown charts   |
| **Control de Calidad**     | Tests automatizados 80%+, code review        |
| **Manejo de Riesgos**      | Registro actualizado, revisión semanal       |
| **Comunicación**           | Stakeholder updates quincenales, newsletters |
| **Documentación**          | Wiki interna + manuales PDF + videos         |
| **Soporte Post-Go-live**   | 30 días con help desk 8x5, SLA respuesta 2h  |

---

## 8. ARQUITECTURA TÉCNICA

### 8.1 Stack Tecnológico

#### **Frontend**

```
React 19 + TypeScript 5
├─ Next.js 16.1.1 (App Router, Turbopack)
├─ Tailwind CSS + Shadcn/UI
├─ Radix UI primitives
├─ Framer Motion (animaciones)
├─ Recharts (gráficas)
└─ React Hook Form (formularios)
```

#### **Backend**

```
Node.js 18+
├─ Next.js API Routes
├─ Prisma 6 (ORM)
├─ Zod (validación)
├─ NextAuth.js 4 (autenticación)
├─ Nodemailer (email)
├─ JSPush (notificaciones push)
└─ Redis (caché)
```

#### **Base de Datos**

```
PostgreSQL 15+
├─ 70+ modelos
├─ Índices optimizados
├─ Full-text search (tsvector)
└─ Procedimientos almacenados (PL/pgSQL)
```

#### **Infraestructura**

```
Docker + Docker Compose
├─ Nginx 1.20+ (proxy SSL)
├─ PostgreSQL 15
├─ Redis 7
└─ Next.js App
```

### 8.2 Arquitectura en Capas

```
┌────────────────────────────────────────────────────────┐
│              PRESENTATION LAYER                         │
│  React Components, Pages, UI (Tailwind + Shadcn)       │
└────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────┐
│              APPLICATION LAYER                          │
│  Next.js API Routes, Controllers, Hooks                │
└────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────┐
│              BUSINESS LOGIC LAYER                       │
│  Services, Utilities, Validations (Zod)                │
└────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────┐
│              DATA ACCESS LAYER                          │
│  Prisma ORM, Redis Cache, Database Queries             │
└────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────┐
│              DATA PERSISTENCE LAYER                     │
│  PostgreSQL Database + Redis Cache                     │
└────────────────────────────────────────────────────────┘
```

### 8.3 Diagrama de Flujo de Datos

```
User Browser
    ↓ (HTTPS)
[Nginx Proxy]
    ↓
[Next.js Server]
    ├─→ [Redis Cache] (L2 - 1ms)
    │      ↓
    ├─→ [PostgreSQL DB] (L3 - 100-900ms)
    │
    ├─→ [SMTP Server] (Email)
    │
    └─→ [OAuth Providers] (Auth)

SSE/Websocket ← Real-time Notifications
```

### 8.4 Componentes Principales

#### **Autenticación y Autorización**

```
Request
  ↓
[NextAuth Middleware]
  ├─ Validar JWT
  ├─ Verificar familia del usuario
  ├─ Cargar permisos de BD (cacheado 2 min)
  └─ Si inválido → 401 Unauthorized
```

#### **Caché Distribuido (Redis)**

```
Nivel 1: Browser Cache-Control (0ms, sin servidor)
  ↓
Nivel 2: Redis (1ms, sin BD)
  ├─ withCache() helper
  ├─ Familias, categorías, settings
  └─ TTL: 1-30 minutos según tipo
  ↓
Nivel 3: PostgreSQL (100-900ms)
```

#### **Rate Limiting**

```
Request desde User/IP
  ↓
[Redis INCR contador]
  ├─ INCR user:rateLimit:{user_id}
  ├─ EXPIRE 60 segundos
  ├─ Si contador > límite → 429 Too Many Requests
  └─ Si <= límite → Continuar
```

### 8.5 Modelos de Datos (Principales)

```
Users
├─ id, email, name, role
├─ family_id (FK)
├─ preferences (JSON)
└─ oauth_accounts

Tickets
├─ id, title, description
├─ status (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
├─ priority (URGENT, HIGH, MEDIUM, LOW)
├─ category_id (FK)
├─ assigned_to (FK Users)
├─ created_by (FK Users)
├─ sla_deadline
└─ comments, attachments, history

Inventory
├─ Equipment
│  ├─ id, code, qr_code
│  ├─ serial_number
│  ├─ status (AVAILABLE, ASSIGNED, MAINTENANCE, DAMAGED, RETIRED)
│  └─ assigned_to (FK Users)
├─ Licenses
│  ├─ id, key (encrypted)
│  ├─ expiry_date
│  └─ assigned_to (FK Users/Equipment)
└─ Consumibles
   ├─ id, name, stock
   ├─ min_stock, max_stock
   └─ movements (entry, exit, adjust)

Families
├─ id, name, code
├─ departments
├─ technicians
└─ config (JSON)

AuditLog
├─ id, user_id, action
├─ entity_type, entity_id
├─ old_value, new_value
├─ timestamp
└─ ip_address
```

### 8.6 Endpoints API (Resumen)

**Total: 50+ endpoints RESTful**

#### **Tickets (12 endpoints)**

- `POST /api/tickets` - Crear
- `GET /api/tickets` - Listar
- `GET /api/tickets/[id]` - Detalle
- `PATCH /api/tickets/[id]` - Actualizar
- `DELETE /api/tickets/[id]` - Eliminar
- `POST /api/tickets/[id]/comments` - Comentar
- `POST /api/tickets/[id]/attachments` - Adjuntar
- `POST /api/tickets/[id]/assign` - Asignar
- `POST /api/tickets/[id]/status` - Cambiar estado
- `GET /api/tickets/reports/*` - Reportes
- `GET /api/categories` - Categorías
- `GET /api/categories/search` - Búsqueda

#### **Inventario (15+ endpoints)**

- `POST /api/inventory/equipment` - Crear equipo
- `GET /api/inventory/equipment` - Listar
- `GET /api/inventory/equipment/[id]` - Detalle
- `PATCH /api/inventory/equipment/[id]` - Actualizar
- `POST /api/inventory/equipment/[id]/assign` - Asignar
- `POST /api/inventory/licenses` - Crear licencia
- `GET /api/inventory/licenses` - Listar
- `POST /api/inventory/consumibles` - Crear consumible
- `POST /api/inventory/contracts` - Crear contrato
- `GET /api/inventory/reports/*` - Reportes (11 tipos)
- - endpoints de baja, solicitudes, actas

#### **Notificaciones (3 endpoints)**

- `GET /api/notifications` - Listar
- `POST /api/notifications/[id]/read` - Marcar leído
- `GET /api/notifications/sse` - Server-Sent Events

#### **Usuarios (8 endpoints)**

- `GET /api/users` - Listar
- `POST /api/users` - Crear
- `GET /api/users/[id]` - Detalle
- `PATCH /api/users/[id]` - Actualizar
- `POST /api/users/[id]/disable` - Desactivar
- `GET /api/users/export` - Exportar
- `GET /api/families` - Listar familias
- `GET /api/departments` - Listar departamentos

#### **Configuración (5 endpoints)**

- `GET /api/config/system` - Config global
- `PATCH /api/config/system` - Actualizar global
- `GET /api/config/sla` - Políticas SLA
- `PATCH /api/config/sla` - Actualizar SLA
- `GET /api/config/session-timeout` - Timeout

#### **Auditoría (2 endpoints)**

- `GET /api/admin/logs` - Listar logs
- `GET /api/admin/logs/export` - Exportar logs

#### **Autenticación (3 endpoints)**

- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout
- `POST /api/auth/callback/oauth` - OAuth callback

### 8.7 Flujos de Negocio Críticos

#### **Flujo 1: Creación y Resolución de Ticket**

```
1. Usuario crea ticket
   └─ POST /api/tickets
      ├─ Validar entrada (Zod)
      ├─ Asignar SLA según prioridad
      ├─ Insertar en BD + log auditoría
      ├─ Enviar notificación técnico
      └─ Retornar ticket creado

2. Sistema asigna automáticamente
   └─ Job cada 5 min (cron)
      ├─ Buscar tickets SIN_ASIGNAR
      ├─ Algoritmo: categoría + carga + disponibilidad
      ├─ Actualizar assigned_to
      ├─ Crear notificación
      └─ Log auditoría

3. Técnico actualiza estado
   └─ PATCH /api/tickets/[id]
      ├─ Validar acceso (ticket_access.ts)
      ├─ Actualizar status
      ├─ Si RESOLVED:
      │  ├─ Recalcular SLA
      │  ├─ Ofertar crear articulo KB
      │  └─ Notificar cliente
      ├─ Log auditoría
      └─ Invalidar caché

4. Cliente verifica resolución
   └─ GET /api/tickets/[id]
      ├─ Validar pertenencia
      ├─ Retornar con estado actual
      └─ Ofrecer calificación
```

#### **Flujo 2: Asignación y Seguimiento de Equipos**

```
1. Admin registra equipo
   └─ POST /api/inventory/equipment
      ├─ Validar acceso a familia
      ├─ Generar código único (secuencial)
      ├─ Generar QR
      ├─ Insertar en BD
      ├─ Crear notificación de ingreso
      └─ Log auditoría

2. Admin asigna a usuario
   └─ POST /api/inventory/equipment/[id]/assign
      ├─ Validar acceso (inventory_resource_access.ts)
      ├─ Generar acta de entrega (PDF)
      ├─ Insertar movimiento (assignment history)
      ├─ Cambiar status → ASSIGNED
      ├─ Enviar PDF a usuario + email
      ├─ Log auditoría
      └─ Invalidar caché de inventario

3. Sistema monitorea alertas
   └─ Job cada 6 horas
      ├─ Buscar licencias a vencer (60/30 días)
      ├─ Buscar garantías a vencer
      ├─ Buscar consumibles bajo stock
      ├─ Buscar contratos próximos renovación
      ├─ Enviar notificación in-app + email
      └─ Log auditoría

4. Usuario devuelve equipo
   └─ POST /api/inventory/equipment/[id]/return
      ├─ Validar acceso
      ├─ Generar acta de devolución
      ├─ Cambiar status → AVAILABLE
      ├─ Actualizar historial
      ├─ Notificar admin
      └─ Log auditoría
```

#### **Flujo 3: Patrulla de Seguridad**

```
1. Admin programa ronda
   └─ POST /api/patrols/schedule
      ├─ Validar familia, ruta, agente
      ├─ Insertar recurring schedule
      ├─ Generar QR dinámico para cada punto
      ├─ Enviar notificación a agente
      └─ Log auditoría

2. Agente inicia patrulla (offline)
   └─ GET /api/patrols/[id]/start
      ├─ Descargar puntos de ruta
      ├─ Generar validación offline
      ├─ Mostrar QR dinámico por punto
      └─ Capturar eventos localmente

3. Agente valida punto
   └─ POST /api/patrols/[id]/checkpoint
      ├─ Validar QR (dinámico con timestamp)
      ├─ Validar geolocalización (±100m)
      ├─ Capturar foto
      ├─ Guardar localmente (offline)
      └─ Siguiente punto

4. Agente sincroniza (online)
   └─ POST /api/patrols/[id]/sync
      ├─ Enviar todos los checkpoints
      ├─ Validar integridad
      ├─ Insertar en BD
      ├─ Generar reporte
      ├─ Notificar supervisor
      └─ Log auditoría

5. Supervisor revisa reporte
   └─ GET /api/patrols/reports
      ├─ Filtrar por ronda, período, agente
      ├─ Mostrar % completitud
      ├─ Alertas de incidencias
      └─ Exportar PDF
```

---

## 9. CONCLUSIONES Y RECOMENDACIONES

### 9.1 Evaluación de Viabilidad

#### **Viabilidad Técnica: ✅ ALTA**

- Stack moderno y maduro (Next.js, PostgreSQL, Redis)
- Arquitectura escalable y containerizada
- Codebase bien estructurado (~4,000 líneas función)
- Tests automatizados 80%+ cobertura
- Documentación técnica completa

**Condiciones:**

- Requiere expertise en Node.js/React para mantenimiento
- Monitoreo activo de performance crítico

---

#### **Viabilidad Operativa: ✅ MEDIA-ALTA**

- Procesos bien definidos y documentados
- Capacitación factible en 3-5 días
- Dependencias mínimas de sistemas externos
- Rate limiting y auditoría implementados

**Condiciones:**

- Requiere 1 DevOps + 1 Backend Dev para operación
- Capacitación inicial de usuarios crítica
- Procedures de backup y recuperación documentadas

---

#### **Viabilidad Económica: ✅ ALTA**

- Stack 100% open source (sin costo licencias)
- Infraestructura estándar (cloud commodity)
- Costos operativos $50-300/mes según escala
- ROI positivo en 3-6 meses (reducción de tickets manuales)

**Condiciones:**

- Presupuesto para consultoría implementación (20-30k)
- Personal técnico interno o contratado

---

### 9.2 Recomendaciones para Implementación

#### **Fase 1: Pre-Implementación (Semanas 1-2)**

1. **Constitución del equipo:**
   - Steering committee (ejecutivos)
   - PMO (project manager)
   - Representantes de cada área
   - Equipo técnico (1 DevOps, 1-2 Dev)

2. **Alineación de procesos:**
   - Mapear procesos actuales vs futuros
   - Identificar quick wins (bajo esfuerzo, alto impacto)
   - Definir SLA políticas empresariales
   - Establecer roles y permisos finales

3. **Infraestructura:**
   - Seleccionar proveedor cloud (AWS, Azure, DigitalOcean)
   - Provisionar servidor (4 vCPU, 8 GB RAM, 100 GB SSD)
   - Configurar DNS y certificado SSL
   - Établir procedimientos de backup

4. **Plan de comunicación:**
   - Newsletter mensual de progreso
   - Kick-off meeting con todo el equipo
   - FAQs documentadas

---

#### **Fase 2: Configuración Inicial (Semanas 3-4)**

1. **Instalación y setup:**
   - Deploy del sistema en servidor
   - Configuración SMTP y notificaciones
   - Configuración OAuth (Google/Microsoft)
   - Políticas SLA y categorías

2. **Carga de datos maestros:**
   - Importar usuarios y estructura (familias/departamentos)
   - Cargar categorías de tickets
   - Cargar tipos de equipos/licencias/consumibles
   - Validación row-by-row de datos críticos

3. **Personalización:**
   - Página pública (logo, servicios, contacto)
   - Emails personalizados
   - Reportes específicos del negocio
   - Workflows específicos por área

---

#### **Fase 3: Capacitación y Validación (Semanas 5-6)**

1. **Capacitación por rol:**
   - Admin: configuración, usuarios, reportes
   - Técnico: gestión de tickets, inventario, patrullas
   - Cliente: creación de tickets, consulta
   - Auditor: revisión de logs

2. **Validación funcional:**
   - Pruebas de casos de uso críticos
   - Verificación de datos históricos
   - Test de carga (200-300 usuarios simultáneos)
   - Auditoría de seguridad

3. **Documentación final:**
   - Runbooks de operación diaria
   - Procedimientos de backup y recuperación
   - Guías de troubleshooting
   - Contacto de soporte escalado

---

#### **Fase 4: Go-live y Soporte (Semanas 7-8)**

1. **Cutover:**
   - Fecha de go-live confirmada
   - Rol-back plan en caso de emergencia
   - Soporte 24x5 primeros 7 días
   - Monitoreo intensivo

2. **Soporte post-go-live:**
   - Help desk disponible (8-10 horas día 1 semana)
   - Resolución de issues en <2 horas
   - Feedback diario del equipo
   - Ajustes menores aprobados rápidamente

3. **Estabilización (Semanas 9-12):**
   - Reducir soporte a 8x5
   - Análisis de datos y métricas
   - Identificar mejoras fase 2
   - Transición a soporte interno

---

### 9.3 Aspectos Críticos para Éxito

#### **1. Alineación Organizacional (CRÍTICO)**

- **Riesgo:** Áreas no alineadas o resistencia al cambio
- **Acción:** Steering committee semanal, comunicación clara de objetivos
- **KPI:** Adopción >80% en primeras 4 semanas

---

#### **2. Capacitación de Usuarios (CRÍTICO)**

- **Riesgo:** Usuarios no saben usar sistema, vuelven a procesos antiguos
- **Acción:** Capacitación 3-5 días + manuales + videos + help desk
- **KPI:** 90% usuarios completan capacitación, >80% competencia demostrada

---

#### **3. Calidad de Datos Migratorios (CRÍTICO)**

- **Riesgo:** Datos históricos inconsistentes → reportes erróneos
- **Acción:** Auditoría pre/post migración, validación row-by-row
- **KPI:** 100% datos críticos validados, <0.1% discrepancias

---

#### **4. Disponibilidad de Personal Técnico (ALTO)**

- **Riesgo:** Falta de expertise para operación/troubleshooting
- **Acción:** Capacitación técnica de segundo administrador, documentación completa
- **KPI:** 2+ admins capacitados, runbooks documentados

---

#### **5. Monitoreo y Alertas (ALTO)**

- **Riesgo:** Degradación silenciosa de performance
- **Acción:** Configurar alertas en CPU, RAM, queries lentas, tasa de errores
- **KPI:** Alertas respaldidas en <30 minutos, SLA >99.9%

---

#### **6. Seguridad y Cumplimiento (ALTO)**

- **Riesgo:** Brechas de seguridad, falta de auditoría
- **Acción:** Auditoría externa anual, rate limiting activo, logs encriptados
- **KPI:** 0 brechas reportadas, 100% auditoría accesible

---

### 9.4 Métricas de Éxito

#### **Operacionales**

| Métrica                           | Baseline    | Meta (6 meses) |
| --------------------------------- | ----------- | -------------- |
| Tiempo promedio resolución ticket | 48h         | 24h            |
| Cumplimiento SLA                  | 70%         | 95%            |
| Duplicidad de tickets             | 30%         | <5%            |
| Utilización de inventario         | Desconocida | 85%+           |
| Pérdida de equipamiento           | 5-10%/año   | <1%/año        |
| Costo por ticket                  | $50         | $20            |

#### **Técnicas**

| Métrica                    | Meta        |
| -------------------------- | ----------- |
| Disponibilidad del sistema | ≥99.9%      |
| Tiempo de carga página     | <2 segundos |
| Latencia API (p95)         | <500 ms     |
| Cache hit rate             | >80%        |
| Test coverage              | >80%        |
| Incident response time     | <2 horas    |

#### **De Adopción**

| Métrica                  | Meta            |
| ------------------------ | --------------- |
| Adopción en mes 1        | >80%            |
| Satisfacción de usuarios | >4.0/5.0        |
| Tickets creados por mes  | Crecimiento 20% |
| Artículos de KB creados  | 1 por semana    |

---

### 9.5 Roadmap Futuro (Fases 2+)

#### **Fase 2 (Meses 4-6)**

- [ ] Móvil app (React Native) para patrullas
- [ ] Integración con ERP/CRM (APIs)
- [ ] Machine learning para asignación automática
- [ ] Reportes predictivos (forecasting de tickets)
- [ ] Integración calendario (Outlook/Google)

#### **Fase 3 (Meses 7-12)**

- [ ] SLA automático con machine learning
- [ ] Integración Slack/Teams para notificaciones
- [ ] Portal cliente externo (sin credenciales)
- [ ] Análisis de sentimiento en comentarios
- [ ] Multi-idioma (i18n completo)

#### **Fase 4 (Año 2+)**

- [ ] Replicación de base de datos (HA/DR)
- [ ] Load balancer para múltiples instancias
- [ ] Integración con sistemas biométricos (acceso)
- [ ] IoT para monitoreo de equipos
- [ ] API marketplace para extensiones

---

### 9.6 Conclusión

El **Sistema de Gestión Integral** es una solución **viable, escalable y bien-arquitecturada** que resolve necesidades operativas reales de la organización. Con una implementación cuidadosa, alineación organizacional clara y capacitación adecuada, el proyecto puede lograr:

- ✅ Reducción de 50%+ en tiempo de resolución de tickets
- ✅ Visibilidad 360° en inventario y activos
- ✅ Auditoría completa para cumplimiento regulatorio
- ✅ Plataforma estable para extensión futura

**Recomendación:** Proceder con implementación siguiendo plan de 8 semanas, priorizando alineación organizacional y capacitación de usuarios como factores críticos de éxito.

---

## APÉNDICE A: Glosario Técnico

| Término     | Definición                                                        |
| ----------- | ----------------------------------------------------------------- |
| **SLA**     | Service Level Agreement - acuerdo de nivel de servicio            |
| **RBAC**    | Role-Based Access Control - control de acceso por roles           |
| **JWT**     | JSON Web Token - token de autenticación stateless                 |
| **TTL**     | Time To Live - tiempo de expiración de datos en caché             |
| **RTO**     | Recovery Time Objective - tiempo máximo permitido de downtime     |
| **RPO**     | Recovery Point Objective - pérdida máxima de datos permitida      |
| **p95**     | Percentil 95 - métrica de latencia                                |
| **Redis**   | In-memory data structure store, usado para caché                  |
| **Prisma**  | ORM (Object-Relational Mapping) para acceso a datos               |
| **Zod**     | TypeScript-first schema validation library                        |
| **Webhook** | HTTP callback - integración push de eventos                       |
| **SSE**     | Server-Sent Events - push de datos desde servidor a cliente       |
| **OAuth**   | Open Authorization - protocolo delegado para autenticación        |
| **IDOR**    | Insecure Direct Object Reference - vulnerabilidad de seguridad    |
| **CSRF**    | Cross-Site Request Forgery - ataque de falsificación de solicitud |

---

## APÉNDICE B: Contactos y Escalamiento

| Rol                       | Responsable | Email/Teléfono | Disponibilidad          |
| ------------------------- | ----------- | -------------- | ----------------------- |
| **PMO / Proyecto**        | -           | -              | L-V 8-18h               |
| **Arquitecto Técnico**    | -           | -              | L-V 8-18h               |
| **DBA / Infraestructura** | -           | -              | 24/7 (alertas)          |
| **Soporte Aplicación**    | -           | -              | L-V 8-18h (L-S post-go) |
| **Ejecutivos**            | -           | -              | Previa cita             |

---

## APÉNDICE C: Referencias y Documentación Relacionada

1. **Documentación Interna:**
   - `/docs/README.md` - Overview sistema
   - `/docs/SETUP.md` - Instalación y configuración
   - `/docs/DEPLOYMENT.md` - Guía de despliegue
   - `/docs/FEATURES.md` - Características por módulo
   - `/docs/DATABASE.md` - Schema y modelos
   - `/docs/MANUAL_TICKETS.md` - Manual de tickets
   - `/docs/MANUAL_INVENTARIO.md` - Manual de inventario
   - `/docs/MANUAL_RONDAS.md` - Manual de patrullas
   - `/docs/MANUAL_NOTICIAS.md` - Manual de noticias

2. **Estándares Externos:**
   - OWASP Top 10 - Seguridad de aplicaciones web
   - WCAG 2.1 - Accesibilidad web
   - ISO 27001 - Gestión de seguridad de información

---

**Documento Preparado:** Junio 2026  
**Versión:** 1.0  
**Estado:** Final  
**Aprobación Requerida:** CTO / Head of Operations

---
