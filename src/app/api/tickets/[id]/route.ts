import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { auditTicketChange } from '@/lib/audit'
import { WebhookService } from '@/lib/services/webhook-service'
import { SLAService } from '@/lib/services/sla-service'
import { EmailService } from '@/lib/services/email/email-service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { NotificationService } from '@/lib/services/notification-service'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const params = await context.params
    const ticketId = params?.id
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const idFromPath = pathSegments[pathSegments.length - 1]
    
    const finalId = ticketId || idFromPath

    if (!finalId) {
      return NextResponse.json(
        { success: false, message: 'ID de ticket requerido' },
        { status: 400 }
      )
    }

    // Obtener ticket con todas las relaciones
    const ticket = await prisma.tickets.findUnique({
      where: { id: finalId },
      include: {
        users_tickets_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
            departmentId: true,
            role: true
          }
        },
        users_tickets_assigneeIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
            departmentId: true,
            role: true
          }
        },
        categories: {
          select: {
            id: true,
            name: true,
            color: true,
            level: true
          }
        },
        comments: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        attachments: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        ticket_history: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        knowledge_article: {
          select: {
            id: true,
            title: true,
            isPublished: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            comments: true,
            attachments: true
          }
        }
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos
    if (session.user.role === 'CLIENT' && ticket.clientId !== session.user.id) {
      return NextResponse.json(
        { success: false, message: 'No tienes permisos para ver este ticket' },
        { status: 403 }
      )
    }

    // Transformar la respuesta para que sea compatible con el frontend
    const transformedTicket = {
      ...ticket,
      client: ticket.users_tickets_clientIdTousers,
      assignee: ticket.users_tickets_assigneeIdTousers,
      category: ticket.categories,
      history: ticket.ticket_history.map(h => ({
        ...h,
        user: h.users
      }))
    }

    return NextResponse.json({
      success: true,
      data: transformedTicket
    })
  } catch (error) {
    console.error('Error fetching ticket:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar el ticket',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const params = await context.params
    const ticketId = params?.id
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const idFromPath = pathSegments[pathSegments.length - 1]
    
    const finalId = ticketId || idFromPath
    const updates = await request.json()

    // Verificar que el ticket existe
    const existingTicket = await prisma.tickets.findUnique({
      where: { id: finalId }
    })

    if (!existingTicket) {
      return NextResponse.json(
        { success: false, message: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // CONTROL DE PERMISOS POR ROL
    if (session.user.role === 'CLIENT') {
      // Cliente solo puede editar sus propios tickets
      if (existingTicket.clientId !== session.user.id) {
        return NextResponse.json(
          { success: false, message: 'No tienes permisos para editar este ticket' },
          { status: 403 }
        )
      }

      // Cliente solo puede editar título y descripción, y SOLO si el ticket está en estado OPEN
      if (existingTicket.status !== 'OPEN') {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Solo puedes editar tickets que aún no han sido revisados o asignados. Para cambios adicionales, agrega un comentario.' 
          },
          { status: 403 }
        )
      }

      // Filtrar solo campos permitidos para clientes
      const allowedFields = ['title', 'description']
      const filteredUpdates: any = {}
      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field]
        }
      })

      // Si intenta modificar otros campos, rechazar
      const attemptedFields = Object.keys(updates)
      const unauthorizedFields = attemptedFields.filter(f => !allowedFields.includes(f))
      if (unauthorizedFields.length > 0) {
        return NextResponse.json(
          { 
            success: false, 
            message: `No tienes permisos para modificar: ${unauthorizedFields.join(', ')}` 
          },
          { status: 403 }
        )
      }

      // Actualizar solo campos permitidos
      const updatedTicket = await prisma.tickets.update({
        where: { id: finalId },
        data: {
          ...filteredUpdates,
          updatedAt: new Date()
        },
        include: {
          users_tickets_clientIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true,
              role: true
            }
          },
          users_tickets_assigneeIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true,
              role: true
            }
          },
          categories: {
            select: {
              id: true,
              name: true,
              color: true,
              level: true
            }
          },
          _count: {
            select: {
              comments: true,
              attachments: true
            }
          }
        }
      })

      // Crear entrada en el historial
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'updated',
          comment: `Cliente actualizó: ${Object.keys(filteredUpdates).join(', ')}`,
          ticketId: finalId,
          userId: session.user.id,
          createdAt: new Date()
        }
      })

      // Auditoría de cambios
      if (filteredUpdates.title && filteredUpdates.title !== existingTicket.title) {
        await auditTicketChange(
          finalId,
          session.user.id,
          'title_updated',
          {
            oldValue: existingTicket.title,
            newValue: filteredUpdates.title
          }
        )
      }

      if (filteredUpdates.description && filteredUpdates.description !== existingTicket.description) {
        await auditTicketChange(
          finalId,
          session.user.id,
          'description_updated',
          {
            oldValue: existingTicket.description,
            newValue: filteredUpdates.description
          }
        )
      }

      // ⭐ AUDITORÍA: Registrar actualización de ticket por cliente
      await AuditServiceComplete.log({
        action: AuditActionsComplete.TICKET_UPDATED,
        entityType: 'ticket',
        entityId: finalId,
        userId: session.user.id,
        details: {
          ticketTitle: updatedTicket.title,
          updatedBy: 'Cliente',
          fieldsUpdated: Object.keys(filteredUpdates)
        },
        oldValues: {
          title: existingTicket.title,
          description: existingTicket.description
        },
        newValues: filteredUpdates,
        request: request
      })

      // ⭐ NUEVO: Disparar webhook de ticket actualizado
      await WebhookService.trigger(WebhookService.EVENTS.TICKET_UPDATED, {
        ticketId: finalId,
        updatedBy: session.user.name,
        changes: Object.keys(filteredUpdates),
        ticket: {
          id: updatedTicket.id,
          title: updatedTicket.title,
          status: updatedTicket.status,
          priority: updatedTicket.priority
        }
      }).catch(err => {
        console.error('[WEBHOOK] Error disparando evento TICKET_UPDATED:', err)
      })

      const transformedTicket = {
        ...updatedTicket,
        client: updatedTicket.users_tickets_clientIdTousers,
        assignee: updatedTicket.users_tickets_assigneeIdTousers,
        category: updatedTicket.categories
      }

      return NextResponse.json({
        success: true,
        data: transformedTicket,
        message: 'Ticket actualizado exitosamente'
      })

    } else if (session.user.role === 'TECHNICIAN') {
      // Técnico NO puede editar título ni descripción (preserva solicitud original)
      // Técnico puede cambiar: status, priority, assigneeId
      const allowedFields = ['status', 'priority', 'assigneeId']
      const filteredUpdates: any = {}
      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field]
        }
      })

      // Bloquear transición directa a CLOSED para técnicos.
      // El cierre ocurre automáticamente cuando el cliente califica.
      if (filteredUpdates.status === 'CLOSED') {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Los técnicos no pueden cerrar tickets directamente. El ticket se cierra automáticamente cuando el cliente envía su calificación.' 
          },
          { status: 403 }
        )
      }

      // Procesar assigneeId: convertir undefined a null para desasignar
      if ('assigneeId' in filteredUpdates && filteredUpdates.assigneeId === undefined) {
        filteredUpdates.assigneeId = null
      }

      // Si intenta modificar título o descripción, rechazar
      if (updates.title || updates.description) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Los técnicos no pueden modificar el título o descripción del ticket. Esto preserva la solicitud original del cliente para auditoría.' 
          },
          { status: 403 }
        )
      }

      const updatedTicket = await prisma.tickets.update({
        where: { id: finalId },
        data: {
          ...filteredUpdates,
          updatedAt: new Date()
        },
        include: {
          users_tickets_clientIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true,
              role: true
            }
          },
          users_tickets_assigneeIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true,
              role: true
            }
          },
          categories: {
            select: {
              id: true,
              name: true,
              color: true,
              level: true
            }
          },
          _count: {
            select: {
              comments: true,
              attachments: true
            }
          }
        }
      })

      // Crear entrada en el historial
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'updated',
          comment: `Técnico actualizó: ${Object.keys(filteredUpdates).join(', ')}`,
          ticketId: finalId,
          userId: session.user.id,
          createdAt: new Date()
        }
      })

      // Auditoría de cambios
      if (filteredUpdates.status && filteredUpdates.status !== existingTicket.status) {
        await auditTicketChange(
          finalId,
          session.user.id,
          'status_changed',
          {
            oldValue: existingTicket.status,
            newValue: filteredUpdates.status
          }
        )

        // ⭐ AUDITORÍA: Registrar cambio de estado
        await AuditServiceComplete.log({
          action: AuditActionsComplete.TICKET_STATUS_CHANGED,
          entityType: 'ticket',
          entityId: finalId,
          userId: session.user.id,
          details: {
            ticketTitle: updatedTicket.title,
            technicianName: session.user.name
          },
          oldValues: { status: existingTicket.status },
          newValues: { status: filteredUpdates.status },
          request: request
        })

        // ⭐ NUEVO: Registrar resolución en SLA si el estado cambió a RESOLVED
        if (filteredUpdates.status === 'RESOLVED') {
          await SLAService.recordResolution(finalId).catch(err => {
            console.error('[SLA] Error registrando resolución:', err)
          })

          // ⭐ AUDITORÍA: Registrar resolución de ticket
          await AuditServiceComplete.log({
            action: AuditActionsComplete.TICKET_RESOLVED,
            entityType: 'ticket',
            entityId: finalId,
            userId: session.user.id,
            details: {
              ticketTitle: updatedTicket.title,
              resolvedBy: session.user.name,
              clientName: updatedTicket.users_tickets_clientIdTousers?.name
            },
            request: request
          })

          // Disparar webhook de ticket resuelto
          await WebhookService.trigger(WebhookService.EVENTS.TICKET_RESOLVED, {
            ticketId: finalId,
            resolvedBy: session.user.name,
            ticket: {
              id: updatedTicket.id,
              title: updatedTicket.title,
              client: updatedTicket.users_tickets_clientIdTousers?.name,
              resolvedAt: new Date()
            }
          }).catch(err => {
            console.error('[WEBHOOK] Error disparando evento TICKET_RESOLVED:', err)
          })

          // Enviar email al cliente
          if (updatedTicket.users_tickets_clientIdTousers) {
            await EmailService.queueEmail({
              to: updatedTicket.users_tickets_clientIdTousers.email,
              subject: `Ticket #${finalId.substring(0, 8)} resuelto`,
              template: 'ticket-resolved',
              templateData: {
                ticketId: finalId,
                title: updatedTicket.title,
                clientName: updatedTicket.users_tickets_clientIdTousers.name,
                technicianName: session.user.name
              }
            }, session.user.id).catch(err => {
              console.error('[EMAIL] Error enviando email de ticket resuelto:', err)
            })

            // ⭐ NUEVO: Enviar notificación in-app al cliente
            await NotificationService.notifyTicketResolved(finalId).catch(err => {
              console.error('[NOTIFICATION] Error enviando notificación de ticket resuelto:', err)
            })
          }

          // ⭐ NUEVO: Notificar al administrador que el ticket fue resuelto
          const { triggerTicketResolvedToAdminEmail } = await import('@/lib/email-triggers')
          triggerTicketResolvedToAdminEmail(finalId)
        }

        // ⭐ NUEVO: Disparar webhook de ticket cerrado
        if (filteredUpdates.status === 'CLOSED') {
          // ⭐ AUDITORÍA: Registrar cierre de ticket
          await AuditServiceComplete.log({
            action: AuditActionsComplete.TICKET_CLOSED,
            entityType: 'ticket',
            entityId: finalId,
            userId: session.user.id,
            details: {
              ticketTitle: updatedTicket.title,
              closedBy: session.user.name
            },
            request: request
          })

          await WebhookService.trigger(WebhookService.EVENTS.TICKET_CLOSED, {
            ticketId: finalId,
            closedBy: session.user.name,
            ticket: {
              id: updatedTicket.id,
              title: updatedTicket.title,
              closedAt: new Date()
            }
          }).catch(err => {
            console.error('[WEBHOOK] Error disparando evento TICKET_CLOSED:', err)
          })
        }

        // ⭐ NUEVO: Disparar webhook de ticket reabierto
        if (existingTicket.status === 'CLOSED' && filteredUpdates.status === 'OPEN') {
          await WebhookService.trigger(WebhookService.EVENTS.TICKET_REOPENED, {
            ticketId: finalId,
            reopenedBy: session.user.name,
            ticket: {
              id: updatedTicket.id,
              title: updatedTicket.title
            }
          }).catch(err => {
            console.error('[WEBHOOK] Error disparando evento TICKET_REOPENED:', err)
          })
        }
      }

      if (filteredUpdates.priority && filteredUpdates.priority !== existingTicket.priority) {
        await auditTicketChange(
          finalId,
          session.user.id,
          'priority_changed',
          {
            oldValue: existingTicket.priority,
            newValue: filteredUpdates.priority
          }
        )

        // ⭐ AUDITORÍA: Registrar cambio de prioridad
        await AuditServiceComplete.log({
          action: AuditActionsComplete.TICKET_PRIORITY_CHANGED,
          entityType: 'ticket',
          entityId: finalId,
          userId: session.user.id,
          details: {
            ticketTitle: updatedTicket.title,
            technicianName: session.user.name
          },
          oldValues: { priority: existingTicket.priority },
          newValues: { priority: filteredUpdates.priority },
          request: request
        })
      }

      if (filteredUpdates.assigneeId && filteredUpdates.assigneeId !== existingTicket.assigneeId) {
        await auditTicketChange(
          finalId,
          session.user.id,
          'assigned',
          {
            oldValue: existingTicket.assigneeId,
            newValue: filteredUpdates.assigneeId
          }
        )

        // ⭐ AUDITORÍA: Registrar asignación de ticket
        await AuditServiceComplete.log({
          action: AuditActionsComplete.TICKET_ASSIGNED,
          entityType: 'ticket',
          entityId: finalId,
          userId: session.user.id,
          details: {
            ticketTitle: updatedTicket.title,
            assignedBy: session.user.name,
            assigneeName: updatedTicket.users_tickets_assigneeIdTousers?.name || 'Sin asignar',
            previousAssignee: existingTicket.assigneeId ? 'Técnico anterior' : 'Sin asignar'
          },
          oldValues: { assigneeId: existingTicket.assigneeId },
          newValues: { assigneeId: filteredUpdates.assigneeId },
          request: request
        })

        // ⭐ NUEVO: Disparar webhook de ticket asignado
        await WebhookService.trigger(WebhookService.EVENTS.TICKET_ASSIGNED, {
          ticketId: finalId,
          assignedBy: session.user.name,
          assignee: updatedTicket.users_tickets_assigneeIdTousers ? {
            id: updatedTicket.users_tickets_assigneeIdTousers.id,
            name: updatedTicket.users_tickets_assigneeIdTousers.name,
            email: updatedTicket.users_tickets_assigneeIdTousers.email
          } : null,
          ticket: {
            id: updatedTicket.id,
            title: updatedTicket.title,
            priority: updatedTicket.priority
          }
        }).catch(err => {
          console.error('[WEBHOOK] Error disparando evento TICKET_ASSIGNED:', err)
        })

        // Enviar email al técnico asignado
        if (updatedTicket.users_tickets_assigneeIdTousers) {
          await EmailService.queueEmail({
            to: updatedTicket.users_tickets_assigneeIdTousers.email,
            subject: `Ticket #${finalId.substring(0, 8)} asignado`,
            template: 'ticket-assigned',
            templateData: {
              ticketId: finalId,
              title: updatedTicket.title,
              technicianName: updatedTicket.users_tickets_assigneeIdTousers.name,
              priority: updatedTicket.priority,
              clientName: updatedTicket.users_tickets_clientIdTousers?.name || 'Cliente'
            }
          }, session.user.id).catch(err => {
            console.error('[EMAIL] Error enviando email de ticket asignado:', err)
          })
        }
      }

      // ⭐ NUEVO: Disparar webhook genérico de actualización
      await WebhookService.trigger(WebhookService.EVENTS.TICKET_UPDATED, {
        ticketId: finalId,
        updatedBy: session.user.name,
        changes: Object.keys(filteredUpdates),
        ticket: {
          id: updatedTicket.id,
          title: updatedTicket.title,
          status: updatedTicket.status,
          priority: updatedTicket.priority
        }
      }).catch(err => {
        console.error('[WEBHOOK] Error disparando evento TICKET_UPDATED:', err)
      })

      // ⭐ AUDITORÍA: Registrar actualización general de ticket por técnico
      await AuditServiceComplete.log({
        action: AuditActionsComplete.TICKET_UPDATED,
        entityType: 'ticket',
        entityId: finalId,
        userId: session.user.id,
        details: {
          ticketTitle: updatedTicket.title,
          updatedBy: 'Técnico',
          technicianName: session.user.name,
          fieldsUpdated: Object.keys(filteredUpdates)
        },
        oldValues: {
          status: existingTicket.status,
          priority: existingTicket.priority,
          assigneeId: existingTicket.assigneeId
        },
        newValues: filteredUpdates,
        request: request
      })

      const transformedTicket = {
        ...updatedTicket,
        client: updatedTicket.users_tickets_clientIdTousers,
        assignee: updatedTicket.users_tickets_assigneeIdTousers,
        category: updatedTicket.categories
      }

      return NextResponse.json({
        success: true,
        data: transformedTicket,
        message: 'Ticket actualizado exitosamente'
      })

    } else if (session.user.role === 'ADMIN') {
      // Admin puede actualizar todo (con registro en historial)
      
      // Procesar assigneeId: convertir undefined a null para desasignar
      const processedUpdates = { ...updates }
      if ('assigneeId' in processedUpdates && (processedUpdates.assigneeId === undefined || processedUpdates.assigneeId === '')) {
        processedUpdates.assigneeId = null
      }

      // Si se desasigna el técnico, volver el estado a OPEN automáticamente
      if ('assigneeId' in processedUpdates && processedUpdates.assigneeId === null && existingTicket.assigneeId) {
        processedUpdates.status = processedUpdates.status || 'OPEN'
      }
      
      const updatedTicket = await prisma.tickets.update({
        where: { id: finalId },
        data: {
          ...processedUpdates,
          updatedAt: new Date()
        },
        include: {
          users_tickets_clientIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true,
              role: true
            }
          },
          users_tickets_assigneeIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true,
              role: true
            }
          },
          categories: {
            select: {
              id: true,
              name: true,
              color: true,
              level: true
            }
          },
          _count: {
            select: {
              comments: true,
              attachments: true
            }
          }
        }
      })

      // Crear entrada en el historial
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'updated',
          comment: `Administrador actualizó: ${Object.keys(processedUpdates).join(', ')}`,
          ticketId: finalId,
          userId: session.user.id,
          createdAt: new Date()
        }
      })

      // Enviar notificación si se cambió la asignación desde el formulario de edición
      if ('assigneeId' in processedUpdates && processedUpdates.assigneeId && processedUpdates.assigneeId !== existingTicket.assigneeId) {
        const { NotificationService } = await import('@/lib/services/notification-service')
        await NotificationService.notifyTicketAssigned(
          finalId,
          processedUpdates.assigneeId
        ).catch(err => {
          console.error('[NOTIFICATION] Error enviando notificaciones de ticket asignado:', err)
        })
      }

      // ⭐ AUDITORÍA: Registrar actualización de ticket por admin
      await AuditServiceComplete.log({
        action: AuditActionsComplete.TICKET_UPDATED,
        entityType: 'ticket',
        entityId: finalId,
        userId: session.user.id,
        details: {
          ticketTitle: updatedTicket.title,
          updatedBy: 'Administrador',
          adminName: session.user.name,
          fieldsUpdated: Object.keys(processedUpdates)
        },
        oldValues: {
          title: existingTicket.title,
          description: existingTicket.description,
          status: existingTicket.status,
          priority: existingTicket.priority,
          assigneeId: existingTicket.assigneeId,
          categoryId: existingTicket.categoryId
        },
        newValues: processedUpdates,
        request: request
      })

      const transformedTicket = {
        ...updatedTicket,
        client: updatedTicket.users_tickets_clientIdTousers,
        assignee: updatedTicket.users_tickets_assigneeIdTousers,
        category: updatedTicket.categories
      }

      return NextResponse.json({
        success: true,
        data: transformedTicket,
        message: 'Ticket actualizado exitosamente'
      })
    }

    return NextResponse.json(
      { success: false, message: 'Rol no autorizado' },
      { status: 403 }
    )
  } catch (error) {
    console.error('[CRITICAL] Error updating ticket:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar el ticket',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const params = await context.params
    const ticketId = params?.id
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const idFromPath = pathSegments[pathSegments.length - 1]
    
    const finalId = ticketId || idFromPath

    // Verificar que el ticket existe
    const existingTicket = await prisma.tickets.findUnique({
      where: { id: finalId }
    })

    if (!existingTicket) {
      return NextResponse.json(
        { success: false, message: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos según el rol
    if (session.user.role === 'ADMIN') {
      // Admin puede eliminar cualquier ticket
    } else if (session.user.role === 'CLIENT') {
      // Cliente solo puede eliminar sus propios tickets
      if (existingTicket.clientId !== session.user.id) {
        return NextResponse.json(
          { success: false, message: 'No tienes permisos para eliminar este ticket' },
          { status: 403 }
        )
      }
      
      // Cliente solo puede eliminar tickets en estado OPEN (no han sido revisados/trabajados)
      if (existingTicket.status !== 'OPEN') {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Solo puedes eliminar tickets que aún no han sido revisados o asignados. Este ticket ya está en proceso.' 
          },
          { status: 403 }
        )
      }

      // Cliente no puede eliminar tickets que ya tienen técnico asignado
      if (existingTicket.assigneeId) {
        return NextResponse.json(
          {
            success: false,
            message: 'No puedes eliminar este ticket porque ya ha sido asignado a un técnico.',
          },
          { status: 403 }
        )
      }
    } else {
      // Técnicos no pueden eliminar tickets
      return NextResponse.json(
        { success: false, message: 'No tienes permisos para eliminar tickets' },
        { status: 403 }
      )
    }

    // Eliminar ticket (esto también eliminará comentarios, attachments, historial y notificaciones por cascada)
    await prisma.tickets.delete({
      where: { id: finalId }
    })

    // ⭐ AUDITORÍA: Registrar eliminación de ticket
    await AuditServiceComplete.log({
      action: AuditActionsComplete.TICKET_DELETED,
      entityType: 'ticket',
      entityId: finalId,
      userId: session.user.id,
      details: {
        ticketTitle: existingTicket.title,
        deletedBy: session.user.role === 'ADMIN' ? 'Administrador' : 'Cliente',
        userName: session.user.name,
        ticketStatus: existingTicket.status,
        ticketPriority: existingTicket.priority
      },
      request: request
    })

    return NextResponse.json({
      success: true,
      message: 'Ticket eliminado exitosamente'
    })
  } catch (error) {
    console.error('[CRITICAL] Error deleting ticket:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al eliminar el ticket',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}