import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const ratingSchema = z.object({
  rating: z.number().min(1).max(5),
  feedback: z.string().optional(),
  categories: z.object({
    responseTime: z.number().min(0).max(5),
    technicalSkill: z.number().min(0).max(5),
    communication: z.number().min(0).max(5),
    problemResolution: z.number().min(0).max(5),
  }),
})

/**
 * GET /api/tickets/[id]/rating
 * Obtiene la calificación de un ticket
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
    const isClient = ticket.clientId === session.user.id
    const isTechnician = ticket.assigneeId === session.user.id

    if (!isAdmin && !isClient && !isTechnician) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para ver esta calificación' },
        { status: 403 }
      )
    }

    // Obtener calificación
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
      return NextResponse.json({
        success: true,
        data: null,
      })
    }

    // Formatear respuesta
    const formattedRating = {
      id: rating.id,
      ticketId: rating.ticketId,
      rating: rating.rating,
      feedback: rating.feedback,
      categories: {
        responseTime: rating.responseTime,
        technicalSkill: rating.technicalSkill,
        communication: rating.communication,
        problemResolution: rating.problemResolution,
      },
      client: {
        id: rating.users_ticket_ratings_clientIdTousers.id,
        name: rating.users_ticket_ratings_clientIdTousers.name,
        email: rating.users_ticket_ratings_clientIdTousers.email,
      },
      technician: rating.users_ticket_ratings_technicianIdTousers
        ? {
            id: rating.users_ticket_ratings_technicianIdTousers.id,
            name: rating.users_ticket_ratings_technicianIdTousers.name,
            email: rating.users_ticket_ratings_technicianIdTousers.email,
          }
        : null,
      createdAt: rating.createdAt.toISOString(),
      isPublic: rating.isPublic,
    }

    return NextResponse.json({
      success: true,
      data: formattedRating,
    })
  } catch (error) {
    console.error('[API-RATING] GET Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener la calificación' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tickets/[id]/rating
 * Crea una calificación para un ticket
 */
export async function POST(
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
    const body = await request.json()

    // Validar datos
    const validation = ratingSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const data = validation.data

    // Verificar que el ticket existe y obtener información
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        status: true,
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

    // Solo el cliente puede calificar su propio ticket
    if (ticket.clientId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Solo el cliente puede calificar este ticket' },
        { status: 403 }
      )
    }

    // Solo se puede calificar tickets cerrados o resueltos
    if (ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Solo puedes calificar tickets que han sido cerrados o resueltos',
        },
        { status: 400 }
      )
    }

    // Verificar si ya existe una calificación
    const existingRating = await prisma.ticket_ratings.findUnique({
      where: { ticketId },
    })

    if (existingRating) {
      return NextResponse.json(
        { success: false, error: 'Este ticket ya ha sido calificado' },
        { status: 400 }
      )
    }

    // Crear calificación
    const rating = await prisma.ticket_ratings.create({
      data: {
        id: randomUUID(),
        ticketId,
        clientId: session.user.id,
        technicianId: ticket.assigneeId,
        rating: data.rating,
        feedback: data.feedback || null,
        responseTime: data.categories.responseTime,
        technicalSkill: data.categories.technicalSkill,
        communication: data.categories.communication,
        problemResolution: data.categories.problemResolution,
        isPublic: true,
        updatedAt: new Date(),
      },
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

    console.log('[RATING] Nueva calificación creada:', {
      ticketId,
      rating: data.rating,
      client: session.user.name,
    })

    // Cerrar ticket automáticamente tras la calificación del cliente
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

      // Notificar al técnico que el ticket fue cerrado y puede promoverlo a artículo
      if (ticket.assigneeId) {
        await prisma.notifications.create({
          data: {
            id: randomUUID(),
            title: 'Ticket cerrado por calificación',
            message: `El cliente calificó y cerró el ticket: "${ticket.title}" con ${data.rating} estrellas. Ahora puedes promoverlo a artículo de conocimiento.`,
            type: 'SUCCESS',
            userId: ticket.assigneeId,
            ticketId,
            isRead: false,
          },
        })
      }

      console.log('[RATING] Ticket cerrado automáticamente tras calificación:', ticketId)
    }

    // Notificar al administrador sobre la nueva calificación
    const { triggerRatingToAdminEmail } = await import('@/lib/email-triggers')
    triggerRatingToAdminEmail(ticketId, data.rating)

    // Formatear respuesta
    const formattedRating = {
      id: rating.id,
      ticketId: rating.ticketId,
      rating: rating.rating,
      feedback: rating.feedback,
      categories: {
        responseTime: rating.responseTime,
        technicalSkill: rating.technicalSkill,
        communication: rating.communication,
        problemResolution: rating.problemResolution,
      },
      client: {
        id: rating.users_ticket_ratings_clientIdTousers.id,
        name: rating.users_ticket_ratings_clientIdTousers.name,
        email: rating.users_ticket_ratings_clientIdTousers.email,
      },
      technician: rating.users_ticket_ratings_technicianIdTousers
        ? {
            id: rating.users_ticket_ratings_technicianIdTousers.id,
            name: rating.users_ticket_ratings_technicianIdTousers.name,
            email: rating.users_ticket_ratings_technicianIdTousers.email,
          }
        : null,
      createdAt: rating.createdAt.toISOString(),
      isPublic: rating.isPublic,
    }

    return NextResponse.json({
      success: true,
      message: 'Calificación creada exitosamente',
      data: formattedRating,
    })
  } catch (error) {
    console.error('[API-RATING] POST Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear la calificación' },
      { status: 500 }
    )
  }
}
