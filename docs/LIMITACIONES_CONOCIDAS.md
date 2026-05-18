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

## Recomendación antes de módulo Inventarios

Los módulos **Tickets** y **Rondas** están en estado **v1 production-ready** para documentación, operación interna y auditoría de permisos en capa API. Ejecutar `npx prisma generate` tras cada migración y `npm test -- ticket-access` en CI.

---

_Ver [`MANUAL_TICKETS.md`](./MANUAL_TICKETS.md) y [`MANUAL_RONDAS.md`](./MANUAL_RONDAS.md)._
