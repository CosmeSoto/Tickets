/**
 * PlannerSyncService — sincronización saliente (app → Planner) de
 * resolution_tasks. Fase 1: una sola vía, sin sondeo — se dispara al crear o
 * editar una tarea (ver src/app/api/tickets/[id]/resolution-plan/tasks/**),
 * de forma asíncrona: un problema con Microsoft nunca debe impedir guardar
 * la tarea en la aplicación.
 */

import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { PlannerGraphService } from './planner-graph-service'
import { getPlannerModuleSettings } from '@/lib/planner/settings'
import { AuditServiceComplete, AuditActionsComplete } from './audit-service-complete'
import { notifyAdmins } from '@/lib/api/notify'
// Import dinámico (no estático) para evitar un ciclo de módulos: este archivo
// es importado por resolution-task-service.ts (pushTask allí mismo).

const ERROR_NOTIFY_THROTTLE_KEY = 'plannerLastErrorNotifiedAt'

const RESOLUTION_TASK_BUCKET_NAME = 'Tickets — Gestión Operaciones'

interface ResolutionTaskForSync {
  id: string
  title: string
  status: string
  dueDate: Date | null
  assignedTo: string | null
}

/** userId del actor que disparó el guardado — solo para dejar rastro en auditoría.
 *  null cuando el origen es el pull automático de Fase 2 (sin actor humano). */
type ActorId = string | null

function toUtcDateOnly(isoDateTime: string): string {
  const d = new Date(isoDateTime)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function statusFromPercentComplete(percentComplete: number): string {
  if (percentComplete >= 100) return 'completed'
  if (percentComplete > 0) return 'in_progress'
  // Nunca 'blocked': Planner no tiene ese concepto, así que un pull nunca lo
  // asigna (ver limitación documentada en el plan de la Fase 2).
  return 'pending'
}

function percentCompleteFor(status: string): number {
  if (status === 'completed') return 100
  if (status === 'in_progress') return 50
  return 0
}

async function resolveAssigneeAadId(userId: string | null): Promise<string | null> {
  if (!userId) return null
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { oauthProvider: true, oauthId: true },
  })
  // Solo usuarios que iniciaron sesión con Azure AD tienen una identidad de
  // Microsoft 365 resoluble — el resto (clientes, cuentas locales) se crea
  // sin asignar en Planner en vez de fallar.
  if (user?.oauthProvider === 'azure-ad' && user.oauthId) return user.oauthId
  return null
}

async function markLinkError(sourceId: string, message: string, actorId: ActorId) {
  await prisma.planner_task_links
    .upsert({
      where: { sourceType_sourceId: { sourceType: 'resolution_task', sourceId } },
      update: { syncStatus: 'error', syncError: message.slice(0, 500), lastSyncedAt: new Date() },
      create: {
        sourceType: 'resolution_task',
        sourceId,
        plannerTaskId: '',
        plannerPlanId: '',
        syncStatus: 'error',
        syncError: message.slice(0, 500),
        lastSyncedAt: new Date(),
      },
    })
    .catch(err => console.error('[PLANNER SYNC] Error registrando fallo de sync:', err))

  await AuditServiceComplete.log({
    action: AuditActionsComplete.PLANNER_SYNC_ERROR,
    entityType: 'planner_task',
    entityId: sourceId,
    userId: actorId,
    details: { error: message.slice(0, 500) },
  }).catch(() => {})

  await notifyAdminsOfSyncErrorOncePerDay(message)
}

/**
 * Evita saturar a los admins: si Planner está caído, cada tarea creada/editada
 * fallaría y generaría una notificación — se avisa como máximo una vez por día
 * en vez de una por cada tarea (mismo criterio de dedup diario que las alertas
 * de stock bajo, ver src/lib/inventory/notifications.ts).
 */
async function notifyAdminsOfSyncErrorOncePerDay(message: string): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const lastNotified = await prisma.system_settings.findUnique({
    where: { key: ERROR_NOTIFY_THROTTLE_KEY },
  })
  if (lastNotified?.value && new Date(lastNotified.value) >= today) return

  await notifyAdmins(
    'ERROR',
    'Error sincronizando tareas con Microsoft Planner',
    `Una o más tareas no se pudieron sincronizar con Planner: ${message.slice(0, 200)}`,
    { metadata: { link: '/admin/planner/settings' } }
  ).catch(() => {})

  await prisma.system_settings
    .upsert({
      where: { key: ERROR_NOTIFY_THROTTLE_KEY },
      update: { value: new Date().toISOString(), updatedAt: new Date() },
      create: {
        id: randomUUID(),
        key: ERROR_NOTIFY_THROTTLE_KEY,
        value: new Date().toISOString(),
        description: 'Último aviso a admins por fallo de sincronización con Planner',
        updatedAt: new Date(),
      },
    })
    .catch(() => {})
}

export class PlannerSyncService {
  /** Crea o actualiza en Planner la tarea correspondiente. Nunca lanza. */
  static async pushTask(task: ResolutionTaskForSync, actorId: ActorId): Promise<void> {
    try {
      const settings = await getPlannerModuleSettings()
      if (!settings.enabled || !settings.planId) return

      const accessToken = await PlannerGraphService.getAccessToken()
      const assigneeAadId = await resolveAssigneeAadId(task.assignedTo)

      const existingLink = await prisma.planner_task_links.findUnique({
        where: { sourceType_sourceId: { sourceType: 'resolution_task', sourceId: task.id } },
      })

      if (existingLink?.plannerTaskId) {
        const result = await PlannerGraphService.updateTask(
          accessToken,
          existingLink.plannerTaskId,
          existingLink.etag ?? '',
          {
            title: task.title,
            dueDateTime: task.dueDate ? task.dueDate.toISOString() : null,
            percentComplete: percentCompleteFor(task.status),
            assigneeAadId,
          }
        )
        await prisma.planner_task_links.update({
          where: { id: existingLink.id },
          data: {
            etag: result.etag || existingLink.etag,
            syncStatus: 'synced',
            syncError: null,
            lastSyncedAt: new Date(),
          },
        })
        await AuditServiceComplete.log({
          action: AuditActionsComplete.PLANNER_TASK_PUSHED,
          entityType: 'planner_task',
          entityId: task.id,
          userId: actorId,
          details: { plannerTaskId: existingLink.plannerTaskId, mode: 'update' },
        }).catch(() => {})
        return
      }

      const bucketId = await PlannerGraphService.getOrCreateBucket(
        accessToken,
        settings.planId,
        RESOLUTION_TASK_BUCKET_NAME
      )

      const created = await PlannerGraphService.createTask(accessToken, {
        planId: settings.planId,
        bucketId,
        title: task.title,
        dueDateTime: task.dueDate ? task.dueDate.toISOString() : null,
        percentComplete: percentCompleteFor(task.status),
        assigneeAadId,
      })

      await prisma.planner_task_links.upsert({
        where: { sourceType_sourceId: { sourceType: 'resolution_task', sourceId: task.id } },
        update: {
          plannerTaskId: created.id,
          plannerPlanId: settings.planId,
          plannerBucketId: bucketId,
          etag: created.etag,
          syncStatus: 'synced',
          syncError: null,
          lastSyncedAt: new Date(),
        },
        create: {
          sourceType: 'resolution_task',
          sourceId: task.id,
          plannerTaskId: created.id,
          plannerPlanId: settings.planId,
          plannerBucketId: bucketId,
          etag: created.etag,
          syncStatus: 'synced',
          lastSyncedAt: new Date(),
        },
      })

      await AuditServiceComplete.log({
        action: AuditActionsComplete.PLANNER_TASK_PUSHED,
        entityType: 'planner_task',
        entityId: task.id,
        userId: actorId,
        details: { plannerTaskId: created.id, mode: 'create' },
      }).catch(() => {})
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      console.error('[PLANNER SYNC] Error sincronizando tarea', task.id, message)
      await markLinkError(task.id, message, actorId)
    }
  }

  /** Elimina en Planner la tarea vinculada (si existe) al borrar la tarea interna. Nunca lanza. */
  static async removeTask(sourceId: string, actorId: ActorId): Promise<void> {
    try {
      const settings = await getPlannerModuleSettings()
      if (!settings.enabled) return

      const link = await prisma.planner_task_links.findUnique({
        where: { sourceType_sourceId: { sourceType: 'resolution_task', sourceId } },
      })
      if (!link?.plannerTaskId) return

      const accessToken = await PlannerGraphService.getAccessToken()
      await PlannerGraphService.deleteTask(accessToken, link.plannerTaskId, link.etag ?? '')
      await prisma.planner_task_links.delete({ where: { id: link.id } })

      await AuditServiceComplete.log({
        action: AuditActionsComplete.PLANNER_TASK_PUSHED,
        entityType: 'planner_task',
        entityId: sourceId,
        userId: actorId,
        details: { plannerTaskId: link.plannerTaskId, mode: 'delete' },
      }).catch(() => {})
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      console.error('[PLANNER SYNC] Error eliminando tarea en Planner', sourceId, message)
      await markLinkError(sourceId, message, actorId)
    }
  }

  /**
   * Fase 2 — trae de vuelta cambios hechos directo en Planner (estado/progreso,
   * título, fecha límite). Solo corre si syncDirection==='bidirectional' (el
   * admin lo activa explícitamente en Configuración → Tareas/Planner).
   *
   * Una sola llamada a Graph por corrida (lista completa de tareas del plan,
   * no una por tarea) — el etag de cada tarea evita reescribir en la base de
   * datos las que no cambiaron desde el último sondeo. Nunca lanza.
   */
  static async pullChanges(): Promise<{ applied: number; skipped: number; errors: number }> {
    const result = { applied: 0, skipped: 0, errors: 0 }
    try {
      const settings = await getPlannerModuleSettings()
      if (!settings.enabled || !settings.planId || settings.syncDirection !== 'bidirectional') {
        return result
      }

      const accessToken = await PlannerGraphService.getAccessToken()
      const graphTasks = await PlannerGraphService.listTasks(accessToken, settings.planId)
      const graphTaskById = new Map(graphTasks.map(t => [t.id, t]))

      const links = await prisma.planner_task_links.findMany({
        where: { sourceType: 'resolution_task', plannerPlanId: settings.planId },
      })

      const { applyResolutionTaskUpdate } = await import('./resolution-task-service')

      for (const link of links) {
        const graphTask = graphTaskById.get(link.plannerTaskId)

        // Ya no existe en Planner: no se borra la tarea local (podría ser un
        // borrado accidental del lado de Planner) — solo se marca el enlace
        // para que un admin lo vea en Configuración → Tareas/Planner.
        if (!graphTask) {
          if (link.syncStatus !== 'error') {
            await prisma.planner_task_links
              .update({
                where: { id: link.id },
                data: {
                  syncStatus: 'error',
                  syncError: 'Eliminada en Planner',
                  lastSyncedAt: new Date(),
                },
              })
              .catch(() => {})
          }
          continue
        }

        // Sin cambios desde el último sondeo/push — nada que hacer.
        if (graphTask.etag && graphTask.etag === link.etag) {
          result.skipped++
          continue
        }

        try {
          const task = await prisma.resolution_tasks.findUnique({
            where: { id: link.sourceId },
            include: { plan: { include: { ticket: true } } },
          })
          if (!task) continue

          // La app gana si se editó después del último sondeo — evita pisar
          // una edición reciente del técnico con un dato más viejo de Planner.
          if (link.lastSyncedAt && task.updatedAt > link.lastSyncedAt) {
            result.skipped++
            continue
          }

          await applyResolutionTaskUpdate({
            task,
            ticketId: task.plan.ticketId,
            body: {
              title: graphTask.title,
              status: statusFromPercentComplete(graphTask.percentComplete),
              // Graph entrega dueDateTime en UTC medianoche (fecha sin hora
              // real) — se extrae solo la fecha en UTC, nunca en hora local,
              // para no correr el día al combinarla de nuevo más abajo.
              dueDate: graphTask.dueDateTime ? toUtcDateOnly(graphTask.dueDateTime) : null,
            },
            actorUserId: null,
            skipPlannerPush: true,
          })

          await prisma.planner_task_links.update({
            where: { id: link.id },
            data: {
              etag: graphTask.etag,
              syncStatus: 'synced',
              syncError: null,
              lastSyncedAt: new Date(),
            },
          })
          result.applied++
        } catch (err) {
          result.errors++
          const message = err instanceof Error ? err.message : 'Error desconocido'
          console.error('[PLANNER SYNC] Error aplicando cambio entrante', link.sourceId, message)
          await markLinkError(link.sourceId, message, null)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      console.error('[PLANNER SYNC] Error en pullChanges:', message)
      await notifyAdminsOfSyncErrorOncePerDay(message)
    }
    return result
  }
}
