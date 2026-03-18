import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// Schema de validación para calificación
const ratingSchema = z.object({
  overall: z.number().min(1).max(5),
  responseTime: z.number().min(0).max(5).optional(),
  technicalSkill: z.number().min(0).max(5).optional(),
  communication: z.number().min(0).max(5).optional(),
  problemResolution: z.number().min(0).max(5).optional(),
  comments: z.string().max(500).optional(),
})

// POST /api/tickets/[id]/rate - Calificar ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id: ticketId } = await params

    // Obtener ticket
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el usuario sea el cliente del ticket
    if (ticket.clientId !== session.user.id) {
      return NextResponse.json(
        { error: 'Solo el cliente puede calificar el ticket' },
        { status: 403 }
      )
    }

    // Verificar que el ticket esté resuelto
    if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
      return NextResponse.json(
        { error: 'Solo se pueden calificar tickets resueltos' },
        { status: 400 }
      )
    }

    // Verificar que no exista una calificación previa
    const existingRating = await prisma.ticket_ratings.findUnique({
      where: { ticketId },
    })

    if (existingRating) {
      return NextResponse.json(
        { error: 'Este ticket ya ha sido calificado' },
        { status: 409 }
      )
    }

    const body = await request.json()
    
    // Validar datos
    const validationResult = ratingSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Crear calificación
    const rating = await prisma.ticket_ratings.create({
      data: {
        id: randomUUID(),
        ticketId,
        clientId: session.user.id,
        technicianId: ticket.assigneeId || undefined,
        rating: data.overall,
        responseTime: data.responseTime || 0,
        technicalSkill: data.technicalSkill || 0,
        communication: data.communication || 0,
        problemResolution: data.problemResolution || 0,
        feedback: data.comments,
        updatedAt: new Date(),
      },
    })

    // Registrar en auditoría
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'ticket_rating',
        entityId: rating.id,
        details: {
          ticketId,
          overall: data.overall,
        },
      },
    })

    // Crear notificación para el técnico si existe
    if (ticket.assigneeId) {
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          title: 'Nueva calificación recibida',
          message: `El cliente calificó tu trabajo en el ticket: "${ticket.title}" con ${data.overall} estrellas`,
          type: 'INFO',
          userId: ticket.assigneeId,
          ticketId,
          isRead: false,
        },
      })
    }

    // ⭐ Cerrar ticket automáticamente tras la calificación del cliente
    if (ticket.status === 'RESOLVED') {
      await prisma.tickets.update({
        where: { id: ticketId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          updatedAt: new Date(),
        },
      })

      // Registrar cierre automático en historial
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'status_changed',
          field: 'status',
          oldValue: 'RESOLVED',
          newValue: 'CLOSED',
          comment: 'Ticket cerrado automáticamente tras calificación del cliente',
          ticketId,
          userId: session.user.id,
          createdAt: new Date(),
        },
      })

      // Notificar al técnico que el ticket fue cerrado
      if (ticket.assigneeId) {
        await prisma.notifications.create({
          data: {
            id: randomUUID(),
            title: 'Ticket cerrado por calificación',
            message: `El cliente calificó y cerró el ticket: "${ticket.title}". Ahora puedes promoverlo a artículo de conocimiento.`,
            type: 'SUCCESS',
            userId: ticket.assigneeId,
            ticketId,
            isRead: false,
          },
        })
      }
    }

    // Notificar al administrador sobre la nueva calificación
    const { triggerRatingToAdminEmail } = await import('@/lib/email-triggers')
    triggerRatingToAdminEmail(ticketId, data.overall)

    return NextResponse.json(rating, { status: 201 })
  } catch (error) {
    console.error('Error al calificar ticket:', error)
    return NextResponse.json(
      { error: 'Error al calificar ticket' },
      { status: 500 }
    )
  }
}

// GET /api/tickets/[id]/rate - Obtener calificación del ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id: ticketId } = await params

    const rating = await prisma.ticket_ratings.findUnique({
      where: { ticketId },
      include: {
        users_ticket_ratings_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        users_ticket_ratings_technicianIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!rating) {
      return NextResponse.json(
        { error: 'Calificación no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(rating)
  } catch (error) {
    console.error('Error al obtener calificación:', error)
    return NextResponse.json(
      { error: 'Error al obtener calificación' },
      { status: 500 }
    )
  }
}
