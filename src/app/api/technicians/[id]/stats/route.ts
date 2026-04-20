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

    const technicianId = (await params).id

    // Verificar que el técnico existe
    const technician = await prisma.users.findUnique({
      where: { 
        id: technicianId,
        role: 'TECHNICIAN'
      }
    })

    if (!technician) {
      return NextResponse.json(
        { success: false, message: 'Técnico no encontrado' },
        { status: 404 }
      )
    }

    // Obtener todas las calificaciones del técnico
    const ratings = await (prisma.ticket_ratings.findMany as any)({
      where: {
        tickets: {
          assigneeId: technicianId
        }
      },
      include: {
        tickets: {
          select: {
            id: true,
            title: true,
            createdAt: true
          }
        },
        users: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calcular estadísticas
    const totalRatings = ratings.length
    
    if (totalRatings === 0) {
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

    // Calcular promedios
    const sumResponseTime = (ratings as any[]).reduce((sum: number, r: any) => sum + r.responseTime, 0)
    const sumTechnicalSkill = (ratings as any[]).reduce((sum: number, r: any) => sum + r.technicalSkill, 0)
    const sumCommunication = (ratings as any[]).reduce((sum: number, r: any) => sum + r.communication, 0)
    const sumProblemResolution = (ratings as any[]).reduce((sum: number, r: any) => sum + r.problemResolution, 0)

    const avgResponseTime = sumResponseTime / totalRatings
    const avgTechnicalSkill = sumTechnicalSkill / totalRatings
    const avgCommunication = sumCommunication / totalRatings
    const avgProblemResolution = sumProblemResolution / totalRatings

    // Promedio general
    const averageRating = (avgResponseTime + avgTechnicalSkill + avgCommunication + avgProblemResolution) / 4

    // Formatear calificaciones recientes (últimas 5)
    const recentRatings = (ratings as any[]).slice(0, 5).map((rating: any) => ({
      id: rating.id,
      ticketId: rating.ticketId,
      clientId: rating.clientId,
      responseTime: rating.responseTime,
      technicalSkill: rating.technicalSkill,
      communication: rating.communication,
      problemResolution: rating.problemResolution,
      comment: rating.comment,
      createdAt: rating.createdAt,
      client: rating.users,
      ticket: rating.tickets
    }))

    return NextResponse.json({
      success: true,
      data: {
        averageRating: Math.round(averageRating * 10) / 10, // Redondear a 1 decimal
        totalRatings,
        categoryAverages: {
          responseTime: Math.round(avgResponseTime * 10) / 10,
          technicalSkill: Math.round(avgTechnicalSkill * 10) / 10,
          communication: Math.round(avgCommunication * 10) / 10,
          problemResolution: Math.round(avgProblemResolution * 10) / 10
        },
        recentRatings
      }
    })
  } catch (error) {
    console.error('[CRITICAL] Error fetching technician stats:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al obtener estadísticas del técnico',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
