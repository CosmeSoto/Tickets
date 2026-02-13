import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { auditTaskChange } from '@/lib/audit'

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
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id: ticketId, taskId } = await params
    const body = await request.json()

    // Buscar tarea
    const task = await prisma.resolution_tasks.findUnique({
      where: { id: taskId },
      include: {
        plan: {
          include: {
            ticket: true
          }
        }
      }
    })

    if (!task) {
      return NextResponse.json(
        { success: false, message: 'Tarea no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que la tarea pertenece al ticket correcto
    if (task.plan.ticketId !== ticketId) {
      return NextResponse.json(
        { success: false, message: 'Tarea no pertenece a este ticket' },
        { status: 400 }
      )
    }

    // Verificar permisos
    const isAdmin = session.user.role === 'ADMIN'
    const isAssignedTechnician = 
      session.user.role === 'TECHNICIAN' && 
      task.plan.ticket.assigneeId === session.user.id

    if (!isAdmin && !isAssignedTechnician) {
      return NextResponse.json(
        { success: false, message: 'No tienes permiso para actualizar esta tarea' },
        { status: 403 }
      )
    }

    // Preparar datos de actualización
    const updateData: any = {
      updatedAt: new Date()
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

    if (body.actualHours !== undefined) {
      updateData.actualHours = body.actualHours
      changes.actualHours = { old: task.actualHours, new: body.actualHours }
    }

    if (body.assignedTo !== undefined) {
      updateData.assignedTo = body.assignedTo
      changes.assignedTo = { old: task.assignedTo, new: body.assignedTo }
    }

    if (body.dueDate !== undefined) {
      updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null
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
            email: true
          }
        }
      }
    })

    // Si cambió el estado de completitud, actualizar contador en el plan
    if (body.status !== undefined && body.status !== oldStatus) {
      const allTasks = await prisma.resolution_tasks.findMany({
        where: { planId: task.planId }
      })

      const completedCount = allTasks.filter(t => 
        t.id === taskId ? body.status === 'completed' : t.status === 'completed'
      ).length

      await prisma.resolution_plans.update({
        where: { id: task.planId },
        data: {
          completedTasks: completedCount,
          updatedAt: new Date()
        }
      })
    }

    // Auditoría
    if (Object.keys(changes).length > 0) {
      await auditTaskChange(
        taskId,
        task.planId,
        session.user.id,
        'updated',
        changes
      )
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
        assignedTo: updatedTask.assignee,
        dueDate: updatedTask.dueDate?.toISOString() || null,
        completedAt: updatedTask.completedAt?.toISOString() || null,
        notes: updatedTask.notes,
        createdAt: updatedTask.createdAt.toISOString(),
        updatedAt: updatedTask.updatedAt.toISOString()
      },
      message: 'Tarea actualizada exitosamente'
    })
  } catch (error) {
    console.error('[API] Error in resolution task PATCH:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar la tarea',
        error: error instanceof Error ? error.message : 'Error desconocido'
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
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id: ticketId, taskId } = await params

    // Buscar tarea
    const task = await prisma.resolution_tasks.findUnique({
      where: { id: taskId },
      include: {
        plan: {
          include: {
            ticket: true
          }
        }
      }
    })

    if (!task) {
      return NextResponse.json(
        { success: false, message: 'Tarea no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que la tarea pertenece al ticket correcto
    if (task.plan.ticketId !== ticketId) {
      return NextResponse.json(
        { success: false, message: 'Tarea no pertenece a este ticket' },
        { status: 400 }
      )
    }

    // Verificar permisos
    const isAdmin = session.user.role === 'ADMIN'
    const isAssignedTechnician = 
      session.user.role === 'TECHNICIAN' && 
      task.plan.ticket.assigneeId === session.user.id

    if (!isAdmin && !isAssignedTechnician) {
      return NextResponse.json(
        { success: false, message: 'No tienes permiso para eliminar esta tarea' },
        { status: 403 }
      )
    }

    const wasCompleted = task.status === 'completed'

    // Eliminar tarea
    await prisma.resolution_tasks.delete({
      where: { id: taskId }
    })

    // Actualizar contadores en el plan
    await prisma.resolution_plans.update({
      where: { id: task.planId },
      data: {
        totalTasks: { decrement: 1 },
        completedTasks: wasCompleted ? { decrement: 1 } : undefined,
        updatedAt: new Date()
      }
    })

    // Auditoría
    await auditTaskChange(
      taskId,
      task.planId,
      session.user.id,
      'deleted',
      {
        title: task.title,
        status: task.status
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Tarea eliminada exitosamente'
    })
  } catch (error) {
    console.error('[API] Error in resolution task DELETE:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al eliminar la tarea',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
