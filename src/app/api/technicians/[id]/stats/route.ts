import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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
    const technicianId = params?.id

    if (!technicianId) {
      return NextResponse.json(
        { success: false, message: 'ID de técnico requerido' },
        { status: 400 }
      )
    }

    // Verificar que el técnico existe
    const technician = await prisma.users.findUnique({
      where: { 
        id: technicianId,
        role: 'TECHNICIAN'
      },
      select: { id: true, name: true, email: true }
    })

    if (!technician) {
      return NextResponse.json(
        { success: false, message: 'Técnico no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos (solo admins o el propio técnico)
    if (session.user.role !== 'ADMIN' && session.user.id !== technicianId) {
      return NextResponse.json(
        { success: false, message: 'No tienes permisos para ver estas estadísticas' },
        { status: 403 }
      )
    }

    // Obtener todas las calificaciones del técnico
    const ratings = await prisma.ticket_ratings.findMany({
      where: { technicianId },
      include: {
        users_ticket_ratings_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        tickets: {
          select: {
            id: true,
            title: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (ratings.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          averageRating: 0,
          totalRatings: 0,
          categoryAverages: {
            responseTime: 0,
            technicalSkill: 0,
            communication: 0,
            problemResolution: 0
          },
          recentRatings: []
        }
      })
    }

    // Calcular estadísticas
    const totalRatings = ratings.length
    const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings

    const categoryAverages = {
      responseTime: ratings.reduce((sum, r) => sum + r.responseTime, 0) / totalRatings,
      technicalSkill: ratings.reduce((sum, r) => sum + r.technicalSkill, 0) / totalRatings,
      communication: ratings.reduce((sum, r) => sum + r.communication, 0) / totalRatings,
      problemResolution: ratings.reduce((sum, r) => sum + r.problemResolution, 0) / totalRatings
    }

    // Formatear calificaciones recientes
    const recentRatings = ratings.slice(0, 10).map(rating => ({
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
      createdAt: rating.createdAt.toISOString(),
      isPublic: rating.isPublic,
      ticket: {
        id: rating.tickets.id,
        title: rating.tickets.title,
        createdAt: rating.tickets.createdAt.toISOString()
      }
    }))

    const stats = {
      averageRating: Math.round(averageRating * 10) / 10, // Redondear a 1 decimal
      totalRatings,
      categoryAverages: {
        responseTime: Math.round(categoryAverages.responseTime * 10) / 10,
        technicalSkill: Math.round(categoryAverages.technicalSkill * 10) / 10,
        communication: Math.round(categoryAverages.communication * 10) / 10,
        problemResolution: Math.round(categoryAverages.problemResolution * 10) / 10
      },
      recentRatings
    }

    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error fetching technician stats:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar las estadísticas del técnico',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}