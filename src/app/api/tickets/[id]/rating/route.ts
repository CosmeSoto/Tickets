import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'

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

    if (!ticketId) {
      return NextResponse.json(
        { success: false, message: 'ID de ticket requerido' },
        { status: 400 }
      )
    }

    // Verificar que el ticket existe
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: { id: true, clientId: true, assigneeId: true }
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
        { success: false, message: 'No tienes permisos para ver esta calificación' },
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
            email: true
          }
        },
        users_ticket_ratings_technicianIdTousers: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!rating) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No hay calificación para este ticket'
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
        problemResolution: rating.problemResolution
      },
      client: rating.users_ticket_ratings_clientIdTousers,
      technician: rating.users_ticket_ratings_technicianIdTousers,
      createdAt: rating.createdAt.toISOString(),
      isPublic: rating.isPublic
    }

    return NextResponse.json({
      success: true,
      data: formattedRating
    })
  } catch (error) {
    console.error('Error fetching ticket rating:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar la calificación',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function POST(
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
    const body = await request.json()

    if (!ticketId) {
      return NextResponse.json(
        { success: false, message: 'ID de ticket requerido' },
        { status: 400 }
      )
    }

    // Validar datos de entrada
    const { rating, feedback, categories } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: 'Calificación debe estar entre 1 y 5' },
        { status: 400 }
      )
    }

    if (!categories || 
        !categories.responseTime || !categories.technicalSkill || 
        !categories.communication || !categories.problemResolution) {
      return NextResponse.json(
        { success: false, message: 'Todas las calificaciones por categoría son requeridas' },
        { status: 400 }
      )
    }

    // Verificar que el ticket existe y está resuelto/cerrado
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: { 
        id: true, 
        clientId: true, 
        assigneeId: true, 
        status: true 
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // Solo el cliente puede calificar
    if (ticket.clientId !== session.user.id) {
      return NextResponse.json(
        { success: false, message: 'Solo el cliente puede calificar el ticket' },
        { status: 403 }
      )
    }

    // El ticket debe estar resuelto o cerrado
    if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
      return NextResponse.json(
        { success: false, message: 'Solo se pueden calificar tickets resueltos o cerrados' },
        { status: 400 }
      )
    }

    // Verificar que no existe ya una calificación
    const existingRating = await prisma.ticket_ratings.findUnique({
      where: { ticketId }
    })

    if (existingRating) {
      return NextResponse.json(
        { success: false, message: 'Este ticket ya ha sido calificado' },
        { status: 400 }
      )
    }

    // Crear calificación
    const newRating = await prisma.ticket_ratings.create({
      data: {
        id: randomUUID(),
        ticketId,
        clientId: session.user.id,
        technicianId: ticket.assigneeId,
        rating,
        feedback: feedback || null,
        responseTime: categories.responseTime,
        technicalSkill: categories.technicalSkill,
        communication: categories.communication,
        problemResolution: categories.problemResolution,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        users_ticket_ratings_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        users_ticket_ratings_technicianIdTousers: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Crear entrada en el historial
    await prisma.ticket_history.create({
      data: {
        id: randomUUID(),
        action: 'rating_added',
        comment: `Calificación agregada: ${rating}/5 estrellas`,
        ticketId,
        userId: session.user.id,
        createdAt: new Date()
      }
    })

    // Formatear respuesta
    const formattedRating = {
      id: newRating.id,
      ticketId: newRating.ticketId,
      rating: newRating.rating,
      feedback: newRating.feedback,
      categories: {
        responseTime: newRating.responseTime,
        technicalSkill: newRating.technicalSkill,
        communication: newRating.communication,
        problemResolution: newRating.problemResolution
      },
      client: newRating.users_ticket_ratings_clientIdTousers,
      technician: newRating.users_ticket_ratings_technicianIdTousers,
      createdAt: newRating.createdAt.toISOString(),
      isPublic: newRating.isPublic
    }

    return NextResponse.json({
      success: true,
      data: formattedRating,
      message: 'Calificación creada exitosamente'
    })
  } catch (error) {
    console.error('Error creating ticket rating:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear la calificación',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}