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

    // Verificar permisos: ADMIN puede ver cualquier usuario, otros solo pueden ver sus propias estadísticas
    if (session.user.role !== 'ADMIN' && session.user.id !== userId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    // Obtener estadísticas básicas del usuario
    const [
      totalTickets,
      tickets_tickets_createdByIdTousers,
      tickets_tickets_assigneeIdTousers,
      thisMonthTickets,
      lastMonthTickets,
      resolvedTickets
    ] = await Promise.all([
      // Total de tickets relacionados con el usuario
      prisma.tickets.count({
        where: {
          OR: [
            { clientId: userId },
            { assigneeId: userId }
          ]
        }
      }),

      // Tickets creados por el usuario (como cliente)
      prisma.tickets.count({
        where: { clientId: userId }
      }),

      // Tickets asignados al usuario (como técnico)
      prisma.tickets.count({
        where: { assigneeId: userId }
      }),

      // Tickets de este mes
      prisma.tickets.count({
        where: {
          OR: [
            { clientId: userId },
            { assigneeId: userId }
          ],
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),

      // Tickets del mes pasado
      prisma.tickets.count({
        where: {
          OR: [
            { clientId: userId },
            { assigneeId: userId }
          ],
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),

      // Tickets resueltos para calcular tiempo promedio
      prisma.tickets.findMany({
        where: {
          OR: [
            { clientId: userId },
            { assigneeId: userId }
          ],
          status: {
            in: ['RESOLVED', 'CLOSED']
          },
          resolvedAt: {
            not: null
          }
        },
        select: {
          createdAt: true,
          resolvedAt: true
        }
      })
    ])

    // Obtener distribución por estado
    const ticketsByStatus = await prisma.tickets.groupBy({
      by: ['status'],
      where: {
        OR: [
          { clientId: userId },
          { assigneeId: userId }
        ]
      },
      _count: {
        id: true
      }
    })

    // Obtener distribución por prioridad
    const ticketsByPriority = await prisma.tickets.groupBy({
      by: ['priority'],
      where: {
        OR: [
          { clientId: userId },
          { assigneeId: userId }
        ]
      },
      _count: {
        id: true
      }
    })

    // Procesar estadísticas por estado
    const byStatus = {
      OPEN: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0
    }

    ticketsByStatus.forEach(item => {
      byStatus[item.status as keyof typeof byStatus] = item._count.id
    })

    // Procesar estadísticas por prioridad
    const byPriority = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0
    }

    ticketsByPriority.forEach(item => {
      byPriority[item.priority as keyof typeof byPriority] = item._count.id
    })

    // Calcular tiempo promedio de resolución
    let avgResolutionTime = 0
    if (resolvedTickets.length > 0) {
      const totalResolutionTime = resolvedTickets.reduce((sum, ticket) => {
        if (ticket.resolvedAt && ticket.createdAt) {
          const resolutionTime = ticket.resolvedAt.getTime() - ticket.createdAt.getTime()
          return sum + (resolutionTime / (1000 * 60 * 60)) // Convertir a horas
        }
        return sum
      }, 0)
      avgResolutionTime = totalResolutionTime / resolvedTickets.length
    }

    // Calcular tendencia
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (thisMonthTickets > lastMonthTickets) {
      trend = 'up'
    } else if (thisMonthTickets < lastMonthTickets) {
      trend = 'down'
    }

    const stats = {
      total: totalTickets,
      created: tickets_tickets_createdByIdTousers,
      assigned: tickets_tickets_assigneeIdTousers,
      byStatus,
      byPriority,
      avgResolutionTime: avgResolutionTime,
      thisMonth: thisMonthTickets,
      lastMonth: lastMonthTickets,
      trend
    }

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('Error fetching user stats:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}