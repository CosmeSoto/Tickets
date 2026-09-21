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
import {
  MsTodoGraphService,
  MsTodoNotConnectedError,
  MS_TODO_PROVIDER,
} from './ms-todo-graph-service'

interface PersonalTaskForSync {
  id: string
  title: string
  status: string
  dueDate: Date | null
}

/** Prefijo del msTaskId placeholder que usa markLinkError cuando el PRIMER
 *  intento de crear la tarea en Microsoft falla (nunca llegó a tener un id
 *  real). Ver hasRealMsTaskId — syncStatus NO alcanza para saber si un link
 *  apunta a una tarea real: un link 'synced' que luego falla al actualizarse
 *  cae a 'error' sin perder su msTaskId real. */
const ERROR_ID_PREFIX = 'error:'

type MsTodoLink = { msTaskId: string; syncStatus: string }

/** true si el link tiene un id de Microsoft real y utilizable — ni un
 *  placeholder de error nunca-creado, ni uno confirmado borrado del lado de
 *  Microsoft (pullChangesForUser lo marca 'deleted', un estado aparte de
 *  'error' para que retryErroredLinks no lo resucite solo).
 *  Deliberadamente NO es un type predicate (`link is MsTodoLink`): con un
 *  tipo de entrada no-union (el resultado completo de Prisma), TS termina
 *  angostando la rama "false" a `never` en vez del tipo original. */
function hasRealMsTaskId(link: MsTodoLink | null | undefined): boolean {
  return !!link && !link.msTaskId.startsWith(ERROR_ID_PREFIX) && link.syncStatus !== 'deleted'
}

async function hasConnectedAccount(userId: string): Promise<boolean> {
  const account = await prisma.oauth_accounts.findUnique({
    where: { provider_providerId: { provider: MS_TODO_PROVIDER, providerId: userId } },
    select: { id: true },
  })
  return !!account
}

/**
 * Registra un fallo de sync. Usa upsert (no updateMany) para que también
 * funcione cuando el link todavía no existe — el caso más importante: la
 * PRIMERA sincronización de una tarea nueva, si falla antes de crear el
 * link, antes quedaba muda (updateMany sobre 0 filas) y el usuario nunca se
 * enteraba de que nada se sincronizó. `msTaskId` usa un placeholder único
 * por tarea (`error:<personalTaskId>`) — un '' compartido violaría el
 * índice único [userId, msTaskId] en cuanto un mismo usuario tuviera dos
 * tareas fallidas a la vez.
 */
async function markLinkError(personalTaskId: string, userId: string, message: string) {
  await prisma.personal_task_ms_todo_links
    .upsert({
      where: { personalTaskId },
      update: { syncStatus: 'error', syncError: message.slice(0, 500) },
      create: {
        id: randomUUID(),
        personalTaskId,
        userId,
        msTaskListId: '',
        msTaskId: `${ERROR_ID_PREFIX}${personalTaskId}`,
        syncStatus: 'error',
        syncError: message.slice(0, 500),
      },
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

      // hasRealMsTaskId, NO syncStatus === 'synced': un link puede caer a
      // 'error' después de haberse creado bien (una actualización posterior
      // falló) y seguir teniendo un msTaskId real y válido — tratar eso como
      // "hay que crearla de nuevo" duplicaba la tarea en Microsoft en cada
      // reintento (el link.msTaskId real se sobreescribía con uno nuevo).
      if (hasRealMsTaskId(link)) {
        const result = await MsTodoGraphService.updateTask(
          accessToken,
          link!.msTaskListId,
          link!.msTaskId,
          {
            title: task.title,
            status: task.status,
            dueDateTime: task.dueDate ? task.dueDate.toISOString() : null,
          }
        )
        await prisma.personal_task_ms_todo_links.update({
          where: { id: link!.id },
          data: {
            etag: result.etag,
            syncStatus: 'synced',
            syncError: null,
            lastSyncedAt: new Date(),
          },
        })
        return
      }

      // Reutiliza la lista de cualquier otra tarea ya sincronizada de este
      // mismo usuario en vez de volver a resolverla por nombre cada vez —
      // evita crear listas duplicadas si dos "primeras tareas" se disparan
      // casi al mismo tiempo, y ahorra una llamada a Graph en el caso común.
      const existingListId =
        link?.msTaskListId ||
        (
          await prisma.personal_task_ms_todo_links.findFirst({
            where: { userId, msTaskListId: { not: '' } },
            select: { msTaskListId: true },
          })
        )?.msTaskListId
      const listId =
        existingListId || (await MsTodoGraphService.getOrCreateDefaultList(accessToken))

      const created = await MsTodoGraphService.createTask(accessToken, listId, {
        title: task.title,
        status: task.status as 'pending' | 'in_progress' | 'completed' | 'blocked',
        dueDateTime: task.dueDate ? task.dueDate.toISOString() : null,
      })

      // upsert (no create): si dos llamadas concurrentes llegan hasta acá
      // para la misma tarea (crear seguido de inmediato de un editar, por
      // ejemplo), la segunda no explota con una violación de índice único —
      // gana la última en escribir, y como mucho queda una tarea huérfana
      // en Microsoft To Do (que el usuario puede borrar allá), nunca un 500.
      await prisma.personal_task_ms_todo_links.upsert({
        where: { personalTaskId: task.id },
        update: {
          userId,
          msTaskListId: listId,
          msTaskId: created.id,
          etag: created.etag,
          syncStatus: 'synced',
          syncError: null,
          lastSyncedAt: new Date(),
        },
        create: {
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
      // hasRealMsTaskId, no "syncStatus === 'synced'": un link en 'error' con
      // un msTaskId real (una actualización fallida, no la creación) SÍ debe
      // borrarse en Microsoft — omitirlo dejaba la tarea huérfana allá.
      if (!hasRealMsTaskId(link)) return

      const accessToken = await MsTodoGraphService.getAccessToken(userId)
      await MsTodoGraphService.deleteTask(accessToken, link!.msTaskListId, link!.msTaskId)
      await prisma.personal_task_ms_todo_links.delete({ where: { id: link!.id } })
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
    const links = await prisma.personal_task_ms_todo_links.findMany({
      where: { userId, syncStatus: 'synced' },
    })
    if (links.length === 0) return result

    // Normalmente todas las tareas de un usuario viven en la misma lista,
    // pero si el nombre de la lista cambió/desapareció en algún momento
    // (getOrCreateDefaultList crea una nueva), podrían quedar repartidas en
    // más de una — se agrupa por lista real en vez de asumir links[0].
    const listIds = [...new Set(links.map(l => l.msTaskListId))]
    const graphTaskById = new Map<
      string,
      Awaited<ReturnType<typeof MsTodoGraphService.listTasks>>[number]
    >()
    for (const listId of listIds) {
      const tasks = await MsTodoGraphService.listTasks(accessToken, listId)
      for (const t of tasks) graphTaskById.set(t.id, t)
    }

    for (const link of links) {
      const graphTask = graphTaskById.get(link.msTaskId)

      if (!graphTask) {
        // 'deleted', no 'error': distingue "la borraron a propósito en
        // Microsoft" de "falló la sincronización" — retryErroredLinks solo
        // reintenta 'error', así que esto no la resucita sola en el próximo
        // cron. Un push posterior explícito (el usuario edita la tarea en la
        // app) sí la vuelve a crear — hasRealMsTaskId trata 'deleted' como
        // "sin id real", así que pushTask toma la rama de creación.
        await prisma.personal_task_ms_todo_links
          .update({
            where: { id: link.id },
            data: { syncStatus: 'deleted', syncError: 'Eliminada en Microsoft To Do' },
          })
          .catch(() => {})
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

        // Sin el guard "&&" de antes: un título no puede quedar vacío en To
        // Do (campo requerido), así que comparar directo es seguro y permite
        // detectar cualquier cambio real, no solo "de algo a algo".
        if (graphTask.title !== task.title) {
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

        // Comparación simétrica: antes, un dueDate borrado en Microsoft
        // (graphTask.dueDateTime === null) nunca se aplicaba localmente
        // porque el `if` exigía que el valor entrante fuera verdadero.
        const newDue = graphTask.dueDateTime ? new Date(graphTask.dueDateTime) : null
        const dueDiffers = (newDue?.getTime() ?? null) !== (task.dueDate?.getTime() ?? null)
        if (dueDiffers) {
          updateData.dueDate = newDue
          changed = true
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

  /**
   * Reintenta el push de tareas cuyo link quedó en 'error' (ej. el token
   * estaba vencido, Microsoft respondió 5xx) — sin esto, una tarea que
   * falló una vez queda desincronizada para siempre, porque solo
   * POST/PATCH disparan un push nuevo y nada obliga al usuario a volver a
   * tocar esa tarea puntual. Se llama junto a pullChangesForUser desde el
   * cron, después del sondeo de cambios entrantes.
   */
  static async retryErroredLinks(userId: string): Promise<{ retried: number }> {
    const erroredLinks = await prisma.personal_task_ms_todo_links.findMany({
      where: { userId, syncStatus: 'error' },
      select: { personalTaskId: true },
    })
    if (erroredLinks.length === 0) return { retried: 0 }

    const tasks = await prisma.personal_tasks.findMany({
      where: { id: { in: erroredLinks.map(l => l.personalTaskId) }, userId },
    })
    for (const task of tasks) {
      await this.pushTask(task, userId)
    }
    return { retried: tasks.length }
  }
}
