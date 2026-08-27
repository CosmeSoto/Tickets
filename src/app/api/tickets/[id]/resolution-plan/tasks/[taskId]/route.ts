import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { auditTaskChange } from '@/lib/audit'
import { calculateDuration, validateTimeRange, combineDateAndTime } from '@/lib/time-utils'
import { NotificationService } from '@/lib/services/notification-service'
import { ResolutionNotificationService } from '@/lib/services/resolution-notification-service'
import {
  assertTicketAccess,
  TicketAccessError,
  toTicketAccessUser,
} from '@/lib/tickets/ticket-access'
import { notifyTicketChanged } from '@/lib/tickets/notify-ticket-changed'

/**
 * PATCH /api/tickets/[id]/resolution-plan/tasks/[taskId]
 * Actualiza una tarea del plan de resolución
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id: ticketId, taskId } = await params
    const body = await request.json()

    // Buscar tarea
    const task = await prisma.resolution_tasks.findUnique({
      where: { id: taskId },
      include: {
        plan: {
          include: {
            ticket: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ success: false, message: 'Tarea no encontrada' }, { status: 404 })
    }

    // Verificar que la tarea pertenece al ticket correcto
    if (task.plan.ticketId !== ticketId) {
      return NextResponse.json(
        { success: false, message: 'Tarea no pertenece a este ticket' },
        { status: 400 }
      )
    }

    try {
      await assertTicketAccess(
        toTicketAccessUser(session.user),
        {
          id: task.plan.ticket.id,
          clientId: task.plan.ticket.clientId,
          assigneeId: task.plan.ticket.assigneeId,
          familyId: task.plan.ticket.familyId,
        },
        'resolution_plan'
      )
    } catch (err) {
      if (err instanceof TicketAccessError) {
        return NextResponse.json(
          { success: false, message: err.message },
          { status: err.statusCode }
        )
      }
      throw err
    }

    // Preparar datos de actualización
    const updateData: any = {
      updatedAt: new Date(),
    }

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
      updateData.status = body.status
      changes.status = { old: task.status, new: body.status }

      // Si se marca como completada, registrar fecha
      if (body.status === 'completed' && task.status !== 'completed') {
        updateData.completedAt = new Date()
      }
      // Si se desmarca como completada, limpiar fecha
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

    // Manejar actualización de horarios
    if (body.startTime !== undefined || body.endTime !== undefined) {
      const newStartTime = body.startTime !== undefined ? body.startTime : task.startTime
      const newEndTime = body.endTime !== undefined ? body.endTime : task.endTime

      // Validar si ambos horarios están presentes
      if (newStartTime && newEndTime) {
        if (!validateTimeRange(newStartTime, newEndTime)) {
          return NextResponse.json(
            { success: false, message: 'La hora de fin debe ser posterior a la hora de inicio' },
            { status: 400 }
          )
        }

        // Calcular duración automáticamente
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

    // Fecha límite: SIEMPRE combinar fecha+hora con combineDateAndTime (hora local),
    // nunca `new Date(dateOnlyString)` a secas — eso se interpreta como medianoche UTC
    // y en husos horarios negativos la fecha guardada queda un día antes.
    // Este bloque reemplaza la lógica anterior, que quedaba duplicada y la segunda
    // pasada pisaba silenciosamente el valor ya calculado arriba.
    if (body.dueDate !== undefined) {
      if (body.dueDate) {
        const effectiveStartTime = body.startTime !== undefined ? body.startTime : task.startTime
        updateData.dueDate = combineDateAndTime(body.dueDate, effectiveStartTime || '00:00')
      } else {
        updateData.dueDate = null
      }
    } else if (body.startTime !== undefined && task.dueDate) {
      // No cambió la fecha, solo la hora de inicio: mantener el día (en local, no UTC)
      // y recombinar con la nueva hora.
      const d = task.dueDate
      const pad = (n: number) => String(n).padStart(2, '0')
      const currentDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      updateData.dueDate = combineDateAndTime(currentDate, body.startTime || '00:00')
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes?.trim() || null
      changes.notes = { old: task.notes, new: body.notes }
    }

    // Actualizar tarea
    const updatedTask = await prisma.resolution_tasks.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Si cambió el estado de completitud, actualizar contador en el plan
    if (body.status !== undefined && body.status !== oldStatus) {
      // Registrar el cambio de estado de la tarea en el historial del ticket —
      // antes solo se registraba la creación de la tarea y (si completaba TODO
      // el plan) el cierre del plan, así que marcar una tarea individual como
      // completada/en progreso/bloqueada era invisible en "Historial".
      try {
        await prisma.ticket_history.create({
          data: {
            id: crypto.randomUUID(),
            ticketId: task.plan.ticketId,
            userId: session.user.id,
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
        console.error('[API] Error creating task status history:', historyError)
      }

      const allTasks = await prisma.resolution_tasks.findMany({
        where: { planId: task.planId },
      })

      const completedCount = allTasks.filter(t =>
        t.id === taskId ? body.status === 'completed' : t.status === 'completed'
      ).length

      const totalTasks = allTasks.length
      const planUpdateData: any = {
        completedTasks: completedCount,
        updatedAt: new Date(),
      }

      // Si todas las tareas están completadas y el plan está activo, marcarlo como completado
      if (completedCount === totalTasks && totalTasks > 0 && task.plan.status === 'active') {
        planUpdateData.status = 'completed'
        planUpdateData.completedDate = new Date()

        // Registrar en el historial del ticket
        await prisma.ticket_history.create({
          data: {
            id: crypto.randomUUID(),
            ticketId: task.plan.ticketId,
            userId: session.user.id,
            action: 'resolution_plan_completed',
            field: 'resolution_plan',
            oldValue: 'active',
            newValue: 'completed',
            comment: `Plan de resolución completado: "${task.plan.title}". Todas las tareas (${totalTasks}) han sido finalizadas exitosamente.`,
            createdAt: new Date(),
          },
        })

        // Crear notificación para el cliente
        await NotificationService.push({
          userId: task.plan.ticket.clientId,
          type: 'SUCCESS',
          title: 'Plan de resolución completado',
          message: `El plan de resolución "${task.plan.title}" ha sido completado exitosamente. Todas las tareas programadas han sido finalizadas.`,
          ticketId: task.plan.ticketId,
          metadata: {
            planId: task.plan.id,
            planTitle: task.plan.title,
            totalTasks,
            completedTasks: completedCount,
            link: `/client/tickets/${task.plan.ticketId}`,
          },
        }).catch(() => {})
      }

      await prisma.resolution_plans.update({
        where: { id: task.planId },
        data: planUpdateData,
      })
    }

    // Auditoría
    if (Object.keys(changes).length > 0) {
      await auditTaskChange(taskId, task.planId, session.user.id, 'updated', changes)
    }

    notifyTicketChanged(ticketId, 'plan_task_updated')

    // ── Notificar al técnico si cambia la asignación ─────────────────────
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
      }).catch(err => console.error('[API] Error notifying reassigned technician:', err))
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedTask.id,
        title: updatedTask.title,
        description: updatedTask.description,
        status: updatedTask.status,
        priority: updatedTask.priority,
        estimatedHours: updatedTask.estimatedHours,
        actualHours: updatedTask.actualHours,
        startTime: updatedTask.startTime,
        endTime: updatedTask.endTime,
        assignedTo: updatedTask.assignee,
        dueDate: updatedTask.dueDate?.toISOString() || null,
        completedAt: updatedTask.completedAt?.toISOString() || null,
        notes: updatedTask.notes,
        createdAt: updatedTask.createdAt.toISOString(),
        updatedAt: updatedTask.updatedAt.toISOString(),
      },
      message: 'Tarea actualizada exitosamente',
    })
  } catch (error) {
    console.error('[API] Error in resolution task PATCH:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar la tarea',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/tickets/[id]/resolution-plan/tasks/[taskId]
 * Elimina una tarea del plan de resolución
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id: ticketId, taskId } = await params

    // Buscar tarea
    const task = await prisma.resolution_tasks.findUnique({
      where: { id: taskId },
      include: {
        plan: {
          include: {
            ticket: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ success: false, message: 'Tarea no encontrada' }, { status: 404 })
    }

    // Verificar que la tarea pertenece al ticket correcto
    if (task.plan.ticketId !== ticketId) {
      return NextResponse.json(
        { success: false, message: 'Tarea no pertenece a este ticket' },
        { status: 400 }
      )
    }

    try {
      await assertTicketAccess(
        toTicketAccessUser(session.user),
        {
          id: task.plan.ticket.id,
          clientId: task.plan.ticket.clientId,
          assigneeId: task.plan.ticket.assigneeId,
          familyId: task.plan.ticket.familyId,
        },
        'resolution_plan'
      )
    } catch (err) {
      if (err instanceof TicketAccessError) {
        return NextResponse.json(
          { success: false, message: err.message },
          { status: err.statusCode }
        )
      }
      throw err
    }

    const wasCompleted = task.status === 'completed'

    // Eliminar tarea
    await prisma.resolution_tasks.delete({
      where: { id: taskId },
    })

    // Actualizar contadores en el plan
    await prisma.resolution_plans.update({
      where: { id: task.planId },
      data: {
        totalTasks: { decrement: 1 },
        completedTasks: wasCompleted ? { decrement: 1 } : undefined,
        updatedAt: new Date(),
      },
    })

    // Auditoría
    await auditTaskChange(taskId, task.planId, session.user.id, 'deleted', {
      title: task.title,
      status: task.status,
    })

    notifyTicketChanged(ticketId, 'plan_task_deleted')

    return NextResponse.json({
      success: true,
      message: 'Tarea eliminada exitosamente',
    })
  } catch (error) {
    console.error('[API] Error in resolution task DELETE:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al eliminar la tarea',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
