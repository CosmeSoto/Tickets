import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { auditTaskChange } from '@/lib/audit'
import { calculateDuration, validateTimeRange, combineDateAndTime } from '@/lib/time-utils'
import { NotificationService } from '@/lib/services/notification-service'

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
      
      // Si hay fecha y hora de inicio, combinarlas en dueDate
      if (body.dueDate && newStartTime) {
        updateData.dueDate = combineDateAndTime(body.dueDate, newStartTime)
      } else if (task.dueDate && newStartTime && body.startTime !== undefined) {
        // Si solo cambió la hora, actualizar dueDate manteniendo la fecha
        const currentDate = task.dueDate.toISOString().split('T')[0]
        updateData.dueDate = combineDateAndTime(currentDate, newStartTime)
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

      const totalTasks = allTasks.length
      const planUpdateData: any = {
        completedTasks: completedCount,
        updatedAt: new Date()
      }

      // Si todas las tareas están completadas y el plan está activo, marcarlo como completado
      if (completedCount === totalTasks && totalTasks > 0 && task.plan.status === 'active') {
        planUpdateData.status = 'completed'
        planUpdateData.completedDate = new Date()

        // Registrar en el historial del ticket
        await prisma.ticket_history.create({
          data: {
            id: require('crypto').randomUUID(),
            ticketId: task.plan.ticketId,
            userId: session.user.id,
            action: 'resolution_plan_completed',
            field: 'resolution_plan',
            oldValue: 'active',
            newValue: 'completed',
            description: `Plan de resolución completado: "${task.plan.title}". Todas las tareas (${totalTasks}) han sido finalizadas exitosamente.`,
            createdAt: new Date()
          }
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
        data: planUpdateData
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
        startTime: updatedTask.startTime,
        endTime: updatedTask.endTime,
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
