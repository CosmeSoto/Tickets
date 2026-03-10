import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { auditResolutionPlanChange } from '@/lib/audit'
import { EmailService } from '@/lib/services/email/email-service'
import { randomUUID } from 'crypto'

/**
 * GET /api/tickets/[id]/resolution-plan
 * Obtiene el plan de resolución de un ticket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session
  let ticketId
  
  try {
    session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const resolvedParams = await params
    ticketId = resolvedParams.id

    // Verificar que el ticket existe
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        assigneeId: true,
        clientId: true
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos: Admin o Técnico asignado
    const isAdmin = session.user.role === 'ADMIN'
    const isAssignedTechnician = 
      session.user.role === 'TECHNICIAN' && 
      ticket.assigneeId === session.user.id

    if (!isAdmin && !isAssignedTechnician) {
      return NextResponse.json(
        { success: false, message: 'No tienes permiso para ver este plan' },
        { status: 403 }
      )
    }

    // Buscar plan de resolución
    const plan = await prisma.resolution_plans.findFirst({
      where: { ticketId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        tasks: {
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    if (!plan) {
      // No hay plan, retornar null (esto es válido, no es un error)
      return NextResponse.json({
        success: true,
        data: null
      })
    }

    // Calcular progreso
    const totalTasks = plan.tasks.length
    const completedTasks = plan.tasks.filter(t => t.status === 'completed').length
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    // Formatear respuesta
    const response = {
      id: plan.id,
      ticketId: plan.ticketId,
      title: plan.title,
      description: plan.description,
      status: plan.status,
      totalTasks: plan.totalTasks,
      completedTasks: plan.completedTasks,
      estimatedHours: plan.estimatedHours,
      actualHours: plan.actualHours,
      startDate: plan.startDate?.toISOString() || null,
      targetDate: plan.targetDate?.toISOString() || null,
      completedDate: plan.completedDate?.toISOString() || null,
      createdBy: plan.creator,
      tasks: plan.tasks.map(task => ({
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
      })),
      progress: {
        totalTasks,
        completedTasks,
        percentage,
        estimatedCompletion: plan.targetDate?.toISOString() || null
      },
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString()
    }

    return NextResponse.json({
      success: true,
      data: response
    })
  } catch (error) {
    console.error('[API] Error in resolution plan GET:', error)
    console.error('[API] Error details:', {
      ticketId: ticketId || 'unknown',
      userId: session?.user?.id || 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar el plan de resolución',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tickets/[id]/resolution-plan
 * Crea un nuevo plan de resolución
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
        { success: false, message: 'El título del plan es requerido' },
        { status: 400 }
      )
    }

    // Verificar que el ticket existe
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId }
    })

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos
    const isAdmin = session.user.role === 'ADMIN'
    const isAssignedTechnician = 
      session.user.role === 'TECHNICIAN' && 
      ticket.assigneeId === session.user.id

    if (!isAdmin && !isAssignedTechnician) {
      return NextResponse.json(
        { success: false, message: 'No tienes permiso para crear un plan' },
        { status: 403 }
      )
    }

    // Verificar que no exista ya un plan
    const existingPlan = await prisma.resolution_plans.findFirst({
      where: { ticketId }
    })

    if (existingPlan) {
      return NextResponse.json(
        { success: false, message: 'Ya existe un plan de resolución para este ticket' },
        { status: 400 }
      )
    }

    // Crear plan
    const plan = await prisma.resolution_plans.create({
      data: {
        id: randomUUID(),
        ticketId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        status: 'draft',
        totalTasks: 0,
        completedTasks: 0,
        estimatedHours: body.estimatedHours || 0,
        actualHours: 0,
        startDate: body.startDate ? new Date(body.startDate) : null,
        targetDate: body.targetDate ? new Date(body.targetDate) : null,
        createdBy: session.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Auditoría
    await auditResolutionPlanChange(
      plan.id,
      ticketId,
      session.user.id,
      'created',
      {
        title: plan.title,
        status: plan.status
      }
    )

    // Crear entrada en el historial del ticket
    try {
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          ticketId,
          userId: session.user.id,
          action: 'resolution_plan_created',
          field: 'resolution_plan',
          oldValue: null,
          newValue: plan.title,
          description: `Plan de resolución creado: "${plan.title}"${plan.startDate ? `. Inicio: ${new Date(plan.startDate).toLocaleDateString('es-ES')}` : ''}${plan.targetDate ? `. Objetivo: ${new Date(plan.targetDate).toLocaleDateString('es-ES')}` : ''}`,
          createdAt: new Date()
        }
      })
    } catch (historyError) {
      console.error('[API] Error creating ticket history:', historyError)
    }

    // Obtener información del cliente para notificaciones y email
    const client = await prisma.users.findUnique({
      where: { id: ticket.clientId },
      select: {
        id: true,
        name: true,
        email: true
      }
    })

    // Crear notificación para el cliente
    try {
      const formattedStartDate = plan.startDate 
        ? new Date(plan.startDate).toLocaleString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : null

      const formattedTargetDate = plan.targetDate
        ? new Date(plan.targetDate).toLocaleString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : null

      let message = `Se ha creado un plan de resolución para tu ticket: "${plan.title}".`
      if (formattedStartDate) {
        message += ` Inicio programado: ${formattedStartDate}.`
      }
      if (formattedTargetDate) {
        message += ` Fecha objetivo: ${formattedTargetDate}.`
      }

      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          userId: ticket.clientId,
          type: 'RESOLUTION_PLAN_CREATED',
          title: 'Plan de resolución creado',
          message,
          ticketId,
          isRead: false,
          metadata: {
            planId: plan.id,
            planTitle: plan.title,
            startDate: plan.startDate?.toISOString() || null,
            targetDate: plan.targetDate?.toISOString() || null,
            actionUrl: `/client/tickets/${ticketId}`,
            actionText: 'Ver ticket'
          },
          createdAt: new Date()
        }
      })
      
      console.log(`[API] Notification created for client ${ticket.clientId} about resolution plan ${plan.id}`)
    } catch (notificationError) {
      // No fallar si la notificación falla, solo registrar el error
      console.error('[API] Error creating notification for resolution plan:', notificationError)
    }

    // Enviar email al cliente
    if (client) {
      try {
        const formattedStartDate = plan.startDate 
          ? new Date(plan.startDate).toLocaleString('es-ES', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : null

        const formattedTargetDate = plan.targetDate
          ? new Date(plan.targetDate).toLocaleString('es-ES', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : null

        let emailBody = `
          <h2>Plan de Resolución Creado</h2>
          <p>Hola ${client.name},</p>
          <p>Se ha creado un plan de resolución para tu ticket <strong>#${ticketId.substring(0, 8)}</strong>.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">${plan.title}</h3>
            ${plan.description ? `<p style="color: #4b5563;">${plan.description}</p>` : ''}
            
            ${formattedStartDate ? `
              <p style="margin: 10px 0;">
                <strong>📅 Inicio programado:</strong><br/>
                ${formattedStartDate}
              </p>
            ` : ''}
            
            ${formattedTargetDate ? `
              <p style="margin: 10px 0;">
                <strong>🎯 Fecha objetivo:</strong><br/>
                ${formattedTargetDate}
              </p>
            ` : ''}
            
            ${plan.estimatedHours ? `
              <p style="margin: 10px 0;">
                <strong>⏱️ Horas estimadas:</strong> ${plan.estimatedHours} horas
              </p>
            ` : ''}
          </div>
          
          <p>Nuestro equipo técnico trabajará en resolver tu solicitud siguiendo este plan estructurado.</p>
          <p>Recibirás actualizaciones conforme avancemos en las tareas programadas.</p>
          
          <div style="margin-top: 30px;">
            <a href="${process.env.NEXTAUTH_URL}/client/tickets/${ticketId}" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ver Ticket y Plan de Resolución
            </a>
          </div>
          
          <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
            Si tienes alguna pregunta, puedes responder a este correo o agregar un comentario en el ticket.
          </p>
        `

        await EmailService.queueEmail({
          to: client.email,
          subject: `Plan de Resolución Creado - Ticket #${ticketId.substring(0, 8)}`,
          html: emailBody,
          text: `Plan de Resolución Creado\n\nHola ${client.name},\n\nSe ha creado un plan de resolución para tu ticket #${ticketId.substring(0, 8)}.\n\nTítulo: ${plan.title}\n${plan.description ? `Descripción: ${plan.description}\n` : ''}${formattedStartDate ? `Inicio: ${formattedStartDate}\n` : ''}${formattedTargetDate ? `Objetivo: ${formattedTargetDate}\n` : ''}${plan.estimatedHours ? `Horas estimadas: ${plan.estimatedHours}\n` : ''}\n\nVer ticket: ${process.env.NEXTAUTH_URL}/client/tickets/${ticketId}`
        }, session.user.id)

        console.log(`[API] Email queued for client ${client.email} about resolution plan ${plan.id}`)
      } catch (emailError) {
        // No fallar si el email falla, solo registrar el error
        console.error('[API] Error sending email for resolution plan:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: plan.id,
        ticketId: plan.ticketId,
        title: plan.title,
        description: plan.description,
        status: plan.status,
        totalTasks: plan.totalTasks,
        completedTasks: plan.completedTasks,
        estimatedHours: plan.estimatedHours,
        actualHours: plan.actualHours,
        startDate: plan.startDate?.toISOString() || null,
        targetDate: plan.targetDate?.toISOString() || null,
        createdBy: plan.creator,
        tasks: [],
        progress: {
          totalTasks: 0,
          completedTasks: 0,
          percentage: 0,
          estimatedCompletion: plan.targetDate?.toISOString() || null
        },
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString()
      },
      message: 'Plan de resolución creado exitosamente'
    })
  } catch (error) {
    console.error('[API] Error in resolution plan POST:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear el plan de resolución',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/tickets/[id]/resolution-plan
 * Elimina un plan de resolución y todas sus tareas
 */
export async function DELETE(
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

    // Buscar plan existente
    const existingPlan = await prisma.resolution_plans.findFirst({
      where: { ticketId },
      include: {
        ticket: true,
        tasks: true
      }
    })

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, message: 'Plan de resolución no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos
    const isAdmin = session.user.role === 'ADMIN'
    const isAssignedTechnician = 
      session.user.role === 'TECHNICIAN' && 
      existingPlan.ticket.assigneeId === session.user.id

    if (!isAdmin && !isAssignedTechnician) {
      return NextResponse.json(
        { success: false, message: 'No tienes permiso para eliminar este plan' },
        { status: 403 }
      )
    }

    // Eliminar todas las tareas primero
    await prisma.resolution_tasks.deleteMany({
      where: { planId: existingPlan.id }
    })

    // Eliminar el plan
    await prisma.resolution_plans.delete({
      where: { id: existingPlan.id }
    })

    // Auditoría
    await auditResolutionPlanChange(
      existingPlan.id,
      ticketId,
      session.user.id,
      'deleted',
      {
        title: existingPlan.title,
        tasksDeleted: existingPlan.tasks.length
      }
    )

    // Crear entrada en el historial del ticket
    try {
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          ticketId,
          userId: session.user.id,
          action: 'resolution_plan_deleted',
          field: 'resolution_plan',
          oldValue: existingPlan.title,
          newValue: null,
          description: `Plan de resolución eliminado: "${existingPlan.title}" (${existingPlan.tasks.length} tareas)`,
          createdAt: new Date()
        }
      })
    } catch (historyError) {
      console.error('[API] Error creating ticket history:', historyError)
    }

    return NextResponse.json({
      success: true,
      message: 'Plan de resolución eliminado exitosamente'
    })
  } catch (error) {
    console.error('[API] Error in resolution plan DELETE:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al eliminar el plan de resolución',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/tickets/[id]/resolution-plan
 * Actualiza un plan de resolución existente
 */
export async function PATCH(
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

    // Buscar plan existente
    const existingPlan = await prisma.resolution_plans.findFirst({
      where: { ticketId },
      include: {
        ticket: true
      }
    })

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, message: 'Plan de resolución no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos
    const isAdmin = session.user.role === 'ADMIN'
    const isAssignedTechnician = 
      session.user.role === 'TECHNICIAN' && 
      existingPlan.ticket.assigneeId === session.user.id

    if (!isAdmin && !isAssignedTechnician) {
      return NextResponse.json(
        { success: false, message: 'No tienes permiso para actualizar este plan' },
        { status: 403 }
      )
    }

    // Preparar datos de actualización
    const updateData: any = {
      updatedAt: new Date()
    }

    const changes: Record<string, any> = {}

    if (body.title !== undefined && body.title.trim()) {
      updateData.title = body.title.trim()
      changes.title = { old: existingPlan.title, new: body.title.trim() }
    }

    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null
      changes.description = { old: existingPlan.description, new: body.description }
    }

    if (body.status !== undefined) {
      updateData.status = body.status
      changes.status = { old: existingPlan.status, new: body.status }
      
      // Si se marca como completado, registrar en historial y notificar
      if (body.status === 'completed' && existingPlan.status !== 'completed') {
        // Registrar en el historial del ticket
        await prisma.ticket_history.create({
          data: {
            id: randomUUID(),
            ticketId,
            userId: session.user.id,
            action: 'resolution_plan_completed',
            field: 'resolution_plan',
            oldValue: existingPlan.status,
            newValue: 'completed',
            description: `Plan de resolución completado: "${existingPlan.title}". ${existingPlan.completedTasks} de ${existingPlan.totalTasks} tareas finalizadas.`,
            createdAt: new Date()
          }
        })

        // Crear notificación para el cliente
        await prisma.notifications.create({
          data: {
            id: randomUUID(),
            userId: existingPlan.ticket.clientId,
            type: 'RESOLUTION_PLAN_COMPLETED',
            title: 'Plan de resolución completado',
            message: `El plan de resolución "${existingPlan.title}" ha sido completado. ${existingPlan.completedTasks} de ${existingPlan.totalTasks} tareas fueron finalizadas.`,
            ticketId,
            isRead: false,
            metadata: {
              planId: existingPlan.id,
              planTitle: existingPlan.title,
              totalTasks: existingPlan.totalTasks,
              completedTasks: existingPlan.completedTasks,
              actionUrl: `/client/tickets/${ticketId}`,
              actionText: 'Ver ticket'
            },
            createdAt: new Date()
          }
        })
      }
    }

    if (body.estimatedHours !== undefined) {
      updateData.estimatedHours = body.estimatedHours
      changes.estimatedHours = { old: existingPlan.estimatedHours, new: body.estimatedHours }
    }

    if (body.actualHours !== undefined) {
      updateData.actualHours = body.actualHours
      changes.actualHours = { old: existingPlan.actualHours, new: body.actualHours }
    }

    if (body.startDate !== undefined) {
      updateData.startDate = body.startDate ? new Date(body.startDate) : null
    }

    if (body.targetDate !== undefined) {
      updateData.targetDate = body.targetDate ? new Date(body.targetDate) : null
    }

    if (body.completedDate !== undefined) {
      updateData.completedDate = body.completedDate ? new Date(body.completedDate) : null
    }

    // Actualizar plan
    const updatedPlan = await prisma.resolution_plans.update({
      where: { id: existingPlan.id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        tasks: {
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    // Auditoría
    if (Object.keys(changes).length > 0) {
      await auditResolutionPlanChange(
        updatedPlan.id,
        ticketId,
        session.user.id,
        'updated',
        changes
      )
    }

    // Calcular progreso
    const totalTasks = updatedPlan.tasks.length
    const completedTasks = updatedPlan.tasks.filter(t => t.status === 'completed').length
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    return NextResponse.json({
      success: true,
      data: {
        id: updatedPlan.id,
        ticketId: updatedPlan.ticketId,
        title: updatedPlan.title,
        description: updatedPlan.description,
        status: updatedPlan.status,
        totalTasks: updatedPlan.totalTasks,
        completedTasks: updatedPlan.completedTasks,
        estimatedHours: updatedPlan.estimatedHours,
        actualHours: updatedPlan.actualHours,
        startDate: updatedPlan.startDate?.toISOString() || null,
        targetDate: updatedPlan.targetDate?.toISOString() || null,
        completedDate: updatedPlan.completedDate?.toISOString() || null,
        createdBy: updatedPlan.creator,
        tasks: updatedPlan.tasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          estimatedHours: task.estimatedHours,
          actualHours: task.actualHours,
          assignedTo: task.assignee,
          dueDate: task.dueDate?.toISOString() || null,
          completedAt: task.completedAt?.toISOString() || null,
          notes: task.notes,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString()
        })),
        progress: {
          totalTasks,
          completedTasks,
          percentage,
          estimatedCompletion: updatedPlan.targetDate?.toISOString() || null
        },
        createdAt: updatedPlan.createdAt.toISOString(),
        updatedAt: updatedPlan.updatedAt.toISOString()
      },
      message: 'Plan de resolución actualizado exitosamente'
    })
  } catch (error) {
    console.error('[API] Error in resolution plan PATCH:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar el plan de resolución',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
