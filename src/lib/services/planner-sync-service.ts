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

const ERROR_NOTIFY_THROTTLE_KEY = 'plannerLastErrorNotifiedAt'

const RESOLUTION_TASK_BUCKET_NAME = 'Tickets — Gestión Operaciones'

interface ResolutionTaskForSync {
  id: string
  title: string
  status: string
  dueDate: Date | null
  assignedTo: string | null
}

/** userId del actor que disparó el guardado — solo para dejar rastro en auditoría. */
type ActorId = string

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
}
