/**
 * MsTodoSyncService — sincronización de personal_tasks con la lista de
 * Microsoft To Do del propio usuario. A diferencia de PlannerSyncService
 * (una cuenta de servicio compartida, un plan/bucket fijo para todos), aquí
 * cada usuario tiene su propia cuenta y su propia lista — por eso es un
 * servicio separado, no una extensión de aquel.
 *
 * pushTask/removeTask nunca lanzan y no hacen nada (en silencio, sin log de
 * error) si el usuario no tiene cuenta de Microsoft To Do conectada — ese es
 * el comportamiento esperado "sin sincronización", no una falla.
 */
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { MsTodoGraphService, MsTodoNotConnectedError } from './ms-todo-graph-service'

interface PersonalTaskForSync {
  id: string
  title: string
  status: string
  dueDate: Date | null
}

async function hasConnectedAccount(userId: string): Promise<boolean> {
  const account = await prisma.oauth_accounts.findUnique({
    where: { provider_providerId: { provider: 'microsoft-todo', providerId: userId } },
    select: { id: true },
  })
  return !!account
}

async function markLinkError(personalTaskId: string, userId: string, message: string) {
  await prisma.personal_task_ms_todo_links
    .updateMany({
      where: { personalTaskId },
      data: { syncStatus: 'error', syncError: message.slice(0, 500) },
    })
    .catch(() => {})
  console.error('[MS TODO SYNC] Error sincronizando tarea', personalTaskId, 'de', userId, message)
}

export class MsTodoSyncService {
  /** Crea o actualiza en Microsoft To Do la tarea vinculada. Nunca lanza. */
  static async pushTask(task: PersonalTaskForSync, userId: string): Promise<void> {
    try {
      if (!(await hasConnectedAccount(userId))) return // sin cuenta vinculada: sin sync, sin error

      const accessToken = await MsTodoGraphService.getAccessToken(userId)
      const link = await prisma.personal_task_ms_todo_links.findUnique({
        where: { personalTaskId: task.id },
      })

      if (link) {
        const result = await MsTodoGraphService.updateTask(
          accessToken,
          link.msTaskListId,
          link.msTaskId,
          {
            title: task.title,
            status: task.status,
            dueDateTime: task.dueDate ? task.dueDate.toISOString() : null,
          }
        )
        await prisma.personal_task_ms_todo_links.update({
          where: { id: link.id },
          data: {
            etag: result.etag,
            syncStatus: 'synced',
            syncError: null,
            lastSyncedAt: new Date(),
          },
        })
        return
      }

      const listId = await MsTodoGraphService.getOrCreateDefaultList(accessToken)
      const created = await MsTodoGraphService.createTask(accessToken, listId, {
        title: task.title,
        status: task.status as 'pending' | 'in_progress' | 'completed' | 'blocked',
        dueDateTime: task.dueDate ? task.dueDate.toISOString() : null,
      })

      await prisma.personal_task_ms_todo_links.create({
        data: {
          id: randomUUID(),
          personalTaskId: task.id,
          userId,
          msTaskListId: listId,
          msTaskId: created.id,
          etag: created.etag,
          syncStatus: 'synced',
          lastSyncedAt: new Date(),
        },
      })
    } catch (err) {
      if (err instanceof MsTodoNotConnectedError) return
      const message = err instanceof Error ? err.message : 'Error desconocido'
      await markLinkError(task.id, userId, message)
    }
  }

  /** Elimina en Microsoft To Do la tarea vinculada, si existe. Nunca lanza. */
  static async removeTask(personalTaskId: string, userId: string): Promise<void> {
    try {
      if (!(await hasConnectedAccount(userId))) return

      const link = await prisma.personal_task_ms_todo_links.findUnique({
        where: { personalTaskId },
      })
      if (!link) return

      const accessToken = await MsTodoGraphService.getAccessToken(userId)
      await MsTodoGraphService.deleteTask(accessToken, link.msTaskListId, link.msTaskId)
      await prisma.personal_task_ms_todo_links.delete({ where: { id: link.id } })
    } catch (err) {
      if (err instanceof MsTodoNotConnectedError) return
      const message = err instanceof Error ? err.message : 'Error desconocido'
      console.error('[MS TODO SYNC] Error eliminando tarea', personalTaskId, 'de', userId, message)
    }
  }

  /**
   * Trae de vuelta cambios hechos directo en Microsoft To Do (título, estado,
   * fecha límite) para un usuario. Mismo criterio de conflicto que
   * PlannerSyncService.pullChanges: gana la app si la tarea local se editó
   * después del último sondeo. Se llama por usuario desde el cron
   * /api/cron/ms-todo-pull-changes, que itera todas las cuentas conectadas y
   * atrapa el error de cada una por separado (ver ese route handler).
   */
  static async pullChangesForUser(
    userId: string
  ): Promise<{ applied: number; skipped: number; errors: number }> {
    const result = { applied: 0, skipped: 0, errors: 0 }

    const accessToken = await MsTodoGraphService.getAccessToken(userId)
    const links = await prisma.personal_task_ms_todo_links.findMany({ where: { userId } })
    if (links.length === 0) return result

    // Una sola lectura de la lista por usuario (igual de barato que el
    // criterio ya usado para Planner) — todas las tareas vinculadas de este
    // usuario viven en la misma lista (getOrCreateDefaultList).
    const listId = links[0].msTaskListId
    const graphTasks = await MsTodoGraphService.listTasks(accessToken, listId)
    const graphTaskById = new Map(graphTasks.map(t => [t.id, t]))

    for (const link of links) {
      const graphTask = graphTaskById.get(link.msTaskId)

      if (!graphTask) {
        if (link.syncStatus !== 'error') {
          await prisma.personal_task_ms_todo_links
            .update({
              where: { id: link.id },
              data: { syncStatus: 'error', syncError: 'Eliminada en Microsoft To Do' },
            })
            .catch(() => {})
        }
        continue
      }

      if (graphTask.etag && graphTask.etag === link.etag) {
        result.skipped++
        continue
      }

      try {
        const task = await prisma.personal_tasks.findUnique({ where: { id: link.personalTaskId } })
        if (!task) continue

        if (link.lastSyncedAt && task.updatedAt > link.lastSyncedAt) {
          result.skipped++
          continue
        }

        // MsTodoGraphService.listTasks ya normaliza status con fromGraphStatus
        // (pending/in_progress/completed/blocked) — no hay que reconvertirlo.
        const newStatus = graphTask.status

        const updateData: Record<string, unknown> = { updatedAt: new Date() }
        let changed = false
        if (graphTask.title && graphTask.title !== task.title) {
          updateData.title = graphTask.title
          changed = true
        }
        if (newStatus !== task.status) {
          updateData.status = newStatus
          updateData.completedAt =
            newStatus === 'completed'
              ? new Date()
              : task.status === 'completed'
                ? null
                : task.completedAt
          changed = true
        }
        if (graphTask.dueDateTime) {
          const newDue = new Date(graphTask.dueDateTime)
          if (!task.dueDate || newDue.getTime() !== task.dueDate.getTime()) {
            updateData.dueDate = newDue
            changed = true
          }
        }

        if (changed) {
          await prisma.personal_tasks.update({ where: { id: task.id }, data: updateData })
          result.applied++
        } else {
          result.skipped++
        }

        await prisma.personal_task_ms_todo_links.update({
          where: { id: link.id },
          data: {
            etag: graphTask.etag,
            syncStatus: 'synced',
            syncError: null,
            lastSyncedAt: new Date(),
          },
        })
      } catch (err) {
        result.errors++
        const message = err instanceof Error ? err.message : 'Error desconocido'
        await markLinkError(link.personalTaskId, userId, message)
      }
    }

    return result
  }
}
