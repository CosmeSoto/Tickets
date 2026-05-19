# Limitaciones conocidas — Tickets y Rondas

Documento de transparencia para operación, auditoría y roadmap. Actualizado: mayo 2026.

---

## Tickets

| #   | Tema                          | Estado       | Notas                                                                                                 |
| --- | ----------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| T1  | Acceso centralizado           | **Resuelto** | `ticket-access.ts` aplicado en endpoints críticos por ID                                              |
| T2  | Asignación manual             | **Resuelto** | Solo `ADMIN`; valida familia del técnico                                                              |
| T3  | Cliente envía `assigneeId`    | **Resuelto** | Rechazado en `POST /api/tickets`                                                                      |
| T4  | Incidencia PATROL falsificada | **Resuelto** | `patrol-incident-validation.ts` en creación                                                           |
| T5  | Foto de incidencia atómica    | **Parcial**  | Ticket se crea aunque falle adjunto; respuesta con `warning`                                          |
| T6  | Plan de resolución / tareas   | **Resuelto** | Acción `resolution_plan` en `ticket-access.ts` + tests en `ticket-access.test.ts`                     |
| T7  | Deuda de lint del repo        | **Abierto**  | ~450 warnings históricos; no bloquean despliegue del módulo                                           |
| T8  | Prisma client desactualizado  | **Abierto**  | Ejecutar `npx prisma generate` tras migraciones; algunos campos nuevos pueden no tipar hasta entonces |

---

## Rondas

| #   | Tema                                   | Estado              | Notas                                                        |
| --- | -------------------------------------- | ------------------- | ------------------------------------------------------------ |
| R1  | Ventana de inicio                      | **Resuelto**        | `scheduledStart ± gracePeriodMinutes`                        |
| R2  | Validación schedule POST               | **Resuelto**        | Familia, ruta, agente, `patrol_family_assignments`           |
| R3  | Solapamiento recurrente                | **Resuelto**        | Todas las ocurrencias en horizonte 30 días                   |
| R4  | Recordatorios duplicados               | **Resuelto**        | Filtro JSON `reminderFor` corregido                          |
| R5  | Foto incidencia en API                 | **Resuelto**        | `FileService.uploadBase64Attachment`                         |
| R6  | GET schedule por ID sin filtro familia | **Pendiente menor** | Confía en UUID; endurecer lectura por rol si se expone lista |
| R7  | Push nativo con app cerrada            | **No implementado** | Solo notificaciones in-app / email según config              |

---

## Inventario (en curso — mayo 2026)

| #   | Tema                                                               | Estado    | Notas                                 |
| --- | ------------------------------------------------------------------ | --------- | ------------------------------------- |
| I1  | Helper `inventory-resource-access.ts`                              | **Hecho** | Assert por tipo de recurso y contrato |
| I2  | P0 IDOR (equipo POST, asignaciones, consumibles, licencias, pagos) | **Hecho** | Ver `docs/MANUAL_INVENTARIO.md` §6    |
| I3  | P1 rutas `[id]` (modelos, lotes, bodegas, proveedores, ventas)     | **Hecho** | `inventory-resource-access.ts`        |
| I4  | JWT `canManageInventory` vs BD                                     | **Hecho** | `inventory-session.ts` en listados P1 |

---

## Noticias y Comunicados (nuevo — mayo 2026)

| #   | Tema                                                | Estado        | Notas                                                                                                                 |
| --- | --------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| N1  | Modelo de datos completo                            | **Hecho**     | 8 tablas: news, news_roles, news_users, news_departments, news_views, news_reactions, news_comments, news_attachments |
| N2  | Integración con sistema de módulos                  | **Hecho**     | `newsEnabled` en users, módulo en system_modules                                                                      |
| N3  | API admin y usuario                                 | **Hecho**     | CRUD completo + feed personalizado                                                                                    |
| N4  | Integración con dashboards                          | **Hecho**     | NewsFeed al principio de Admin, FamilyAdmin y Client dashboards                                                       |
| N5  | Sistema de backups                                  | **Hecho**     | Módulo `news` en BACKUP_MODULE_REGISTRY                                                                               |
| N6  | Documentación técnica                               | **Hecho**     | `docs/MANUAL_NOTICIAS.md` completo                                                                                    |
| N7  | Filtros, paginación y exportación en administración | **Pendiente** | Usar hooks comunes (use-module-data, use-export, etc.)                                                                |

---

## Recomendación antes de módulo Inventarios

Los módulos **Tickets** y **Rondas** están en **v1 production-ready**. **Inventario** tiene P0 y P1 de acceso aplicados; queda P2 (catálogos globales) para auditoría externa estricta del módulo completo.

**Noticias y Comunicados**: Módulo nuevo con funcionalidad completa (modelo, API, UI, backups, documentación). Pendiente: filtros avanzados, paginación y exportación en la administración.

---

_Ver [`MANUAL_TICKETS.md`](./MANUAL_TICKETS.md), [`MANUAL_RONDAS.md`](./MANUAL_RONDAS.md) y [`MANUAL_NOTICIAS.md`](./MANUAL_NOTICIAS.md)._
