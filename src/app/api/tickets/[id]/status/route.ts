import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification-service'
import { randomUUID } from 'crypto'
import { invalidateCache } from '@/lib/api-cache'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import {
  assertTicketAccess,
  TicketAccessError,
  toTicketAccessUser,
} from '@/lib/tickets/ticket-access'

// Transiciones válidas por rol
const TRANSITIONS: Record<string, Record<string, string[]>> = {
  TECHNICIAN: {
    OPEN: ['IN_PROGRESS'],
    IN_PROGRESS: ['RESOLVED', 'ON_HOLD'],
    ON_HOLD: ['IN_PROGRESS'],
    RESOLVED: ['IN_PROGRESS'], // puede reabrir
    CLOSED: [], // solo lectura
  },
  ADMIN: {
    OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ON_HOLD'],
    IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED', 'ON_HOLD'],
    ON_HOLD: ['OPEN', 'IN_PROGRESS', 'RESOLVED'],
    RESOLVED: ['IN_PROGRESS', 'CLOSED'],
    CLOSED: ['RESOLVED'],
  },
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id: ticketId } = await params
    const body = await request.json()
    const { status: newStatus, comment } = body

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ON_HOLD']
    if (!newStatus || !validStatuses.includes(newStatus)) {
      return NextResponse.json({ success: false, message: 'Estado inválido' }, { status: 400 })
    }

    // Obtener ticket actual
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        status: true,
        assigneeId: true,
        clientId: true,
        familyId: true,
        title: true,
      },
    })

    if (!ticket) {
      return NextResponse.json({ success: false, message: 'Ticket no encontrado' }, { status: 404 })
    }

    const role = session.user.role
    const isSuperAdmin = (session.user as any).isSuperAdmin ?? false

    if (!isSuperAdmin) {
      try {
        await assertTicketAccess(toTicketAccessUser(session.user), ticket, 'write')
      } catch (err) {
        if (err instanceof TicketAccessError) {
          return NextResponse.json(
            { success: false, message: err.message },
            { status: err.statusCode }
          )
        }
        throw err
      }
    }
    const currentStatus = ticket.status

    // SUPER ADMIN: NO TIENE RESTRICCIONES DE NINGÚN TIPO
    if (isSuperAdmin) {
      // Permitir cualquier cambio de estado sin validaciones adicionales
    } else {
      // Verificar permisos de transición para roles normales
      if (role === 'CLIENT') {
        return NextResponse.json(
          { success: false, message: 'Los clientes no pueden cambiar el estado del ticket' },
          { status: 403 }
        )
      }

      // Colaboradores: pueden cambiar a IN_PROGRESS/ON_HOLD pero NO cerrar ni resolver
      if (role === 'TECHNICIAN' && ticket.assigneeId !== session.user.id) {
        // Si el ticket no tiene assignee, el técnico puede tomarlo (auto-asignarse al cambiar a IN_PROGRESS)
        if (ticket.assigneeId === null && newStatus === 'IN_PROGRESS') {
          // Permitir: el técnico se auto-asigna al tomar el ticket
        } else {
          const isCollaborator = await prisma.ticket_collaborators.findUnique({
            where: { ticketId_collaboratorId: { ticketId, collaboratorId: session.user.id } },
          })
          if (!isCollaborator) {
            return NextResponse.json(
              {
                success: false,
                message: 'No tienes permiso para cambiar el estado de este ticket',
              },
              { status: 403 }
            )
          }
          // Colaborador: solo puede poner en progreso o en espera, no resolver ni cerrar
          const collaboratorAllowed = ['IN_PROGRESS', 'ON_HOLD']
          if (!collaboratorAllowed.includes(newStatus)) {
            return NextResponse.json(
              { success: false, message: 'Los colaboradores no pueden resolver ni cerrar tickets' },
              { status: 403 }
            )
          }
        }
      }

      // Si es admin, permitir todas las transiciones según TRANSITIONS[ADMIN]
      let allowed: string[]
      if (role === 'ADMIN') {
        allowed = TRANSITIONS['ADMIN']?.[currentStatus] ?? []
      } else {
        allowed = TRANSITIONS[role]?.[currentStatus] ?? []
      }

      if (!allowed.includes(newStatus)) {
        return NextResponse.json(
          {
            success: false,
            message: `Transición no permitida: ${currentStatus} → ${newStatus}`,
          },
          { status: 400 }
        )
      }
    }

    // Construir datos de actualización
    const updateData: any = {
      status: newStatus,
      updatedAt: new Date(),
    }
    if (newStatus === 'RESOLVED') updateData.resolvedAt = new Date()
    if (newStatus === 'CLOSED') updateData.closedAt = new Date()
    // Auto-asignar al técnico si el ticket no tenía assignee y lo está tomando
    if (role === 'TECHNICIAN' && ticket.assigneeId === null && newStatus === 'IN_PROGRESS') {
      updateData.assigneeId = session.user.id
    }

    // Actualizar ticket en BD
    const updatedTicket = await prisma.tickets.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        categories: { select: { id: true, name: true, color: true } },
        users_tickets_clientIdTousers: { select: { id: true, name: true, email: true } },
        users_tickets_assigneeIdTousers: { select: { id: true, name: true, email: true } },
      },
    })

    // Registrar en historial
    await prisma.ticket_history.create({
      data: {
        id: randomUUID(),
        ticketId,
        userId: session.user.id,
        action: 'status_changed',
        field: 'status',
        oldValue: currentStatus,
        newValue: newStatus,
        comment: comment || null,
        createdAt: new Date(),
      },
    })

    // AUDITORÍA COMPLETA: Registrar cambio de estado (para SUPER ADMIN y demás roles)
    await AuditServiceComplete.log({
      action: AuditActionsComplete.TICKET_STATUS_CHANGED,
      entityType: 'ticket',
      entityId: ticketId,
      userId: session.user.id,
      details: {
        ticketTitle: ticket.title,
        userName: session.user.name,
        userRole: session.user.role,
        isSuperAdmin: isSuperAdmin,
      },
      oldValues: { status: currentStatus },
      newValues: { status: newStatus },
      request: request,
    }).catch(err => console.error('[AUDIT] Error registrando cambio de estado:', err))

    // Notificar al cliente cuando el técnico o SUPER ADMIN marca como RESOLVED
    if (newStatus === 'RESOLVED' && ticket.clientId) {
      await NotificationService.notifyTicketResolved(ticketId).catch(() => {})
    }

    // Notificar al técnico cuando ADMIN o SUPER ADMIN cierra el ticket directamente
    if (
      newStatus === 'CLOSED' &&
      ticket.assigneeId &&
      (session.user.role === 'ADMIN' || isSuperAdmin)
    ) {
      await NotificationService.push({
        userId: ticket.assigneeId,
        type: 'INFO',
        title: 'Ticket cerrado',
        message: `El ticket "${ticket.title}" ha sido cerrado por ${isSuperAdmin ? 'el Super Admin' : 'el administrador'}`,
        ticketId,
      }).catch(() => {})
    }

    // Notificar al cliente cuando ADMIN o SUPER ADMIN cierra directamente (sin calificación)
    if (
      newStatus === 'CLOSED' &&
      ticket.clientId &&
      (session.user.role === 'ADMIN' || isSuperAdmin)
    ) {
      await NotificationService.push({
        userId: ticket.clientId,
        type: 'SUCCESS',
        title: 'Ticket cerrado',
        message: `Tu ticket "${ticket.title}" ha sido cerrado`,
        ticketId,
      }).catch(() => {})
    }

    // Invalidar caché de tickets y dashboard
    await invalidateCache([
      'tickets:role=ADMIN*',
      'tickets:role=TECHNICIAN*',
      'tickets:role=CLIENT*',
      'dashboard:*',
    ]).catch(() => {})

    return NextResponse.json({
      success: true,
      data: {
        id: updatedTicket.id,
        status: updatedTicket.status,
        updatedAt: updatedTicket.updatedAt.toISOString(),
        resolvedAt: updatedTicket.resolvedAt?.toISOString() ?? null,
        closedAt: updatedTicket.closedAt?.toISOString() ?? null,
        category: updatedTicket.categories,
        client: updatedTicket.users_tickets_clientIdTousers,
        assignee: updatedTicket.users_tickets_assigneeIdTousers,
      },
      message: `Estado actualizado a ${newStatus}`,
    })
  } catch (error) {
    console.error('[STATUS] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Error al actualizar estado' },
      { status: 500 }
    )
  }
}
