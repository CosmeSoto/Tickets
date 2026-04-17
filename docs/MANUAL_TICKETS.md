# Manual del Módulo de Tickets

**Sistema de Tickets — Documentación Técnica y de Usuario**  
Versión actual · Abril 2026 · Última actualización: configuración de tickets rediseñada

---

## Índice

1. [¿Qué es el módulo de tickets?](#1-qué-es-el-módulo-de-tickets)
2. [Roles y permisos](#2-roles-y-permisos)
3. [Flujo de vida de un ticket](#3-flujo-de-vida-de-un-ticket)
4. [Guía por rol](#4-guía-por-rol)
   - [Cliente](#41-cliente)
   - [Técnico](#42-técnico)
   - [Administrador](#43-administrador)
5. [Comentarios internos vs públicos](#5-comentarios-internos-vs-públicos)
6. [Sistema de áreas (familias)](#6-sistema-de-áreas-familias)
7. [Categorías y jerarquía](#7-categorías-y-jerarquía)
8. [SLA y horario laboral](#8-sla-y-horario-laboral)
9. [Base de conocimientos](#9-base-de-conocimientos)
10. [Calificación y cierre automático](#10-calificación-y-cierre-automático)
11. [Exportación de datos](#11-exportación-de-datos)
12. [Configuración del módulo](#12-configuración-del-módulo)
    - [Navegación — dónde está cada cosa](#navegación--dónde-está-cada-cosa)
    - [Dónde se configura cada parámetro](#dónde-se-configura-cada-parámetro)
13. [Notificaciones y alertas](#13-notificaciones-y-alertas)
14. [Referencia de estados y transiciones](#14-referencia-de-estados-y-transiciones)

---

## 1. ¿Qué es el módulo de tickets?

El módulo de tickets es el núcleo del sistema de soporte. Permite a los usuarios reportar problemas o solicitudes, al equipo técnico gestionarlos, y a los administradores supervisar el desempeño del servicio.

**Conceptos clave:**

| Concepto | Descripción |
|----------|-------------|
| **Ticket** | Una solicitud de soporte creada por un cliente |
| **Área / Familia** | El equipo responsable de atender los tickets (ej: Mantenimiento, TI, Servicios Generales) |
| **Categoría** | Clasificación del tipo de problema (hasta 4 niveles jerárquicos) |
| **SLA** | Acuerdo de nivel de servicio — tiempo máximo para responder y resolver |
| **Código de ticket** | Identificador único legible (ej: `TI-2026-0001`) |

---

## 2. Roles y permisos

### Los cuatro roles del sistema

| Rol | Quién es | Qué ve |
|-----|----------|--------|
| **Cliente** | Usuario final que reporta problemas | Solo sus propios tickets |
| **Técnico** | Personal de soporte que resuelve tickets | Tickets de sus áreas asignadas |
| **Admin** | Responsable de un conjunto de áreas | Tickets y configuración de sus áreas asignadas |
| **Super Admin** | Administrador principal del sistema | Todo, sin restricciones |

> ℹ️ Técnicamente, Super Admin y Admin son el mismo rol (`ADMIN`) en la base de datos. La diferencia es el campo `isSuperAdmin = true/false`. Se asigna al crear o editar el usuario.

### Admin normal vs Super Admin — diferencias concretas

| Capacidad | Admin normal | Super Admin |
|-----------|:-----------:|:-----------:|
| Ver tickets de sus áreas asignadas | ✅ | ✅ (todas) |
| Ver tickets de áreas NO asignadas | ❌ | ✅ |
| Configurar tickets por área | ✅ (sus áreas) | ✅ (todas) |
| Ver reportes | ✅ (sus áreas) | ✅ (todas) |
| Gestionar usuarios | ✅ | ✅ |
| Crear otro Super Admin | ❌ | ✅ |
| Ver auditoría del sistema | ❌ | ✅ |
| Configurar email / SMTP | ❌ | ✅ |
| Configurar seguridad (sesión, contraseñas) | ❌ | ✅ |
| Configurar OAuth (Google, etc.) | ❌ | ✅ |
| Editar políticas SLA globales | ❌ | ✅ |
| Cambiar nombre del sistema | ❌ | ✅ |
| Editar logos e identidad de la empresa | ❌ | ✅ |
| Editar SEO de la página pública | ❌ | ✅ |

**¿Qué pasa si un Admin no tiene áreas asignadas?**  
Por compatibilidad, un admin sin ninguna asignación tiene acceso total (igual que Super Admin). Esto es para que un admin recién creado pueda trabajar. En cuanto se le asigna al menos un área, queda restringido a esas áreas.

### Tabla de permisos completa

| Acción | Cliente | Técnico | Admin | SuperAdmin |
|--------|:-------:|:-------:|:-----:|:----------:|
| Ver sus propios tickets | ✅ | — | — | — |
| Ver todos los tickets | — | ✅ (sus áreas) | ✅ (sus áreas) | ✅ (todos) |
| Crear ticket | ✅ | — | ✅ | ✅ |
| Editar título/descripción | ✅ (solo OPEN) | — | ✅ | ✅ |
| Cambiar estado | — | ✅ (limitado) | ✅ | ✅ |
| Cambiar prioridad | — | ✅ | ✅ | ✅ |
| Asignar técnico | — | Solo sí mismo | ✅ | ✅ |
| Eliminar ticket | ✅ (OPEN sin técnico) | — | ✅ | ✅ |
| Comentar (público) | ✅ | ✅ | ✅ | ✅ |
| Comentar (interno) | — | ✅ | ✅ | ✅ |
| Ver comentarios internos | — | ✅ | ✅ | ✅ |
| Calificar servicio | ✅ | — | — | — |
| Crear artículo de conocimiento | — | ✅ | ✅ | ✅ |
| Configurar área | — | — | ✅ (sus áreas) | ✅ |
| Ver reportes | — | — | ✅ (sus áreas) | ✅ |
| Ver auditoría | — | — | — | ✅ |
| Exportar datos | — | ✅ (sus tickets) | ✅ | ✅ |

---

## 3. Flujo de vida de un ticket

```
CLIENTE crea ticket
        ↓
   [ABIERTO]
        ↓
   Técnico se asigna
        ↓
  [EN PROGRESO] ←→ [EN ESPERA]
        ↓
   Técnico resuelve
        ↓
   [RESUELTO]
        ↓
   Cliente califica      ← Plazo: 3 días (configurable)
        ↓                ↓ (si no califica, se cierra automáticamente)
   [CERRADO]
```

**Estados:**

| Estado | Código | Descripción |
|--------|--------|-------------|
| Abierto | `OPEN` | Ticket creado, esperando técnico |
| En Progreso | `IN_PROGRESS` | Técnico está trabajando en él |
| En Espera | `ON_HOLD` | Pausado (esperando información del cliente u otro sistema) |
| Resuelto | `RESOLVED` | Técnico marcó como resuelto, esperando calificación del cliente |
| Cerrado | `CLOSED` | Cliente calificó o se cerró automáticamente tras el plazo |

**Transiciones permitidas por técnico:**

```
OPEN → IN_PROGRESS
IN_PROGRESS → RESOLVED
IN_PROGRESS → ON_HOLD
ON_HOLD → IN_PROGRESS
RESOLVED → IN_PROGRESS  (reabrir si es necesario)
```

> ⚠️ El técnico NO puede hacer la transición a `CLOSED` directamente. El cierre ocurre cuando el cliente califica o por el cron de auto-cierre.

---

## 4. Guía por rol

### 4.1 Cliente

#### Crear un ticket

1. Ir a **Mis Tickets → Nuevo Ticket**
2. Completar:
   - **Título** (mínimo 5 caracteres): Describe el problema brevemente
   - **Descripción** (mínimo 10 caracteres): Detalla el problema con pasos, errores, etc.
   - **Ubicación** (opcional): Dónde debe acercarse el técnico
   - **Prioridad**: Baja / Media / Alta / Urgente
   - **Área de soporte** (opcional): Seleccionar el equipo responsable — el sistema pre-selecciona "Mi área" automáticamente
   - **Categoría** (requerida): Navega por la jerarquía de categorías o usa la búsqueda
3. Adjuntar archivos si aplica (máximo 5, 10MB c/u)
4. Clic en **Crear Ticket**

#### Ver el estado de mis tickets

- En **Mis Tickets** se muestran todos tus tickets con filtros por estado, prioridad, área y fecha
- El botón **Exportar** descarga los tickets filtrados en CSV, Excel o PDF

#### Calificar un ticket resuelto

Cuando un técnico marca tu ticket como **Resuelto**:
1. Aparece un banner destacado en el ticket: "Tu ticket ha sido resuelto"
2. Ir al tab **Calificación**
3. Evaluar de 1 a 5 estrellas las siguientes dimensiones:
   - Tiempo de respuesta
   - Habilidad técnica
   - Comunicación
   - Resolución del problema
4. Opcionalmente agregar un comentario
5. Al enviar la calificación, el ticket pasa automáticamente a **Cerrado**

> ℹ️ Si no calificas dentro de 3 días, el ticket se cierra automáticamente con una notificación.

---

### 4.2 Técnico

#### Vista de mis tickets

En **Mis Tickets Asignados** ves solo los tickets que te han asignado, con filtros por estado, prioridad, área, categoría y fecha. El botón **Exportar** descarga los datos visibles.

#### Trabajar en un ticket

1. Hacer clic en el ticket para ver su detalle
2. En el tab **Estado**: Seleccionar el nuevo estado y clic en **Actualizar Estado**
3. En el tab **Historial**: Agregar comentarios (públicos o internos)
4. En el tab **Plan de Resolución**: Crear tareas con horarios estimados
5. En el tab **Archivos**: Subir evidencias o documentación

#### Comentarios internos

Los comentarios marcados como **Solo equipo** son visibles únicamente para técnicos y administradores. El cliente **no los verá** ni en la UI ni en la API.

Para crear uno: en el campo de comentario, activar el toggle **Solo equipo** (ícono 🔒) antes de enviar.

#### Crear artículo de conocimiento

Cuando un ticket llega a estado `RESUELTO` o `CERRADO`:
1. Aparece el botón **Crear Artículo**
2. El sistema pre-genera un borrador con: descripción del problema, plan de resolución, solución aplicada (comentarios públicos del técnico), y métricas del ticket
3. Revisar el contenido generado y ajustar si es necesario
4. El artículo se publica y queda disponible en la Base de Conocimientos de tu área

> ⚠️ Solo se incluyen comentarios **públicos** del técnico en el artículo generado. Los comentarios internos no se incluyen para preservar la confidencialidad.

---

### 4.3 Administrador

#### Gestión de tickets

En **Gestión de Tickets** el admin tiene acceso completo:
- Ver todos los tickets de sus familias asignadas
- Crear tickets manualmente especificando el cliente
- Editar cualquier campo (título, descripción, estado, prioridad, categoría, técnico)
- Asignar tickets a cualquier técnico de sus familias
- Eliminar tickets
- Filtrar por área, categoría, estado, prioridad, técnico asignado, fecha

El **Exportar** descarga los tickets filtrados actualmente en pantalla.

#### Configuración de tickets

La configuración está en **Tickets → Configuración** en el menú lateral. Tiene dos secciones:

**Tab "Por área"** — configuración individual por cada área de soporte:

| Campo | Descripción |
|-------|-------------|
| Switch en la lista | Activa/desactiva la recepción de tickets en esa área |
| Prefijo de código | Prefijo para los códigos (ej: `TI` → `TI-2026-0001`) |
| Alerta de volumen | Notifica cuando los tickets abiertos superen N |
| Tickets habilitados | Toggle para habilitar/deshabilitar el área |
| Asignación respeta el área | Solo auto-asigna técnicos de esa área |
| Área por defecto del sistema | Esta área recibe tickets sin área asignada |
| Horario laboral | Entrada, salida y días laborales (botones L M X J V S D) |
| Tiempos SLA de referencia | Tarjetas visuales por prioridad (solo lectura aquí) |

**Tab "Reglas generales"** — configuración que aplica a todo el sistema:

| Campo | Descripción |
|-------|-------------|
| Área por defecto | Área fallback cuando no se puede determinar el área del ticket |
| Límite de tickets por usuario | Máximo de tickets abiertos simultáneos por usuario |
| Cierre automático | Días tras resolución sin calificación antes del cierre automático |
| Asignación automática | Activa/desactiva la asignación automática al técnico con menor carga |

> 💡 Hay **un solo botón "Guardar cambios"** en el header que guarda todo lo que hayas modificado en ambos tabs.

---

## 5. Comentarios internos vs públicos

### Diferencias

| Aspecto | Público | Interno (Solo equipo) |
|---------|---------|----------------------|
| Visible para cliente | ✅ | ❌ |
| Visible para técnico | ✅ | ✅ |
| Visible para admin | ✅ | ✅ |
| Aparece en JSON de la API para clientes | ❌ (filtrado en backend) | ❌ |
| Incluido en artículos de conocimiento | ✅ | ❌ |
| Dispara notificación email al cliente | ✅ | ❌ |
| Color en el historial | Gris neutro | Ámbar / naranja |
| Ícono | 💬 | 🔒 |

### Seguridad

Los comentarios internos se filtran en el **backend** (no solo en la UI). Cuando el cliente accede a `GET /api/tickets/[id]`, la consulta incluye `WHERE isInternal = false`. Esto significa que incluso si un cliente inspecciona el tráfico de red, no verá los comentarios internos.

### ¿Quién puede crear comentarios internos?

- **Técnico**: Sí, usando el toggle "Solo equipo" en el formulario
- **Admin**: Sí, mismo toggle
- **Cliente**: No (la API fuerza `isInternal = false` aunque lo intente)
- **Colaborador de ticket**: No puede crear internos aunque pueda ver los existentes

---

## 6. Sistema de áreas (familias)

Las **familias** (también llamadas "áreas") son los equipos de soporte. Cada ticket pertenece a un área. Los clientes pueden crear tickets en:

- **Su propia área**: Pre-seleccionada automáticamente al crear un ticket
- **Otras áreas**: Si la configuración `allowedFromFamilies` de esa área lo permite

Si `allowedFromFamilies` está vacío, cualquier cliente del sistema puede crear tickets en esa área. Si tiene valores, solo los clientes de esas familias específicas pueden hacerlo.

### ¿Qué hace el switch de habilitar/deshabilitar en la lista de áreas?

El switch controla si esa área **puede recibir tickets nuevos**. Si está desactivado:
- Los clientes **no pueden crear** tickets en esa área
- Los tickets existentes **no se borran** ni se afectan
- Es útil para áreas sin personal disponible temporalmente

### ¿Qué es el "Área por defecto del sistema"?

Es el **área de último recurso** (fallback). Cuando el sistema no puede determinar a qué área pertenece un ticket — por ejemplo, si la categoría seleccionada no tiene área asignada — el ticket se envía automáticamente a esta área.

**Aclaraciones importantes:**
- Solo **una** área puede ser la por defecto a la vez
- No significa que reciba todos los tickets de otras áreas — solo los que quedan "sin área determinada"
- Si no hay área por defecto configurada, los tickets sin área quedan sin asignar (pueden perderse)
- Si dejas el selector en blanco en "Reglas generales", los tickets sin área no se asignan a ningún lado

### Filtros por familia

En todas las secciones (tickets, categorías, knowledge), el selector de área es un **Combobox con buscador** que escala a cualquier cantidad de familias. El nombre completo siempre es visible dentro del dropdown.

### Página Pública

El botón 🌐 **Página Pública** aparece en el header para **todos los roles** (Admin, Técnico, Cliente). En pantallas grandes muestra el texto "Página Pública"; en móvil solo el ícono. Abre la página de inicio pública en una nueva pestaña.

Los administradores pueden editar el contenido de esa página desde **Página Pública** en el menú lateral.

---

## 7. Categorías y jerarquía

Las categorías tienen hasta **4 niveles jerárquicos**:

```
Nivel 1 — Principal      (ej: "Hardware")
  Nivel 2 — Subcategoría (ej: "Computadoras")
    Nivel 3 — Especialidad (ej: "Laptops")
      Nivel 4 — Detalle    (ej: "Pantalla dañada")
```

Al seleccionar una familia en el formulario de creación de ticket, el selector de categorías muestra **solo las categorías de esa familia** (filtrado automático).

En la vista de Gestión de Categorías, el administrador puede:
- Ver categorías filtradas por área (combobox) y nivel
- Alternar entre vista tabla y vista árbol jerárquico
- Crear, editar y eliminar categorías (respetando permisos de familia)
- Exportar el listado filtrado en CSV, Excel o PDF

---

## 8. SLA y horario laboral

El SLA (Service Level Agreement) define los tiempos máximos para responder y resolver un ticket.

### Niveles de precedencia

1. **Política específica de categoría**: La más específica, aplica a esa categoría exacta
2. **Política de familia**: Para todas las categorías de esa área
3. **Política global**: Fallback para tickets sin categoría o sin política específica

### Tiempos por defecto

| Prioridad | Respuesta | Resolución |
|-----------|-----------|------------|
| Urgente | 1h | 4h |
| Alta | 2h | 8h |
| Media | 4h | 24h |
| Baja | 8h | 48h |

> Los tiempos globales se editan en **Configuración del Sistema → tab SLA** (solo SuperAdmin).

### Dónde se configura el horario laboral

El horario laboral **se configura por área**, no de forma global. Esto permite que cada equipo tenga su propio horario:

- **Ruta**: `Tickets → Configuración → tab "Por área" → [seleccionar área] → sección Horario laboral`
- **Campos**:
  - **Entrada / Salida**: selectores de hora (ej: 09:00 – 18:00)
  - **Días laborales**: botones circulares **L M X J V S D** — los activos se muestran en color primario, los inactivos en gris. Se activan/desactivan con un clic.

Cada política SLA tiene además un toggle **"Solo horas hábiles"** que activa o desactiva el cálculo basado en ese horario.

### Cómo funciona el cálculo de horas hábiles

Cuando una política SLA tiene **"Solo horas hábiles"** activo, el sistema descuenta las horas fuera del horario configurado.

**Ejemplo práctico** — Horario: 09:00–18:00, Lun–Vie, política de resolución: 4 horas:

| Ticket llega | Deadline de resolución |
|---|---|
| Viernes 17:00 | Lunes 12:00 (1h el viernes + 3h el lunes) |
| Viernes 18:00 | Lunes 13:00 (0h el viernes + 4h el lunes) |
| Lunes 10:00 | Lunes 14:00 (4h corridas dentro del horario) |
| Lunes 16:00 | Martes 11:00 (2h el lunes + 2h el martes) |

El algoritmo avanza hora a hora, saltando días no laborales y horas fuera del rango configurado.

> ⚠️ Si la política tiene **"Solo horas hábiles" desactivado**, el cálculo es calendario corrido (24/7), sin importar el horario de la familia.

### Violaciones de SLA

Si un ticket supera el tiempo de respuesta o resolución configurado:
1. Se registra una violación en `sla_violations` con severidad (LOW/MEDIUM/HIGH/CRITICAL)
2. El cron de SLA envía alertas al técnico asignado
3. Las violaciones aparecen en el reporte de **Cumplimiento SLA**

---

## 9. Base de conocimientos

La base de conocimientos almacena soluciones documentadas basadas en tickets resueltos.

### Visibilidad por rol

| Rol | Artículos visibles |
|-----|-------------------|
| Cliente | Solo de las familias de sus tickets históricos |
| Técnico | Solo de sus familias asignadas |
| Admin | Solo de sus familias asignadas |
| SuperAdmin | Todos |

### Filtros

El selector de área en la base de conocimientos filtra los artículos AND las categorías disponibles en el dropdown. Cambiar de área resetea el filtro de categoría automáticamente.

---

## 10. Calificación y cierre automático

### Flujo de calificación

```
Técnico → RESUELTO
    ↓ Sistema envía notificación al cliente
    ↓ Sistema envía email al cliente
Cliente → Tab Calificación → Envía rating 1-5
    ↓ Sistema cierra ticket automáticamente
    ↓ Sistema notifica al técnico
    ↓ Sistema registra en SLA (resolutionSLAMet)
```

### Auto-cierre por inactividad

El cron `auto-close-tickets` se ejecuta diariamente y cierra automáticamente los tickets en estado `RESUELTO` que llevan más de N días sin calificación.

**N (plazo)**: Configurado en `system_settings.autoCloseDays` (default: **3 días**).

Cuando se cierra automáticamente:
- El cliente recibe una notificación: "Tu ticket fue cerrado automáticamente. Aún puedes calificarlo desde el detalle."
- El técnico recibe notificación para promover el ticket a artículo de conocimiento

---

## 11. Exportación de datos

### Desde listas de tickets

En las secciones **Mis Tickets** (cliente), **Mis Tickets Asignados** (técnico) y **Gestión de Tickets** (admin), el botón **Exportar** (junto al título de la tabla) descarga los tickets **con los filtros activos en pantalla**:

| Formato | Contenido |
|---------|-----------|
| **CSV** | Texto plano separado por comas, compatible con Excel/Google Sheets. Incluye BOM UTF-8. |
| **Excel** | Archivo `.xlsx` con anchos de columna automáticos. |
| **PDF** | Ventana de impresión del navegador, genera PDF profesional en A4 horizontal. |

**Columnas exportadas**: Código, Título, Estado, Prioridad, Cliente, Técnico, Categoría, Área, Fecha creación, Fecha actualización.

### Desde reportes (Admin)

Los reportes tienen sus propios botones **CSV** y **PDF** para cada tab:
- Resumen Ejecutivo: KPIs por familia
- Rendimiento de Técnicos: tickets/resoluciones/tiempos por técnico
- Tendencias Temporales: evolución de volumen de tickets
- Cumplimiento SLA: porcentajes por familia y prioridad
- Satisfacción: distribución de calificaciones

Cada exportación queda registrada en auditoría automáticamente.

---

## 12. Configuración del módulo

### Navegación — dónde está cada cosa

El menú lateral del administrador está organizado así:

```
Dashboard
Tickets
  ├── Todos los Tickets
  ├── Reportes
  ├── Categorías
  ├── Base de Conocimientos
  └── Configuración          ← configuración por área y reglas generales
Inventario
  └── ...
Familias
Usuarios
Auditoría                    ← solo SuperAdmin
Página Pública               ← hero, servicios, logos, SEO
Configuración del Sistema    ← email, seguridad, OAuth, SLA global
```

> 💡 El botón **Página Pública** también aparece en el header (ícono 🌐) para todos los roles, abriendo la página en una nueva pestaña.

### Dónde se configura cada parámetro

| Configuración | Ubicación en el menú | Acceso |
|---|---|---|
| Habilitar/deshabilitar área para tickets | Tickets → Configuración → tab "Por área" | Admin |
| Prefijo de código, horario laboral, alertas | Tickets → Configuración → tab "Por área" → [seleccionar área] | Admin |
| **Días laborales** | Tickets → Configuración → tab "Por área" → Horario laboral → botones **L M X J V S D** | Admin |
| Área por defecto del sistema | Tickets → Configuración → tab "Reglas generales" | Admin |
| Límite de tickets por usuario | Tickets → Configuración → tab "Reglas generales" | Admin |
| **Plazo de cierre automático (días)** | Tickets → Configuración → tab "Reglas generales" | Admin |
| Asignación automática global | Tickets → Configuración → tab "Reglas generales" | Admin |
| **Políticas SLA globales (tiempos por prioridad)** | Configuración del Sistema → tab **SLA** | SuperAdmin |
| Notificaciones globales | Configuración del Sistema → tab Notificaciones | Admin |
| Email / SMTP | Configuración del Sistema → tab Email | SuperAdmin |
| Seguridad (sesión, contraseñas) | Configuración del Sistema → tab Seguridad | SuperAdmin |
| OAuth (Google, etc.) | Configuración del Sistema → tab OAuth | SuperAdmin |
| Página pública (hero, servicios, logos, SEO) | Página Pública (menú lateral) | Admin / SuperAdmin |
| Notificaciones personales | Configuración personal → Notificaciones | Todos |

### Parámetros clave de `ticket_family_config`

```
ticketsEnabled             → Si el área acepta tickets (default: true)
codePrefix                 → Prefijo del código (ej: "TI")
isDefault                  → Esta es el área fallback del sistema
autoAssignRespectsFamilies → Solo auto-asigna técnicos de esta área
alertVolumeThreshold       → Alerta cuando tickets abiertos > N
businessHoursStart         → Hora inicio jornada (ej: "09:00:00")
businessHoursEnd           → Hora fin jornada (ej: "18:00:00")
businessDays               → Días laborales en formato interno (ej: "MON,TUE,WED,THU,FRI")
                             — se edita visualmente con los botones L M X J V S D
allowedFromFamilies        → IDs de áreas cuyos clientes pueden crear tickets aquí
                             (vacío = abierto a todos)
```

### Parámetros clave de `system_settings` (reglas generales)

```
maxTicketsPerUser      → Máximo de tickets abiertos simultáneos por usuario (default: 10)
autoAssignmentEnabled  → Asignación automática al técnico con menor carga (default: true)
autoCloseDays          → Días tras resolución sin calificación antes del cierre (default: 3)
```

---

## 13. Notificaciones y alertas

### Tipos de notificaciones de tickets

| Evento | Cliente | Técnico | Admin |
|--------|---------|---------|-------|
| Ticket creado | ✅ | — | ✅ (in-app) |
| Ticket asignado | — | ✅ (email + in-app) | — |
| Comentario público agregado | ✅ (email + in-app) | ✅ (in-app) | — |
| Estado cambiado | ✅ (in-app) | — | — |
| Ticket resuelto | ✅ (email + in-app) | — | ✅ (email) |
| Ticket cerrado por cliente | — | ✅ (in-app) | — |
| SLA próximo a vencer | — | ✅ | ✅ |
| Violación de SLA | — | ✅ | ✅ |

### Configuración de sonido

Las notificaciones en tiempo real (SSE) pueden reproducir un tono de alerta al llegar:
- **Activar/desactivar**: Configuración → Notificaciones → "Sonido de notificaciones"
- El sonido requiere **una interacción previa del usuario** (política del navegador). Si llegas a la página y hay notificaciones pendientes, el tono suena al primer clic.
- El tono es corto y discreto (880Hz → 660Hz, 0.4s).

### Configuración de email

- El envío de emails se activa en: Admin → Configuración del Sistema → Email (solo SuperAdmin)
- Cada usuario puede activar/desactivar sus notificaciones por email en: Configuración → Notificaciones
- Los emails internos (comentarios `isInternal`) **nunca** se envían al cliente.

---

## 14. Referencia de estados y transiciones

### Estados completos

```
OPEN        → El ticket acaba de ser creado o fue reabierto
IN_PROGRESS → Un técnico está trabajando activamente
ON_HOLD     → En pausa (esperando algo externo)
RESOLVED    → Técnico marcó como resuelto, esperando calificación
CLOSED      → Ticket finalizado (calificado o auto-cerrado)
```

### Quién puede hacer cada transición

| Transición | Cliente | Técnico | Admin |
|------------|:-------:|:-------:|:-----:|
| OPEN → IN_PROGRESS | — | ✅ | ✅ |
| IN_PROGRESS → ON_HOLD | — | ✅ | ✅ |
| ON_HOLD → IN_PROGRESS | — | ✅ | ✅ |
| IN_PROGRESS → RESOLVED | — | ✅ | ✅ |
| RESOLVED → IN_PROGRESS | — | ✅ | ✅ |
| RESOLVED → CLOSED | Solo vía calificación | — | ✅ |
| Cualquier → CLOSED | — | — | ✅ (directo) |

### Códigos de error comunes

| Error | Causa | Solución |
|-------|-------|---------|
| "Solo puedes editar tickets OPEN" | El cliente intenta editar un ticket en progreso | Usar comentarios para agregar información |
| "Los técnicos no pueden cerrar tickets directamente" | Técnico intenta CLOSED | Dejar que el cliente califique o pedir al admin |
| "No tienes acceso a este ticket" | Cliente intenta ver ticket de otro cliente | Verificar que el ID sea correcto |
| "Solo puedes eliminar tickets OPEN sin técnico asignado" | Condición de eliminación no cumplida | El ticket ya fue asignado; pedir al admin que lo elimine |

---

*Para actualizar, editar `docs/MANUAL_TICKETS.md`.*
