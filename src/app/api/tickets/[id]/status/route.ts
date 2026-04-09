import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification-service'
import { randomUUID } from 'crypto'

// Transiciones válidas por rol
const TRANSITIONS: Record<string, Record<string, string[]>> = {
  TECHNICIAN: {
    OPEN:        ['IN_PROGRESS'],
    IN_PROGRESS: ['RESOLVED', 'ON_HOLD'],
    ON_HOLD:     ['IN_PROGRESS'],
    RESOLVED:    ['IN_PROGRESS'], // puede reabrir
    CLOSED:      [],              // solo lectura
  },
  ADMIN: {
    OPEN:        ['IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ON_HOLD'],
    IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED', 'ON_HOLD'],
    ON_HOLD:     ['OPEN', 'IN_PROGRESS', 'RESOLVED'],
    RESOLVED:    ['IN_PROGRESS', 'CLOSED'],
    CLOSED:      ['RESOLVED'],
  },
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return NextResponse.json(
        { success: false, message: 'Estado inválido' },
        { status: 400 }
      )
    }

    // Obtener ticket actual
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true, assigneeId: true, clientId: true, title: true },
    })

    if (!ticket) {
      return NextResponse.json({ success: false, message: 'Ticket no encontrado' }, { status: 404 })
    }

    const role = session.user.role
    const currentStatus = ticket.status

    // Verificar permisos de transición
    if (role === 'CLIENT') {
      return NextResponse.json(
        { success: false, message: 'Los clientes no pueden cambiar el estado del ticket' },
        { status: 403 }
      )
    }

    const allowed = TRANSITIONS[role]?.[currentStatus] ?? []
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: `Transición no permitida: ${currentStatus} → ${newStatus}`,
        },
        { status: 400 }
      )
    }

    // Construir datos de actualización
    const updateData: any = {
      status: newStatus,
      updatedAt: new Date(),
    }
    if (newStatus === 'RESOLVED') updateData.resolvedAt = new Date()
    if (newStatus === 'CLOSED')   updateData.closedAt   = new Date()

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

    // Notificar al cliente cuando el técnico marca como RESOLVED
    if (newStatus === 'RESOLVED' && ticket.clientId) {
      await NotificationService.notifyTicketResolved(ticketId).catch(() => {})
    }

    // Notificar al técnico cuando admin cierra el ticket directamente
    if (newStatus === 'CLOSED' && ticket.assigneeId && session.user.role === 'ADMIN') {
      await NotificationService.push({
        userId: ticket.assigneeId,
        type: 'INFO',
        title: 'Ticket cerrado',
        message: `El ticket "${ticket.title}" ha sido cerrado por el administrador`,
        ticketId,
      }).catch(() => {})
    }

    // Notificar al cliente cuando admin cierra directamente (sin calificación)
    if (newStatus === 'CLOSED' && ticket.clientId && session.user.role === 'ADMIN') {
      await NotificationService.push({
        userId: ticket.clientId,
        type: 'SUCCESS',
        title: 'Ticket cerrado',
        message: `Tu ticket "${ticket.title}" ha sido cerrado`,
        ticketId,
      }).catch(() => {})
    }

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
