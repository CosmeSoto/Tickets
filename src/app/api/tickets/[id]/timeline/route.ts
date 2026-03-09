import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/tickets/[id]/timeline
 * Obtiene el timeline (historial) de un ticket
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const params = await context.params
    const ticketId = params.id

    // Verificar que el ticket existe
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        clientId: true,
        assigneeId: true,
      },
    })

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos
    const isAdmin = session.user.role === 'ADMIN'
    const isTechnician = session.user.role === 'TECHNICIAN'
    const isClient = session.user.role === 'CLIENT'
    const isOwner = ticket.clientId === session.user.id
    const isAssignee = ticket.assigneeId === session.user.id

    if (!isAdmin && !isTechnician && !isOwner && !isAssignee) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para ver este timeline' },
        { status: 403 }
      )
    }

    // Obtener historial del ticket
    const history = await prisma.ticket_history.findMany({
      where: { ticketId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Formatear timeline
    const timeline = history.map((entry) => ({
      id: entry.id,
      action: entry.action,
      field: entry.field,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      description: entry.description,
      createdAt: entry.createdAt,
      user: entry.users
        ? {
            id: entry.users.id,
            name: entry.users.name,
            email: entry.users.email,
            role: entry.users.role,
            avatar: entry.users.avatar,
          }
        : null,
    }))

    return NextResponse.json({
      success: true,
      timeline,
    })
  } catch (error) {
    console.error('[API-TIMELINE] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener el timeline' },
      { status: 500 }
    )
  }
}
