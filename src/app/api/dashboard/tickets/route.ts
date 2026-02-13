import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = session.user.role
    const userId = session.user.id
    const limit = parseInt(searchParams.get('limit') || '5')

    const where: any = {}

    // Filtrar tickets según el rol
    if (role === 'TECHNICIAN') {
      where.assigneeId = userId
    } else if (role === 'CLIENT') {
      where.clientId = userId
    }
    // Para ADMIN, mostrar todos los tickets

    const tickets = await prisma.tickets.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: 'desc' }, // Cambiado a updatedAt para mostrar actividad reciente
      include: {
        users_tickets_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        users_tickets_assigneeIdTousers: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        categories: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        _count: {
          select: {
            comments: true,
            attachments: true
          }
        },
        comments: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            users: {
              select: { id: true }
            }
          }
        }
      }
    })

    // Formatear los tickets para el frontend con información más rica
    const formattedTickets = tickets.map(ticket => {
      const lastComment = ticket.comments[0]
      const hasUnreadMessages = lastComment && 
        lastComment.users?.id !== userId && 
        lastComment.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24h
      
      return {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description?.substring(0, 100) + (ticket.description?.length > 100 ? '...' : ''),
        priority: ticket.priority,
        status: ticket.status,
        client: ticket.users_tickets_clientIdTousers?.name || 'Sin cliente',
        clientEmail: ticket.users_tickets_clientIdTousers?.email,
        assignee: ticket.users_tickets_assigneeIdTousers?.name || 'Sin asignar',
        assigneeEmail: ticket.users_tickets_assigneeIdTousers?.email,
        category: ticket.categories?.name || 'Sin categoría',
        categoryColor: ticket.categories?.color || '#6B7280',
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        resolvedAt: ticket.resolvedAt?.toISOString(),
        timeElapsed: getTimeElapsed(ticket.createdAt),
        timeSinceUpdate: getTimeElapsed(ticket.updatedAt),
        hasUnreadMessages,
        commentCount: ticket._count?.comments || 0,
        attachmentCount: ticket._count?.attachments || 0,
        isOverdue: isTicketOverdue(ticket.createdAt, ticket.priority, ticket.status),
        urgencyLevel: calculateUrgencyLevel(ticket.priority, ticket.createdAt, ticket.status)
      }
    })

    const total = await prisma.tickets.count({ where })

    // Estadísticas adicionales por rol
    let additionalStats = {}
    if (role === 'ADMIN') {
      const [pendingAssignment, overdueTickets] = await Promise.all([
        prisma.tickets.count({ where: { assigneeId: null, status: 'OPEN' } }),
        prisma.tickets.count({ 
          where: { 
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          } 
        })
      ])
      
      additionalStats = { pendingAssignment, overdueTickets }
    }

    return NextResponse.json({
      tickets: formattedTickets,
      total,
      ...additionalStats
    })
  } catch (error) {
    console.error('Error fetching dashboard tickets:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

function getTimeElapsed(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}min`
  if (minutes > 0) return `${minutes}min`
  return 'Ahora'
}

function isTicketOverdue(createdAt: Date, priority: string, status: string): boolean {
  if (status === 'RESOLVED' || status === 'CLOSED') return false
  
  const now = new Date()
  const diff = now.getTime() - createdAt.getTime()
  const hours = diff / (1000 * 60 * 60)
  
  // SLA basado en prioridad
  const slaHours = {
    'HIGH': 4,
    'MEDIUM': 24,
    'LOW': 72
  }
  
  return hours > (slaHours[priority as keyof typeof slaHours] || 24)
}

function calculateUrgencyLevel(priority: string, createdAt: Date, status: string): 'low' | 'medium' | 'high' | 'critical' {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'low'
  
  const isOverdue = isTicketOverdue(createdAt, priority, status)
  
  if (priority === 'HIGH' && isOverdue) return 'critical'
  if (priority === 'HIGH') return 'high'
  if (priority === 'MEDIUM' && isOverdue) return 'high'
  if (priority === 'MEDIUM') return 'medium'
  if (isOverdue) return 'medium'
  
  return 'low'
}
