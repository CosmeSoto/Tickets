/**
 * Lógica compartida para actualizar una resolution_task, extraída de
 * PATCH .../resolution-plan/tasks/[taskId]/route.ts para que el pull de
 * Fase 2 (cambios hechos directo en Microsoft Planner) pueda aplicar los
 * mismos efectos (auditoría, notificación, contador del plan) sin duplicar
 * la lógica ni volver a disparar un push de vuelta a Planner.
 */
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { auditTaskChange } from '@/lib/audit'
import { calculateDuration, validateTimeRange, combineDateAndTime } from '@/lib/time-utils'
import { ResolutionNotificationService } from '@/lib/services/resolution-notification-service'
import { PlannerSyncService } from '@/lib/services/planner-sync-service'
import { notifyTicketChanged } from '@/lib/tickets/notify-ticket-changed'

export class ResolutionTaskValidationError extends Error {}

export interface ResolutionTaskUpdateBody {
  title?: string
  description?: string | null
  status?: string
  priority?: string
  estimatedHours?: number
  startTime?: string | null
  endTime?: string | null
  actualHours?: number
  assignedTo?: string | null
  dueDate?: string | null
  notes?: string | null
}

type TaskWithPlan = Prisma.resolution_tasksGetPayload<{
  include: { plan: { include: { ticket: true } } }
}>

export interface ApplyResolutionTaskUpdateParams {
  task: TaskWithPlan
  ticketId: string
  body: ResolutionTaskUpdateBody
  /** Autor para auditoría/historial. Null cuando el cambio viene de un
   *  proceso automático (pull de Planner) — en ese caso el historial visible
   *  del ticket se atribuye al asignado de la tarea, si tiene uno. */
  actorUserId: string | null
  /** true en el pull de Fase 2: aplica el cambio sin reenviarlo a Planner
   *  (evita el ciclo infinito push→pull→push). */
  skipPlannerPush?: boolean
}

/**
 * Aplica cambios a una resolution_task: valida, actualiza la fila, registra
 * historial/auditoría si cambió el estado, actualiza el contador del plan,
 * notifica por SSE, sincroniza con Planner (salvo skipPlannerPush) y avisa
 * al técnico si cambió la asignación.
 */
export async function applyResolutionTaskUpdate({
  task,
  ticketId,
  body,
  actorUserId,
  skipPlannerPush,
}: ApplyResolutionTaskUpdateParams) {
  const updateData: any = { updatedAt: new Date() }
  const changes: Record<string, any> = {}
  const oldStatus = task.status

  if (body.title !== undefined && body.title.trim()) {
    updateData.title = body.title.trim()
    changes.title = { old: task.title, new: body.title.trim() }
  }

  if (body.description !== undefined) {
    updateData.description = body.description?.trim() || null
    changes.description = { old: task.description, new: body.description }
  }

  if (body.status !== undefined) {
    // El plan debe estar activo para poder completar/cambiar el estado de sus
    // tareas — mientras está en "borrador" todavía se está armando.
    if (task.plan.status === 'draft') {
      throw new ResolutionTaskValidationError(
        'El plan está en borrador. Actívalo antes de completar sus tareas.'
      )
    }

    updateData.status = body.status
    changes.status = { old: task.status, new: body.status }

    if (body.status === 'completed' && task.status !== 'completed') {
      updateData.completedAt = new Date()
    }
    if (body.status !== 'completed' && task.status === 'completed') {
      updateData.completedAt = null
    }
  }

  if (body.priority !== undefined) {
    updateData.priority = body.priority
    changes.priority = { old: task.priority, new: body.priority }
  }

  if (body.estimatedHours !== undefined) {
    updateData.estimatedHours = body.estimatedHours
    changes.estimatedHours = { old: task.estimatedHours, new: body.estimatedHours }
  }

  if (body.startTime !== undefined || body.endTime !== undefined) {
    const newStartTime = body.startTime !== undefined ? body.startTime : task.startTime
    const newEndTime = body.endTime !== undefined ? body.endTime : task.endTime

    if (newStartTime && newEndTime) {
      if (!validateTimeRange(newStartTime, newEndTime)) {
        throw new ResolutionTaskValidationError(
          'La hora de fin debe ser posterior a la hora de inicio'
        )
      }
      const calculatedDuration = calculateDuration(newStartTime, newEndTime)
      updateData.estimatedHours = calculatedDuration
      changes.estimatedHours = { old: task.estimatedHours, new: calculatedDuration }
    }

    if (body.startTime !== undefined) {
      updateData.startTime = body.startTime
      changes.startTime = { old: task.startTime, new: body.startTime }
    }
    if (body.endTime !== undefined) {
      updateData.endTime = body.endTime
      changes.endTime = { old: task.endTime, new: body.endTime }
    }
  }

  if (body.actualHours !== undefined) {
    updateData.actualHours = body.actualHours
    changes.actualHours = { old: task.actualHours, new: body.actualHours }
  }

  if (body.assignedTo !== undefined) {
    updateData.assignedTo = body.assignedTo
    changes.assignedTo = { old: task.assignedTo, new: body.assignedTo }
  }

  // Fecha límite: SIEMPRE combinar fecha+hora con combineDateAndTime (hora
  // local), nunca `new Date(dateOnlyString)` a secas — eso se interpreta
  // como medianoche UTC y en husos horarios negativos queda un día antes.
  if (body.dueDate !== undefined) {
    if (body.dueDate) {
      const effectiveStartTime = body.startTime !== undefined ? body.startTime : task.startTime
      updateData.dueDate = combineDateAndTime(body.dueDate, effectiveStartTime || '00:00')
    } else {
      updateData.dueDate = null
    }
  } else if (body.startTime !== undefined && task.dueDate) {
    const d = task.dueDate
    const pad = (n: number) => String(n).padStart(2, '0')
    const currentDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    updateData.dueDate = combineDateAndTime(currentDate, body.startTime || '00:00')
  }

  if (body.notes !== undefined) {
    updateData.notes = body.notes?.trim() || null
    changes.notes = { old: task.notes, new: body.notes }
  }

  const updatedTask = await prisma.resolution_tasks.update({
    where: { id: task.id },
    data: updateData,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  })

  if (body.status !== undefined && body.status !== oldStatus) {
    // Autor del historial visible: el actor real, o el asignado de la tarea
    // cuando el cambio viene de un proceso automático (pull de Planner) —
    // sin actor humano no hay a quién atribuírselo, así que se omite.
    const historyUserId = actorUserId ?? task.assignedTo
    if (historyUserId) {
      try {
        await prisma.ticket_history.create({
          data: {
            id: crypto.randomUUID(),
            ticketId: task.plan.ticketId,
            userId: historyUserId,
            action: 'resolution_task_updated',
            field: 'resolution_task',
            oldValue: oldStatus,
            newValue: body.status,
            comment: JSON.stringify({
              planTitle: task.plan.title,
              taskTitle: updatedTask.title,
              priority: updatedTask.priority,
              status: updatedTask.status,
              dueDate: updatedTask.dueDate?.toISOString() || null,
              estimatedHours: updatedTask.estimatedHours,
              completedAt: updatedTask.completedAt?.toISOString() || null,
            }),
            createdAt: new Date(),
          },
        })
      } catch (historyError) {
        console.error('[ResolutionTaskService] Error creating task status history:', historyError)
      }
    }

    const allTasks = await prisma.resolution_tasks.findMany({ where: { planId: task.planId } })
    const completedCount = allTasks.filter(t =>
      t.id === task.id ? body.status === 'completed' : t.status === 'completed'
    ).length

    // A propósito NO se autocompleta el plan aquí aunque completedCount ===
    // totalTasks: se cierra explícitamente desde resolution-plan/route.ts.
    await prisma.resolution_plans.update({
      where: { id: task.planId },
      data: { completedTasks: completedCount, updatedAt: new Date() },
    })
  }

  if (Object.keys(changes).length > 0) {
    await auditTaskChange(task.id, task.planId, actorUserId, 'updated', changes)
  }

  notifyTicketChanged(ticketId, 'plan_task_updated')

  if (!skipPlannerPush) {
    // Nunca lanza — ver planner-sync-service.ts
    void PlannerSyncService.pushTask(
      {
        id: updatedTask.id,
        title: updatedTask.title,
        status: updatedTask.status,
        dueDate: updatedTask.dueDate,
        assignedTo: updatedTask.assignedTo,
      },
      actorUserId ?? ''
    )
  }

  const newAssignedTo = body.assignedTo !== undefined ? body.assignedTo : null
  const assigneeChanged = body.assignedTo !== undefined && body.assignedTo !== task.assignedTo
  if (assigneeChanged && newAssignedTo) {
    ResolutionNotificationService.notifyTaskAssigned({
      taskId: updatedTask.id,
      taskTitle: updatedTask.title,
      dueDate: updatedTask.dueDate ?? new Date(),
      assignedTo: newAssignedTo,
      planTitle: task.plan.title,
      ticketId,
      ticketTitle: task.plan.ticket.title,
    }).catch(err => console.error('[ResolutionTaskService] Error notifying technician:', err))
  }

  return updatedTask
}
