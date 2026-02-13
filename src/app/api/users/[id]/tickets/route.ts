import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Verificar permisos: ADMIN puede ver cualquier usuario, otros solo pueden ver sus propios tickets
    if (session.user.role !== 'ADMIN' && session.user.id !== userId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Obtener tickets recientes del usuario
    const tickets = await prisma.tickets.findMany({
      where: {
        OR: [
          { clientId: userId },
          { assigneeId: userId }
        ]
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        clientId: true,
        assigneeId: true,
        categories: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Formatear los tickets para el frontend
    const formattedTickets = tickets.map(ticket => ({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      resolvedAt: ticket.resolvedAt?.toISOString() || null,
      category: ticket.categories || null,
      isCreatedByUser: ticket.clientId === userId,
      isAssignedToUser: ticket.assigneeId === userId
    }))

    return NextResponse.json({
      success: true,
      data: formattedTickets,
      pagination: {
        limit,
        offset,
        total: formattedTickets.length
      }
    })

  } catch (error) {
    console.error('Error fetching user tickets:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}