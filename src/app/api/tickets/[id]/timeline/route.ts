import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id: ticketId } = await params

    // Obtener ticket con toda la información
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        users_tickets_createdByIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
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

    // Obtener comentarios
    const comments = await prisma.comments.findMany({
      where: { ticketId },
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
      orderBy: { createdAt: 'desc' }
    })

    // Obtener historial de cambios
    const history = await prisma.ticket_history.findMany({
      where: { ticketId },
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
      orderBy: { createdAt: 'desc' }
    })

    // Obtener calificación si existe
    const rating = await prisma.ticket_ratings.findUnique({
      where: { ticketId },
      include: {
        users_ticket_ratings_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Construir eventos del timeline
    const events: any[] = []

    // Evento de creación
    if (ticket.users_tickets_createdByIdTousers) {
      events.push({
        id: `created-${ticket.id}`,
        type: 'created',
        title: 'Ticket creado',
        description: ticket.description,
        user: ticket.users_tickets_createdByIdTousers,
        createdAt: ticket.createdAt.toISOString(),
        isInternal: false
      })
    }

    // Eventos de comentarios
    comments.forEach(comment => {
      events.push({
        id: comment.id,
        type: 'comment',
        title: comment.isInternal ? 'Comentario interno agregado' : 'Comentario agregado',
        description: comment.content,
        user: comment.users,
        createdAt: comment.createdAt.toISOString(),
        isInternal: comment.isInternal
      })
    })

    // Eventos de historial
    history.forEach(item => {
      let eventType = 'update'
      let title = 'Ticket actualizado'
      let metadata: any = {}

      if (item.action === 'status_changed') {
        eventType = 'status_change'
        title = 'Estado actualizado'
        metadata = {
          oldValue: item.oldValue,
          newValue: item.newValue
        }
      } else if (item.action === 'priority_changed') {
        eventType = 'priority_change'
        title = 'Prioridad cambiada'
        metadata = {
          oldValue: item.oldValue,
          newValue: item.newValue
        }
      } else if (item.action === 'assigned') {
        eventType = 'assignment'
        title = 'Ticket asignado'
        metadata = {
          newValue: item.newValue
        }
      }

      events.push({
        id: item.id,
        type: eventType,
        title,
        description: item.comment || '',
        user: item.users,
        metadata,
        createdAt: item.createdAt.toISOString(),
        isInternal: false
      })
    })

    // Evento de calificación
    if (rating) {
      events.push({
        id: rating.id,
        type: 'rating',
        title: 'Calificación agregada',
        description: rating.feedback || '',
        user: rating.users_ticket_ratings_clientIdTousers,
        metadata: {
          rating: rating.rating,
          responseTime: rating.responseTime,
          technicalSkill: rating.technicalSkill,
          communication: rating.communication,
          problemResolution: rating.problemResolution
        },
        createdAt: rating.createdAt.toISOString(),
        isInternal: false
      })
    }

    // Ordenar eventos por fecha (más reciente primero)
    events.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({
      success: true,
      data: events,
      meta: {
        ticketId,
        total: events.length
      }
    })
  } catch (error) {
    console.error('Error in timeline API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar el historial del ticket',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}