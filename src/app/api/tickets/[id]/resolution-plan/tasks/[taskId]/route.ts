import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { auditTaskChange } from '@/lib/audit'
import { PlannerSyncService } from '@/lib/services/planner-sync-service'
import {
  applyResolutionTaskUpdate,
  ResolutionTaskValidationError,
} from '@/lib/services/resolution-task-service'
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
        'resolution_plan_tasks'
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

    let updatedTask
    try {
      updatedTask = await applyResolutionTaskUpdate({
        task,
        ticketId,
        body,
        actorUserId: session.user.id,
      })
    } catch (err) {
      if (err instanceof ResolutionTaskValidationError) {
        return NextResponse.json({ success: false, message: err.message }, { status: 400 })
      }
      throw err
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
        'resolution_plan_tasks'
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

    // Elimina también la tarea vinculada en Microsoft Planner, si existe — evita
    // dejar una tarea fantasma en Planner cuando se borra del lado de la app.
    void PlannerSyncService.removeTask(taskId, session.user.id)

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
