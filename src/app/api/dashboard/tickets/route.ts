import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getSlaCountdown } from '@/lib/tickets/sla-countdown'

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

    const where: Record<string, unknown> = {}

    // Filtrar tickets según el rol
    if (role === 'TECHNICIAN') {
      where.assigneeId = userId
    } else if (role === 'CLIENT') {
      where.clientId = userId
    } else if (role === 'ADMIN') {
      const { getAdminTicketFamilyFilter } = await import('@/lib/auth/admin-scope')
      Object.assign(
        where,
        await getAdminTicketFamilyFilter(
          userId,
          (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
        )
      )
    }

    // Excluir tickets cuya categoría ya no existe en la BD (puede ocurrir tras restore parcial).
    // Usamos categoryId: { in: [...] } con las categorías reales para no alterar
    // el tipo inferido de Prisma (categories:{ isNot:null } lo cambia a base model).
    const validCategoryIds = await prisma.categories
      .findMany({
        where: { isActive: true },
        select: { id: true },
      })
      .then(cats => cats.map(c => c.id))

    const tickets = await prisma.tickets.findMany({
      where: {
        ...where,
        ...(validCategoryIds.length > 0 ? { categoryId: { in: validCategoryIds } } : {}),
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        users_tickets_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        users_tickets_assigneeIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        categories: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
          },
        },
        comments: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            users: {
              select: { id: true },
            },
          },
        },
      },
    })

    // Formatear los tickets para el frontend con información más rica
    const formattedTickets = tickets.map(ticket => {
      const lastComment = ticket.comments[0]
      const hasUnreadMessages =
        lastComment &&
        lastComment.users?.id !== userId &&
        lastComment.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24h

      return {
        id: ticket.id,
        title: ticket.title,
        description:
          ticket.description?.substring(0, 100) + (ticket.description?.length > 100 ? '...' : ''),
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
        isOverdue: isTicketOverdue(ticket.slaDeadline, ticket.status),
        urgencyLevel: calculateUrgencyLevel(ticket.priority, ticket.slaDeadline, ticket.status),
      }
    })

    const total = await prisma.tickets.count({ where })

    // Estadísticas adicionales por rol
    let additionalStats = {}
    if (role === 'ADMIN') {
      const { getAdminTicketFamilyFilter } = await import('@/lib/auth/admin-scope')
      const familyFilter = await getAdminTicketFamilyFilter(
        userId,
        (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
      )
      const [pendingAssignment, overdueTickets] = await Promise.all([
        prisma.tickets.count({ where: { assigneeId: null, status: 'OPEN', ...familyFilter } }),
        // Vencido según el SLA real configurado (sla_policies), no un proxy
        // fijo de "abierto hace más de 24h" ciego a la prioridad/categoría.
        prisma.tickets.count({
          where: {
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            slaDeadline: { lt: new Date() },
            ...familyFilter,
          },
        }),
      ])

      additionalStats = { pendingAssignment, overdueTickets }
    }

    return NextResponse.json({
      tickets: formattedTickets,
      total,
      ...additionalStats,
    })
  } catch (error) {
    console.error('[/api/dashboard/tickets] Error:', error)
    // Devolver array vacío en vez de 500 para no romper el dashboard
    return NextResponse.json({ tickets: [] })
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

/**
 * Vencido según el `slaDeadline` real del ticket (SLAService, basado en
 * `sla_policies`) — antes usaba una tabla de horas fija por prioridad
 * (4h/24h/72h, sin URGENT) que ignoraba la política real configurada.
 */
function isTicketOverdue(slaDeadline: Date | null, status: string): boolean {
  if (status === 'RESOLVED' || status === 'CLOSED') return false
  if (!slaDeadline) return false
  return new Date() > slaDeadline
}

function calculateUrgencyLevel(
  priority: string,
  slaDeadline: Date | null,
  status: string
): 'low' | 'medium' | 'high' | 'critical' {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'low'

  const sla = getSlaCountdown(slaDeadline, null)
  const isHighPriority = priority === 'HIGH' || priority === 'URGENT'

  if (sla.urgency === 'overdue') return isHighPriority ? 'critical' : 'high'
  if (sla.urgency === 'warning') return isHighPriority ? 'high' : 'medium'
  return isHighPriority ? 'medium' : 'low'
}
