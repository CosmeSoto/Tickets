# Manual del Módulo de Tickets

**Sistema de Tickets — Documentación Técnica y de Usuario**  
Versión actual · Abril 2026

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

### Tabla de permisos completa

| Acción | Cliente | Técnico | Admin | SuperAdmin |
|--------|:-------:|:-------:|:-----:|:----------:|
| Ver sus propios tickets | ✅ | — | — | — |
| Ver todos los tickets | — | ✅ (sus familias) | ✅ (sus familias) | ✅ (todos) |
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
| Configurar área | — | — | ✅ | ✅ |
| Ver reportes | — | — | ✅ | ✅ |
| Ver auditoría | — | — | — | ✅ |
| Exportar datos | — | ✅ (sus tickets) | ✅ | ✅ |

### Sobre el rol Técnico

El técnico solo puede:
- Ver tickets **asignados a él** o **sin asignar de sus familias**
- Cambiar estado a: `EN PROGRESO`, `RESUELTO`, `EN ESPERA` (no puede cerrar directamente)
- Auto-asignarse tickets (no puede asignar a otro técnico)
- No puede editar el título ni la descripción (preserva la solicitud original del cliente)

### Sobre el Admin normal vs SuperAdmin

El **Admin normal** ve y gestiona únicamente las familias que tiene asignadas en `admin_family_assignments`.  
El **SuperAdmin** tiene acceso sin restricciones a todas las familias y configuraciones del sistema.

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

#### Configuración de tickets por área

En **Familias → [Nombre del área] → Tab Tickets**:

| Campo | Descripción |
|-------|-------------|
| Tickets habilitados | Activa/desactiva la recepción de tickets en esta área |
| Prefijo de código | Prefijo para los códigos (ej: `TI` → `TI-2026-0001`) |
| Familia por defecto | Esta área recibe tickets sin familia asignada |
| Auto-asignación respeta familias | Solo auto-asigna técnicos de esta área |
| Umbral de alerta de volumen | Alerta cuando los tickets abiertos superen N |
| Horario laboral | Horas y días para cálculo de SLA |
| Acceso de otras familias | Qué clientes de otras áreas pueden crear tickets aquí |
| Días laborales | Checkboxes visuales (Lun–Dom) |

En **Configuración → Tickets** (vista global):
- Toggle habilitado/deshabilitado por cada familia
- Familia por defecto del sistema (fallback)
- Vista resumida de configuración SLA por prioridad

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

Las **familias** (también llamadas "áreas") son los equipos de soporte. Cada ticket puede pertenecer a una familia. Los clientes pueden crear tickets en:

- **Su propia área**: Pre-seleccionada automáticamente al crear un ticket
- **Otras áreas**: Si la configuración `allowedFromFamilies` de esa área lo permite

Si `allowedFromFamilies` está vacío, cualquier cliente del sistema puede crear tickets en esa área. Si tiene valores, solo los clientes de esas familias específicas pueden hacerlo.

### Filtros por familia

En todas las secciones (tickets, categorías, knowledge), el selector de área es un **Combobox con buscador** que escala a cualquier cantidad de familias. El nombre completo siempre es visible dentro del dropdown.

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

El horario laboral **se configura por familia/área**, no de forma global. Esto permite que cada equipo tenga su propio horario:

- **Ruta**: `Configuración → Tickets → [seleccionar familia] → sección Horario laboral`
- **Campos**: Hora inicio, Hora fin, Días laborales (ej: `MON,TUE,WED,THU,FRI`)

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

### Dónde se configura

| Configuración | Ubicación | Acceso |
|---------------|-----------|--------|
| Config por área (prefijo, horario, SLA, acceso) | Familias → [Área] → Tab Tickets | Admin |
| Toggle de tickets por área (vista global) | Configuración → Tickets | Admin |
| Familia por defecto | Configuración → Tickets | Admin |
| **Horario laboral por área** | **Configuración → Tickets → [familia] → Horario laboral** | Admin |
| Plazo de auto-cierre (días) | `system_settings.autoCloseDays` (BD) | SuperAdmin |
| **Políticas SLA globales (tiempos por prioridad)** | **Configuración del Sistema → tab SLA** | SuperAdmin |
| Notificaciones globales | Admin → Configuración → Notificaciones | Admin |
| Notificaciones personales | Configuración (usuario) → Notificaciones | Todos |
| Página pública (hero, servicios, logos, SEO) | Admin → Página Pública | Admin / SuperAdmin |

### Parámetros clave de `ticket_family_config`

```
ticketsEnabled           → Si el área acepta tickets (default: true)
codePrefix               → Prefijo del código (ej: "TI")
isDefault                → Esta es la familia fallback del sistema
autoAssignRespectsFamilies → Solo auto-asigna técnicos de esta familia
alertVolumeThreshold     → Alerta cuando tickets abiertos > N
businessHoursStart       → Hora inicio jornada (ej: "09:00")
businessHoursEnd         → Hora fin jornada (ej: "18:00")
businessDays             → Días laborales (ej: "MON,TUE,WED,THU,FRI")
allowedFromFamilies      → IDs de familias cuyos clientes pueden crear tickets aquí
                           (vacío = abierto a todos)
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
