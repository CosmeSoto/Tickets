import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import {
  assertTicketAccessById,
  TicketAccessError,
  toTicketAccessUser,
} from '@/lib/tickets/ticket-access'
import { assertTechnicianActiveInFamily } from '@/lib/tickets/assignee-validation'
import { getAutoAssignmentEnabled } from '@/lib/settings/runtime-settings'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'Solo los administradores pueden asignar tickets manualmente' },
        { status: 403 }
      )
    }

    const { id: ticketId } = await params
    const assignmentData = await request.json()

    if (assignmentData.assigneeId !== null && typeof assignmentData.assigneeId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'ID del técnico inválido' },
        { status: 400 }
      )
    }

    let ticketAccess
    try {
      ticketAccess = await assertTicketAccessById(
        toTicketAccessUser(session.user),
        ticketId,
        'assign'
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

    const currentTicket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: {
        clientId: true,
        assigneeId: true,
        familyId: true,
        users_tickets_assigneeIdTousers: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!currentTicket) {
      return NextResponse.json({ success: false, message: 'Ticket no encontrado' }, { status: 404 })
    }

    if (assignmentData.assigneeId && assignmentData.assigneeId === currentTicket.clientId) {
      return NextResponse.json(
        {
          success: false,
          message: 'No se puede asignar el ticket al mismo usuario que lo solicitó.',
        },
        { status: 400 }
      )
    }

    if (assignmentData.assigneeId) {
      try {
        await assertTechnicianActiveInFamily(
          assignmentData.assigneeId,
          currentTicket.familyId ?? ticketAccess.familyId ?? undefined
        )
      } catch (err) {
        return NextResponse.json(
          {
            success: false,
            message: err instanceof Error ? err.message : 'Técnico no válido para esta familia',
          },
          { status: 422 }
        )
      }
    }

    const updatedTicket = await prisma.tickets.update({
      where: { id: ticketId },
      data: {
        assigneeId: assignmentData.assigneeId,
        status: assignmentData.assigneeId ? 'IN_PROGRESS' : 'OPEN',
        updatedAt: new Date(),
      },
      include: {
        users_tickets_assigneeIdTousers: {
          select: { id: true, name: true, email: true, role: true },
        },
        users_tickets_clientIdTousers: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    const oldAssigneeName = currentTicket.users_tickets_assigneeIdTousers?.name || 'Sin asignar'
    const newAssigneeName = updatedTicket.users_tickets_assigneeIdTousers?.name || 'Sin asignar'

    await prisma.ticket_history.create({
      data: {
        id: randomUUID(),
        ticketId,
        userId: session.user.id,
        action: assignmentData.assigneeId ? 'assigned' : 'unassigned',
        comment:
          assignmentData.comment ||
          `Asignación cambiada de ${oldAssigneeName} a ${newAssigneeName}`,
        createdAt: new Date(),
      },
    })

    if (assignmentData.assigneeId && assignmentData.assigneeId !== currentTicket.assigneeId) {
      const { NotificationService } = await import('@/lib/services/notification-service')
      await NotificationService.notifyTicketAssigned(ticketId, assignmentData.assigneeId).catch(
        err => {
          console.error('[ASSIGN] Error enviando notificaciones:', err)
        }
      )

      const { triggerTicketAssignedToTechnicianEmail, triggerTicketAssignedToClientEmail } =
        await import('@/lib/email-triggers')

      void triggerTicketAssignedToTechnicianEmail(ticketId)
      void triggerTicketAssignedToClientEmail(ticketId)
    }

    if (!assignmentData.assigneeId && currentTicket.assigneeId) {
      const { NotificationService } = await import('@/lib/services/notification-service')
      await NotificationService.push({
        userId: currentTicket.assigneeId,
        type: 'INFO',
        title: 'Ticket desasignado',
        message: `El ticket ha sido desasignado de ti por ${session.user.name || 'un administrador'}`,
        ticketId,
      }).catch(err => {
        console.error('[ASSIGN] Error notificando desasignación:', err)
      })
    }

    return NextResponse.json({
      success: true,
      data: { ticket: updatedTicket },
      message: assignmentData.assigneeId
        ? 'Ticket asignado exitosamente'
        : 'Asignación removida exitosamente',
    })
  } catch (error) {
    console.error('Error in assign PATCH API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar la asignación del ticket',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo los administradores pueden ejecutar asignación automática' },
        { status: 403 }
      )
    }

    const { id: ticketId } = await params
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode')

    if (mode === 'auto') {
      const autoAssignmentEnabled = await getAutoAssignmentEnabled()
      if (!autoAssignmentEnabled) {
        return NextResponse.json(
          { error: 'La asignación automática está deshabilitada en la configuración del sistema' },
          { status: 403 }
        )
      }

      try {
        await assertTicketAccessById(toTicketAccessUser(session.user), ticketId, 'assign')
      } catch (err) {
        if (err instanceof TicketAccessError) {
          return NextResponse.json({ error: err.message }, { status: err.statusCode })
        }
        throw err
      }

      const body = await request.json()
      const { AssignmentService } = await import('@/lib/services/ticket-assignment.service')

      try {
        const ticket = await prisma.tickets.findUnique({
          where: { id: ticketId },
          select: { clientId: true, familyId: true },
        })

        if (!ticket) {
          return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
        }

        const result = await AssignmentService.autoAssignTicket(
          ticketId,
          {
            workloadBalance: body.workloadBalance !== false,
            skillMatch: body.skillMatch !== false,
          },
          ticket.clientId
        )

        return NextResponse.json(result)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error en asignación automática'
        console.error('[AUTO-ASSIGN] Error:', msg)
        const isNotFound = msg.includes('no encontrado') || msg.includes('not found')
        return NextResponse.json({ error: msg }, { status: isNotFound ? 404 : 400 })
      }
    }

    return NextResponse.json(
      { error: 'Método no soportado para este tipo de asignación' },
      { status: 405 }
    )
  } catch (error) {
    console.error('Error in assign POST API:', error)
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
