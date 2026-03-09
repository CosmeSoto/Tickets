import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { auditTaskChange } from '@/lib/audit'
import { randomUUID } from 'crypto'
import { calculateDuration, validateTimeRange, combineDateAndTime, formatDuration } from '@/lib/time-utils'

/**
 * POST /api/tickets/[id]/resolution-plan/tasks
 * Crea una nueva tarea en el plan de resolución
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id: ticketId } = await params
    const body = await request.json()

    // Validaciones
    if (!body.title?.trim()) {
      return NextResponse.json(
        { success: false, message: 'El título de la tarea es requerido' },
        { status: 400 }
      )
    }

    // Validar horarios si se proporcionan
    if (body.startTime && body.endTime) {
      if (!validateTimeRange(body.startTime, body.endTime)) {
        return NextResponse.json(
          { success: false, message: 'La hora de fin debe ser posterior a la hora de inicio' },
          { status: 400 }
        )
      }
    }

    // Buscar plan de resolución
    const plan = await prisma.resolution_plans.findFirst({
      where: { ticketId },
      include: {
        ticket: true
      }
    })

    if (!plan) {
      return NextResponse.json(
        { success: false, message: 'Plan de resolución no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos
    const isAdmin = session.user.role === 'ADMIN'
    const isAssignedTechnician = 
      session.user.role === 'TECHNICIAN' && 
      plan.ticket.assigneeId === session.user.id

    if (!isAdmin && !isAssignedTechnician) {
      return NextResponse.json(
        { success: false, message: 'No tienes permiso para agregar tareas' },
        { status: 403 }
      )
    }

    // Calcular duración si hay horarios
    let estimatedHours = body.estimatedHours || null
    let dueDate = body.dueDate ? new Date(body.dueDate) : null
    
    if (body.startTime && body.endTime) {
      // Calcular duración automáticamente
      estimatedHours = calculateDuration(body.startTime, body.endTime)
      
      // Combinar fecha y hora de inicio para dueDate
      if (body.dueDate) {
        dueDate = combineDateAndTime(body.dueDate, body.startTime)
      }
    }

    // Crear tarea
    const task = await prisma.resolution_tasks.create({
      data: {
        id: randomUUID(),
        planId: plan.id,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        status: 'pending',
        priority: body.priority || 'medium',
        estimatedHours,
        actualHours: null,
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        assignedTo: body.assignedTo || null,
        dueDate,
        notes: body.notes?.trim() || null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
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

    // Actualizar contador de tareas en el plan
    await prisma.resolution_plans.update({
      where: { id: plan.id },
      data: {
        totalTasks: { increment: 1 },
        updatedAt: new Date()
      }
    })

    // Auditoría
    await auditTaskChange(
      task.id,
      plan.id,
      session.user.id,
      'created',
      {
        title: task.title,
        priority: task.priority,
        assignedTo: task.assignedTo,
        startTime: task.startTime,
        endTime: task.endTime,
        estimatedHours: task.estimatedHours
      }
    )

    // Crear notificación para el cliente si la tarea tiene fecha programada
    if (task.dueDate) {
      try {
        const startDate = new Date(task.dueDate)
        const formattedDate = startDate.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
        
        // Construir mensaje de horario
        let timeInfo = ''
        if (task.startTime && task.endTime && task.estimatedHours) {
          const duration = formatDuration(task.estimatedHours)
          timeInfo = `Horario: ${task.startTime} a ${task.endTime} (${duration})`
        } else if (task.estimatedHours) {
          timeInfo = `Duración estimada: ${formatDuration(task.estimatedHours)}`
        }

        await prisma.notifications.create({
          data: {
            id: randomUUID(),
            userId: plan.ticket.clientId,
            type: 'TASK_SCHEDULED',
            title: 'Nueva tarea programada',
            message: `Se ha programado una nueva tarea para tu ticket: "${task.title}". Fecha: ${formattedDate}. ${timeInfo}`,
            ticketId,
            isRead: false,
            metadata: {
              taskId: task.id,
              planId: plan.id,
              taskTitle: task.title,
              dueDate: task.dueDate.toISOString(),
              startTime: task.startTime,
              endTime: task.endTime,
              estimatedHours: task.estimatedHours,
              actionUrl: `/client/tickets/${ticketId}`,
              actionText: 'Ver ticket'
            },
            createdAt: new Date()
          }
        })
        
        console.log(`[API] Notification created for client ${plan.ticket.clientId} about task ${task.id}`)
      } catch (notificationError) {
        console.error('[API] Error creating notification for task:', notificationError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
        startTime: task.startTime,
        endTime: task.endTime,
        assignedTo: task.assignee,
        dueDate: task.dueDate?.toISOString() || null,
        completedAt: task.completedAt?.toISOString() || null,
        notes: task.notes,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString()
      },
      message: 'Tarea creada exitosamente'
    })
  } catch (error) {
    console.error('[API] Error in resolution task POST:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear la tarea',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
