import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { auditTicketChange } from '@/lib/audit'
import { WebhookService } from '@/lib/services/webhook-service'
import { SLAService } from '@/lib/services/sla-service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { NotificationService } from '@/lib/services/notification-service'
import { notifyTicketChanged, invalidateTicketCaches } from '@/lib/tickets/notify-ticket-changed'
import { translateFieldNames } from '@/lib/constants/ticket-labels'
import { assertTechnicianActiveInFamily } from '@/lib/tickets/assignee-validation'
import {
  assertTicketAccess,
  TicketAccessError,
  toTicketAccessUser,
} from '@/lib/tickets/ticket-access'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
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
            role: true,
          },
        },
        users_tickets_assigneeIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
            departmentId: true,
            role: true,
          },
        },
        users_tickets_createdByIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        categories: {
          select: {
            id: true,
            name: true,
            color: true,
            level: true,
          },
        },
        comments: {
          where:
            session.user.role === 'CLIENT'
              ? { isInternal: false } // Cliente solo ve comentarios públicos
              : {}, // Técnico y admin ven todos
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        attachments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        ticket_history: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        knowledge_article: {
          select: {
            id: true,
            title: true,
            isPublished: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            // Para clientes: solo contar comentarios públicos
            // Para técnicos/admin: contar todos
            attachments: true,
          },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ success: false, message: 'Ticket no encontrado' }, { status: 404 })
    }

    try {
      await assertTicketAccess(
        toTicketAccessUser(session.user),
        {
          id: ticket.id,
          clientId: ticket.clientId,
          assigneeId: ticket.assigneeId,
          familyId: ticket.familyId,
          source: ticket.source,
          createdById: ticket.createdById,
        },
        'read'
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

    // Transformar la respuesta para que sea compatible con el frontend
    const transformedTicket = {
      ...ticket,
      client: ticket.users_tickets_clientIdTousers,
      assignee: ticket.users_tickets_assigneeIdTousers,
      createdBy: ticket.users_tickets_createdByIdTousers,
      category: ticket.categories,
      history: ticket.ticket_history.map(h => ({
        ...h,
        user: h.users,
      })),
    }

    return NextResponse.json({
      success: true,
      data: transformedTicket,
    })
  } catch (error) {
    console.error('Error fetching ticket:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar el ticket',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Invalidar caché al inicio — el ticket va a cambiar
  invalidateTicketCaches()
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
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
      where: { id: finalId },
    })

    if (!existingTicket) {
      return NextResponse.json({ success: false, message: 'Ticket no encontrado' }, { status: 404 })
    }

    try {
      await assertTicketAccess(
        toTicketAccessUser(session.user),
        {
          id: existingTicket.id,
          clientId: existingTicket.clientId,
          assigneeId: existingTicket.assigneeId,
          familyId: existingTicket.familyId,
          source: existingTicket.source,
          createdById: existingTicket.createdById,
        },
        'write'
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

    // CONTROL DE PERMISOS POR ROL
    const filteredUpdates: any = {}

    if (session.user.role === 'CLIENT') {
      // Cliente solo puede editar título y descripción, y SOLO si el ticket está en estado OPEN
      if (existingTicket.status !== 'OPEN') {
        return NextResponse.json(
          {
            success: false,
            message:
              'Solo puedes editar tickets que aún no han sido revisados o asignados. Para cambios adicionales, agrega un comentario.',
          },
          { status: 403 }
        )
      }

      // Filtrar solo campos permitidos para clientes
      const clientAllowed = ['title', 'description']
      clientAllowed.forEach(field => {
        if (updates[field] !== undefined) filteredUpdates[field] = updates[field]
      })

      // Si intenta modificar otros campos, rechazar
      const attemptedFields = Object.keys(updates)
      const unauthorizedFields = attemptedFields.filter(f => !clientAllowed.includes(f))
      if (unauthorizedFields.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `No tienes permisos para modificar: ${unauthorizedFields.join(', ')}`,
          },
          { status: 403 }
        )
      }

      // Actualizar solo campos permitidos
      const updatedTicket = await prisma.tickets.update({
        where: { id: finalId },
        data: {
          ...filteredUpdates,
          updatedAt: new Date(),
        },
        include: {
          users_tickets_clientIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true,
              role: true,
            },
          },
          users_tickets_assigneeIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true,
              role: true,
            },
          },
          categories: {
            select: {
              id: true,
              name: true,
              color: true,
              level: true,
            },
          },
          _count: {
            select: {
              comments: true,
              attachments: true,
            },
          },
        },
      })

      // Crear entrada en el historial
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'updated',
          comment: `Cliente actualizó: ${translateFieldNames(Object.keys(filteredUpdates))}`,
          ticketId: finalId,
          userId: session.user.id,
          createdAt: new Date(),
        },
      })

      // Auditoría de cambios
      if (filteredUpdates.title && filteredUpdates.title !== existingTicket.title) {
        await auditTicketChange(finalId, session.user.id, 'title_updated', {
          oldValue: existingTicket.title,
          newValue: filteredUpdates.title,
        })
      }

      if (
        filteredUpdates.description &&
        filteredUpdates.description !== existingTicket.description
      ) {
        await auditTicketChange(finalId, session.user.id, 'description_updated', {
          oldValue: existingTicket.description,
          newValue: filteredUpdates.description,
        })
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
          fieldsUpdated: Object.keys(filteredUpdates),
        },
        oldValues: {
          title: existingTicket.title,
          description: existingTicket.description,
        },
        newValues: filteredUpdates,
        request: request,
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
          priority: updatedTicket.priority,
        },
      }).catch(err => {
        console.error('[WEBHOOK] Error disparando evento TICKET_UPDATED:', err)
      })

      const transformedTicket = {
        ...updatedTicket,
        client: updatedTicket.users_tickets_clientIdTousers,
        assignee: updatedTicket.users_tickets_assigneeIdTousers,
        category: updatedTicket.categories,
      }

      notifyTicketChanged(finalId, 'ticket_updated')

      return NextResponse.json({
        success: true,
        data: transformedTicket,
        message: 'Ticket actualizado exitosamente',
      })
    } else if (session.user.role === 'TECHNICIAN') {
      // Técnico puede cambiar: status, priority, assigneeId
      const techAllowed = ['status', 'priority', 'assigneeId']
      techAllowed.forEach(field => {
        if (updates[field] !== undefined) filteredUpdates[field] = updates[field]
      })

      // Bloquear transición directa a CLOSED para técnicos.
      // El cierre ocurre automáticamente cuando el cliente califica.
      if (filteredUpdates.status === 'CLOSED') {
        return NextResponse.json(
          {
            success: false,
            message:
              'Los técnicos no pueden cerrar tickets directamente. El ticket se cierra automáticamente cuando el cliente envía su calificación.',
          },
          { status: 403 }
        )
      }

      // Procesar assigneeId: convertir undefined a null para desasignar
      if ('assigneeId' in filteredUpdates && filteredUpdates.assigneeId === undefined) {
        filteredUpdates.assigneeId = null
      }

      // Bloquear asignación al propio solicitante del ticket
      if (filteredUpdates.assigneeId && filteredUpdates.assigneeId === existingTicket.clientId) {
        return NextResponse.json(
          {
            success: false,
            message: 'No se puede asignar el ticket al mismo usuario que lo solicitó.',
          },
          { status: 400 }
        )
      }

      // Si intenta modificar título o descripción, rechazar
      if (updates.title || updates.description) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Los técnicos no pueden modificar el título o descripción del ticket. Esto preserva la solicitud original del cliente para auditoría.',
          },
          { status: 403 }
        )
      }

      const updatedTicket = await prisma.tickets.update({
        where: { id: finalId },
        data: {
          ...filteredUpdates,
          updatedAt: new Date(),
        },
        include: {
          users_tickets_clientIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true,
              role: true,
            },
          },
          users_tickets_assigneeIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true,
              role: true,
            },
          },
          categories: {
            select: {
              id: true,
              name: true,
              color: true,
              level: true,
            },
          },
          _count: {
            select: {
              comments: true,
              attachments: true,
            },
          },
        },
      })

      // Crear entrada en el historial
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'updated',
          comment: `Técnico actualizó: ${translateFieldNames(Object.keys(filteredUpdates))}`,
          ticketId: finalId,
          userId: session.user.id,
          createdAt: new Date(),
        },
      })

      // Auditoría de cambios
      if (filteredUpdates.status && filteredUpdates.status !== existingTicket.status) {
        await auditTicketChange(finalId, session.user.id, 'status_changed', {
          oldValue: existingTicket.status,
          newValue: filteredUpdates.status,
        })

        // ⭐ AUDITORÍA: Registrar cambio de estado
        await AuditServiceComplete.log({
          action: AuditActionsComplete.TICKET_STATUS_CHANGED,
          entityType: 'ticket',
          entityId: finalId,
          userId: session.user.id,
          details: {
            ticketTitle: updatedTicket.title,
            technicianName: session.user.name,
          },
          oldValues: { status: existingTicket.status },
          newValues: { status: filteredUpdates.status },
          request: request,
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
              clientName: updatedTicket.users_tickets_clientIdTousers?.name,
            },
            request: request,
          })

          // Disparar webhook de ticket resuelto
          await WebhookService.trigger(WebhookService.EVENTS.TICKET_RESOLVED, {
            ticketId: finalId,
            resolvedBy: session.user.name,
            ticket: {
              id: updatedTicket.id,
              title: updatedTicket.title,
              client: updatedTicket.users_tickets_clientIdTousers?.name,
              resolvedAt: new Date(),
            },
          }).catch(err => {
            console.error('[WEBHOOK] Error disparando evento TICKET_RESOLVED:', err)
          })

          // Email + notificación a quien debe calificar
          // (PATROL → createdById / supervisor; WEB → clientId / solicitante)
          const isPatrolResolved =
            existingTicket.source === 'PATROL' && !!existingTicket.createdById
          const raterId = isPatrolResolved ? existingTicket.createdById! : existingTicket.clientId
          if (raterId) {
            const rater = await prisma.users.findUnique({
              where: { id: raterId },
              select: { name: true, email: true, role: true },
            })
            if (rater?.email) {
              const { queueTicketResolvedRaterEmail } =
                await import('@/lib/notifications/ticket-resolved-email')
              await queueTicketResolvedRaterEmail({
                ticketId: finalId,
                title: updatedTicket.title,
                raterId,
                raterName: rater.name,
                raterEmail: rater.email,
                raterRole: rater.role,
                technicianName: session.user.name,
                actorUserId: session.user.id,
                isPatrolEscalation: isPatrolResolved,
              }).catch(err => {
                console.error('[EMAIL] Error enviando email de ticket resuelto:', err)
              })
            }
          }

          await NotificationService.notifyTicketResolved(finalId).catch(err => {
            console.error('[NOTIFICATION] Error enviando notificación de ticket resuelto:', err)
          })

          // ⭐ NUEVO: Notificar al administrador que el ticket fue resuelto
          const { triggerTicketResolvedToAdminEmail } = await import('@/lib/email-triggers')
          void triggerTicketResolvedToAdminEmail(finalId, session.user.id)
        }

        // ⭐ NUEVO: Disparar webhook de ticket reabierto
        if (existingTicket.status === 'CLOSED' && filteredUpdates.status === 'OPEN') {
          await WebhookService.trigger(WebhookService.EVENTS.TICKET_REOPENED, {
            ticketId: finalId,
            reopenedBy: session.user.name,
            ticket: {
              id: updatedTicket.id,
              title: updatedTicket.title,
            },
          }).catch(err => {
            console.error('[WEBHOOK] Error disparando evento TICKET_REOPENED:', err)
          })
        }

        const { TicketEvents } = await import('@/lib/ticket-events')
        TicketEvents.emit(finalId, {
          type: 'status_changed',
          status: filteredUpdates.status,
          previousStatus: existingTicket.status,
        })
      }

      if (filteredUpdates.priority && filteredUpdates.priority !== existingTicket.priority) {
        await auditTicketChange(finalId, session.user.id, 'priority_changed', {
          oldValue: existingTicket.priority,
          newValue: filteredUpdates.priority,
        })

        // ⭐ AUDITORÍA: Registrar cambio de prioridad
        await AuditServiceComplete.log({
          action: AuditActionsComplete.TICKET_PRIORITY_CHANGED,
          entityType: 'ticket',
          entityId: finalId,
          userId: session.user.id,
          details: {
            ticketTitle: updatedTicket.title,
            technicianName: session.user.name,
          },
          oldValues: { priority: existingTicket.priority },
          newValues: { priority: filteredUpdates.priority },
          request: request,
        })
      }

      if (filteredUpdates.assigneeId && filteredUpdates.assigneeId !== existingTicket.assigneeId) {
        await auditTicketChange(finalId, session.user.id, 'assigned', {
          oldValue: existingTicket.assigneeId,
          newValue: filteredUpdates.assigneeId,
        })

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
            previousAssignee: existingTicket.assigneeId ? 'Técnico anterior' : 'Sin asignar',
          },
          oldValues: { assigneeId: existingTicket.assigneeId },
          newValues: { assigneeId: filteredUpdates.assigneeId },
          request: request,
        })

        // ⭐ NUEVO: Disparar webhook de ticket asignado
        await WebhookService.trigger(WebhookService.EVENTS.TICKET_ASSIGNED, {
          ticketId: finalId,
          assignedBy: session.user.name,
          assignee: updatedTicket.users_tickets_assigneeIdTousers
            ? {
                id: updatedTicket.users_tickets_assigneeIdTousers.id,
                name: updatedTicket.users_tickets_assigneeIdTousers.name,
                email: updatedTicket.users_tickets_assigneeIdTousers.email,
              }
            : null,
          ticket: {
            id: updatedTicket.id,
            title: updatedTicket.title,
            priority: updatedTicket.priority,
          },
        }).catch(err => {
          console.error('[WEBHOOK] Error disparando evento TICKET_ASSIGNED:', err)
        })

        // Email al técnico: lo cubren triggerTicketAssigned* (evita duplicar con cola)
        if (updatedTicket.users_tickets_assigneeIdTousers) {
          const { triggerTicketAssignedToTechnicianEmail, triggerTicketAssignedToClientEmail } =
            await import('@/lib/email-triggers')
          void triggerTicketAssignedToTechnicianEmail(finalId)
          void triggerTicketAssignedToClientEmail(finalId)
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
          priority: updatedTicket.priority,
        },
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
          fieldsUpdated: Object.keys(filteredUpdates),
        },
        oldValues: {
          status: existingTicket.status,
          priority: existingTicket.priority,
          assigneeId: existingTicket.assigneeId,
        },
        newValues: filteredUpdates,
        request: request,
      })

      const transformedTicket = {
        ...updatedTicket,
        client: updatedTicket.users_tickets_clientIdTousers,
        assignee: updatedTicket.users_tickets_assigneeIdTousers,
        category: updatedTicket.categories,
      }

      notifyTicketChanged(finalId, 'ticket_updated')

      return NextResponse.json({
        success: true,
        data: transformedTicket,
        message: 'Ticket actualizado exitosamente',
      })
    } else if (session.user.role === 'ADMIN') {
      // Admin puede actualizar los campos del ticket (con registro en historial).
      // Whitelist explícita: evita mass-assignment de campos no expuestos por el
      // formulario (p. ej. clientId, createdById, source) que llegaran en el body.
      // Como efecto colateral, esto también garantiza que el chequeo de "no asignar
      // al propio solicitante" de más abajo compare siempre contra el clientId real,
      // porque clientId ya no puede modificarse en la misma petición.
      const adminAllowed = [
        'title',
        'description',
        'priority',
        'status',
        'categoryId',
        'assigneeId',
        'familyId',
      ]
      const processedUpdates: any = {}
      adminAllowed.forEach(field => {
        if (updates[field] !== undefined) processedUpdates[field] = updates[field]
      })

      // Procesar assigneeId: convertir undefined a null para desasignar
      if (
        'assigneeId' in processedUpdates &&
        (processedUpdates.assigneeId === undefined || processedUpdates.assigneeId === '')
      ) {
        processedUpdates.assigneeId = null
      }

      // Bloquear asignación al propio solicitante del ticket
      if (processedUpdates.assigneeId && processedUpdates.assigneeId === existingTicket.clientId) {
        return NextResponse.json(
          {
            success: false,
            message: 'No se puede asignar el ticket al mismo usuario que lo solicitó.',
          },
          { status: 400 }
        )
      }

      // Si se desasigna el técnico, volver el estado a OPEN automáticamente
      if (
        'assigneeId' in processedUpdates &&
        processedUpdates.assigneeId === null &&
        existingTicket.assigneeId
      ) {
        processedUpdates.status = processedUpdates.status || 'OPEN'
      }

      let effectiveFamilyId: string | null = existingTicket.familyId
      if (
        processedUpdates.categoryId &&
        processedUpdates.categoryId !== existingTicket.categoryId
      ) {
        const newCategory = await prisma.categories.findUnique({
          where: { id: processedUpdates.categoryId },
          include: { departments: { select: { familyId: true } } },
        })
        effectiveFamilyId =
          newCategory?.familyId ??
          newCategory?.departments?.familyId ??
          existingTicket.familyId ??
          null
      }

      const finalAssigneeId =
        processedUpdates.assigneeId !== undefined
          ? processedUpdates.assigneeId
          : existingTicket.assigneeId

      // Solo validar la asignación de familia si el assigneeId está siendo modificado
      if ('assigneeId' in processedUpdates && processedUpdates.assigneeId !== null) {
        try {
          await assertTechnicianActiveInFamily(finalAssigneeId, effectiveFamilyId ?? undefined)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Asignación inválida'
          return NextResponse.json({ success: false, message }, { status: 400 })
        }
      }

      const updatedTicket = await prisma.tickets.update({
        where: { id: finalId },
        data: {
          ...processedUpdates,
          updatedAt: new Date(),
        },
        include: {
          users_tickets_clientIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true,
              role: true,
            },
          },
          users_tickets_assigneeIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true,
              role: true,
            },
          },
          categories: {
            select: {
              id: true,
              name: true,
              color: true,
              level: true,
            },
          },
          _count: {
            select: {
              comments: true,
              attachments: true,
            },
          },
        },
      })

      // Crear entrada en el historial
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'updated',
          comment: `Administrador actualizó: ${translateFieldNames(Object.keys(processedUpdates))}`,
          ticketId: finalId,
          userId: session.user.id,
          createdAt: new Date(),
        },
      })

      // Enviar notificación si se cambió la asignación desde el formulario de edición
      if (
        'assigneeId' in processedUpdates &&
        processedUpdates.assigneeId &&
        processedUpdates.assigneeId !== existingTicket.assigneeId
      ) {
        const { NotificationService } = await import('@/lib/services/notification-service')
        await NotificationService.notifyTicketAssigned(finalId, processedUpdates.assigneeId).catch(
          err => {
            console.error('[NOTIFICATION] Error enviando notificaciones de ticket asignado:', err)
          }
        )
        const { triggerTicketAssignedToTechnicianEmail, triggerTicketAssignedToClientEmail } =
          await import('@/lib/email-triggers')
        void triggerTicketAssignedToTechnicianEmail(finalId)
        void triggerTicketAssignedToClientEmail(finalId)
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
          fieldsUpdated: Object.keys(processedUpdates),
        },
        oldValues: {
          title: existingTicket.title,
          description: existingTicket.description,
          status: existingTicket.status,
          priority: existingTicket.priority,
          assigneeId: existingTicket.assigneeId,
          categoryId: existingTicket.categoryId,
        },
        newValues: processedUpdates,
        request: request,
      })

      const transformedTicket = {
        ...updatedTicket,
        client: updatedTicket.users_tickets_clientIdTousers,
        assignee: updatedTicket.users_tickets_assigneeIdTousers,
        category: updatedTicket.categories,
      }

      notifyTicketChanged(finalId, 'ticket_updated')

      return NextResponse.json({
        success: true,
        data: transformedTicket,
        message: 'Ticket actualizado exitosamente',
      })
    }

    return NextResponse.json({ success: false, message: 'Rol no autorizado' }, { status: 403 })
  } catch (error) {
    console.error('[CRITICAL] Error updating ticket:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar el ticket',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  invalidateTicketCaches()
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const params = await context.params
    const ticketId = params?.id
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const idFromPath = pathSegments[pathSegments.length - 1]

    const finalId = ticketId || idFromPath

    // Verificar que el ticket existe
    const existingTicket = await prisma.tickets.findUnique({
      where: { id: finalId },
    })

    if (!existingTicket) {
      return NextResponse.json({ success: false, message: 'Ticket no encontrado' }, { status: 404 })
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
            message:
              'Solo puedes eliminar tickets que aún no han sido revisados o asignados. Este ticket ya está en proceso.',
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
      where: { id: finalId },
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
        ticketPriority: existingTicket.priority,
      },
      request: request,
    })

    notifyTicketChanged(finalId, 'ticket_deleted')

    return NextResponse.json({
      success: true,
      message: 'Ticket eliminado exitosamente',
    })
  } catch (error) {
    console.error('[CRITICAL] Error deleting ticket:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al eliminar el ticket',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
