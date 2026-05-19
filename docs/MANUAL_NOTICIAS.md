# Manual del Módulo de Noticias y Comunicados

**Sistema de Tickets — Documentación técnica**  
Versión · Mayo 2026

---

## Índice

1. [Alcance del módulo](#1-alcance-del-módulo)
2. [Roles y permisos](#2-roles-y-permisos)
3. [Tipos de contenido](#3-tipos-de-contenido)
4. [Entidades principales](#4-entidades-principales)
5. [Visibilidad y filtrado](#5-visibilidad-y-filtrado)
6. [Integración con dashboards](#6-integración-con-dashboards)
7. [Backups](#7-backups)
8. [API Reference](#8-api-reference)

---

## 1. Alcance del módulo

Gestión global de **noticias y comunicados internos** visible en los dashboards principales según roles y permisos.

- **Publicación**: Noticias, anuncios, cumpleaños, festividades, alertas, reconocimientos
- **Visibilidad**: Por roles, departamentos, sucursales o usuarios concretos
- **Interacción**: Reacciones, comentarios, visualizaciones
- **Control**: Vigencia (fechas inicio/fin), prioridades, destacados
- **Auditoría**: Registro de creaciones, ediciones, eliminaciones y visualizaciones

UI principal: `/admin/news` y APIs bajo `/api/admin/news/*` y `/api/news/*`.

---

## 2. Roles y permisos

| Rol              | Lectura (Feed)                    | Gestión (Admin)     |
| ---------------- | --------------------------------- | ------------------- |
| **Super Admin**  | Todo                              | Todo                |
| **Admin normal** | Según `newsEnabled` y visibilidad | Según `newsEnabled` |
| **Técnico**      | Según `newsEnabled` y visibilidad | No                  |
| **Cliente**      | Según `newsEnabled` y visibilidad | No                  |

### Habilitación del módulo

El módulo se activa/desactiva **por usuario** desde la gestión de usuarios (`/admin/users`), al igual que `inventoryEnabled` y `patrolsEnabled`:

- Campo en BD: `users.news_enabled` (Boolean, default: false)
- Super Admin siempre tiene acceso completo
- Usuarios con `newsEnabled: true` pueden ver el feed y (si son ADMIN) gestionar noticias

---

## 3. Tipos de contenido

El módulo soporta 8 tipos de publicaciones:

| Tipo               | Enum           | Descripción                      |
| ------------------ | -------------- | -------------------------------- |
| Noticia            | `NEWS`         | Noticias generales del sistema   |
| Comunicado         | `ANNOUNCEMENT` | Comunicados oficiales            |
| Evento             | `EVENT`        | Eventos corporativos             |
| Cumpleaños         | `BIRTHDAY`     | Cumpleaños de empleados          |
| Festividad         | `HOLIDAY`      | Festividades y días especiales   |
| Alerta             | `ALERT`        | Alertas importantes y urgentes   |
| Publicidad Interna | `INTERNAL_AD`  | Publicidad y beneficios internos |
| Reconocimiento     | `RECOGNITION`  | Reconocimientos a empleados      |

### Prioridades

| Prioridad | Enum     | Color   |
| --------- | -------- | ------- |
| Baja      | `LOW`    | Gris    |
| Media     | `MEDIUM` | Azul    |
| Alta      | `HIGH`   | Naranja |
| Urgente   | `URGENT` | Rojo    |

### Estados

| Estado    | Enum        | Descripción                             |
| --------- | ----------- | --------------------------------------- |
| Borrador  | `DRAFT`     | No visible para usuarios                |
| Publicado | `PUBLISHED` | Visible según permisos de visibilidad   |
| Archivado | `ARCHIVED`  | No visible, disponible solo para admins |

---

## 4. Entidades principales

### Tabla `news`

Entidad principal de noticias y comunicados.

| Campo            | Tipo        | Descripción                               |
| ---------------- | ----------- | ----------------------------------------- |
| `id`             | UUID        | Identificador único                       |
| `title`          | String(200) | Título de la noticia                      |
| `slug`           | String(200) | Slug único para URL                       |
| `content`        | Text        | Contenido principal (HTML/Markdown)       |
| `summary`        | String(500) | Resumen corto (opcional)                  |
| `imageUrl`       | String      | URL de imagen destacada (opcional)        |
| `type`           | Enum        | Tipo de noticia (NewsType)                |
| `priority`       | Enum        | Prioridad (NewsPriority)                  |
| `status`         | Enum        | Estado (NewsStatus)                       |
| `startDate`      | DateTime    | Fecha de inicio de visibilidad (opcional) |
| `endDate`        | DateTime    | Fecha de fin de visibilidad (opcional)    |
| `isFeatured`     | Boolean     | ¿Es noticia destacada?                    |
| `allowComments`  | Boolean     | ¿Permitir comentarios?                    |
| `allowReactions` | Boolean     | ¿Permitir reacciones?                     |
| `views`          | Int         | Contador de visualizaciones               |
| `createdById`    | UUID        | ID del usuario creador                    |
| `updatedById`    | UUID        | ID del último editor (opcional)           |
| `createdAt`      | DateTime    | Fecha de creación                         |
| `updatedAt`      | DateTime    | Fecha de última actualización             |

### Tablas de visibilidad

| Tabla              | Relación    | Descripción                          |
| ------------------ | ----------- | ------------------------------------ |
| `news_roles`       | news ↔ role | Visibilidad por roles de usuario     |
| `news_users`       | news ↔ user | Visibilidad por usuarios específicos |
| `news_departments` | news ↔ dept | Visibilidad por departamentos        |

**Regla de visibilidad**: Una noticia es visible para un usuario si:

1. No tiene ninguna restricción (ninguna de las tablas anteriores tiene registros)
2. O el usuario tiene el rol especificado en `news_roles`
3. O el usuario está en `news_users`
4. O el departamento del usuario está en `news_departments`

### Tablas de interacción

| Tabla              | Descripción                           |
| ------------------ | ------------------------------------- |
| `news_views`       | Registro de quién vio cada noticia    |
| `news_reactions`   | Reacciones de usuarios (👍❤️🎉😮😢👏) |
| `news_comments`    | Comentarios y respuestas              |
| `news_attachments` | Archivos adjuntos (PDFs, documentos)  |

---

## 5. Visibilidad y filtrado

### Filtros en el feed de usuario

El feed de noticias (`/api/news`) aplica automáticamente:

1. **Estado**: Solo `PUBLISHED`
2. **Vigencia**: `startDate ≤ now ≤ endDate` (si están definidas)
3. **Visibilidad**: Según roles, usuarios y departamentos
4. **Ordenamiento**:
   - Primero: `isFeatured: true` (destacadas)
   - Luego: por `priority` descendente
   - Finalmente: por `createdAt` descendente

### Filtros en administración

En `/admin/news` se puede filtrar por:

- **Estado**: Borrador, Publicado, Archivado
- **Tipo**: Cualquiera de los 8 tipos
- **Búsqueda**: Por título, contenido o resumen

---

## 6. Integración con dashboards

El componente `<NewsFeed />` se integra **al principio** de los dashboards principales:

| Dashboard              | Ruta              | Ubicación del NewsFeed |
| ---------------------- | ----------------- | ---------------------- |
| Admin Dashboard        | `/admin`          | Después del header     |
| Family Admin Dashboard | `/admin` (family) | Después del header     |
| Client Dashboard       | `/client`         | Después del header     |

No hay secciones adicionales ni enlaces extra - las noticias se muestran directamente en el dashboard principal.

---

## 7. Backups

El módulo está completamente integrado en el sistema de backups:

### Módulo de backup: `news`

Incluye todas las tablas relacionadas:

```typescript
NEWS_MODULE_RESTORE_ORDER = [
  'news',
  'news_roles',
  'news_users',
  'news_departments',
  'news_views',
  'news_reactions',
  'news_comments',
  'news_attachments',
]
```

### Exportación

Función `exportNewsModuleData()` exporta todas las noticias y sus relaciones.

---

## 8. API Reference

### Admin API (`/api/admin/news`)

#### `GET /api/admin/news`

Obtener listado de noticias para administración.

**Query Params**:

- `status`: Filtrar por estado (`DRAFT|PUBLISHED|ARCHIVED`)
- `type`: Filtrar por tipo
- `search`: Búsqueda por título, contenido o resumen

**Respuesta**:

```json
{
  "news": [
    {
      "id": "uuid",
      "title": "Título",
      "type": "NEWS",
      "status": "PUBLISHED",
      "createdBy": { "id": "uuid", "name": "Usuario" },
      "_count": {
        "news_views": 10,
        "news_reactions": 5,
        "news_comments": 3
      }
    }
  ]
}
```

#### `POST /api/admin/news`

Crear nueva noticia.

**Body**:

```json
{
  "title": "Título",
  "content": "Contenido",
  "summary": "Resumen",
  "imageUrl": "https://...",
  "type": "NEWS",
  "priority": "MEDIUM",
  "status": "DRAFT",
  "startDate": "2026-05-01T00:00:00Z",
  "endDate": "2026-05-31T23:59:59Z",
  "isFeatured": false,
  "allowComments": true,
  "allowReactions": true,
  "roles": ["ADMIN", "TECHNICIAN"],
  "userIds": ["uuid1", "uuid2"],
  "departmentIds": ["uuid3"]
}
```

#### `PUT /api/admin/news/[id]`

Actualizar noticia existente.

#### `DELETE /api/admin/news/[id]`

Eliminar noticia.

---

### User API (`/api/news`)

#### `GET /api/news`

Obtener feed de noticias para el usuario autenticado.

**Query Params**:

- `type`: Filtrar por tipo
- `period`: Período (`today|week|month`)

**Respuesta**:

```json
{
  "news": [
    {
      "id": "uuid",
      "title": "Título",
      "type": "NEWS",
      "priority": "MEDIUM",
      "isFeatured": false,
      "createdBy": { "id": "uuid", "name": "Usuario", "avatar": "..." },
      "news_views": [{ "id": "uuid" }],
      "news_reactions": [{ "id": "uuid", "reaction": "👍" }],
      "_count": {
        "news_views": 10,
        "news_reactions": 5,
        "news_comments": 3
      }
    }
  ]
}
```

#### `POST /api/news/[id]/view`

Marcar noticia como vista.

#### `POST /api/news/[id]/react`

Agregar/actualizar reacción.

**Body**:

```json
{
  "reaction": "👍"
}
```

#### `DELETE /api/news/[id]/react`

Eliminar reacción.

#### `POST /api/news/[id]/comment`

Agregar comentario.

**Body**:

```json
{
  "content": "Comentario",
  "parentId": "uuid"
}
```

---

## 9. Auditoría

Todas las acciones de gestión se registran en el sistema de auditorías existente:

- `CREATE`: Creación de noticia
- `UPDATE`: Actualización de noticia
- `DELETE`: Eliminación de noticia

El registro incluye:

- Quién realizó la acción
- Fecha y hora
- Detalles (título, tipo, etc.)

---

_Relacionado: [`FEATURES.md`](./FEATURES.md) · [`MANUAL_TICKETS.md`](./MANUAL_TICKETS.md) · [`MANUAL_INVENTARIO.md`](./MANUAL_INVENTARIO.md)_
