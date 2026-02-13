import prisma from '@/lib/prisma'
import { TicketStatus, TicketPriority, UserRole } from '@prisma/client'
import { NotificationService } from './notification-service'
import { ApplicationLogger } from '@/lib/logging'
import { randomUUID } from 'crypto'

export interface TicketFilters {
  status?: TicketStatus
  priority?: TicketPriority
  categoryId?: string
  assigneeId?: string
  clientId?: string
  search?: string
}

export interface PaginationParams {
  page: number
  limit: number
}

export interface CreateTicketData {
  title: string
  description: string
  priority: TicketPriority
  categoryId: string
  clientId: string
}

export interface UpdateTicketData {
  title?: string
  description?: string
  priority?: TicketPriority
  status?: TicketStatus
  assigneeId?: string
  categoryId?: string
}

export class TicketService {
  static async getTickets(
    filters: TicketFilters = {},
    pagination: PaginationParams = { page: 1, limit: 10 }
  ) {
    const timer = ApplicationLogger.timer('get_tickets', {
      component: 'ticket-service',
      metadata: { filters, pagination }
    })

    try {
      ApplicationLogger.databaseOperationStart('findMany', 'tickets', {
        metadata: { filters, pagination }
      })

      const { page, limit } = pagination
      const skip = (page - 1) * limit

      const where: any = {}

      if (filters.status) where.status = filters.status
      if (filters.priority) where.priority = filters.priority
      if (filters.categoryId) where.categoryId = filters.categoryId
      if (filters.assigneeId) where.assigneeId = filters.assigneeId
      if (filters.clientId) where.clientId = filters.clientId
      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ]
      }

      const [tickets, total] = await Promise.all([
        prisma.tickets.findMany({
          where,
          include: {
            users_tickets_clientIdTousers: { select: { id: true, name: true, email: true } },
            users_tickets_assigneeIdTousers: { select: { id: true, name: true, email: true } },
            categories: { select: { id: true, name: true, color: true } },
            _count: { select: { comments: true, attachments: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.tickets.count({ where }),
      ])

      timer.end()
      ApplicationLogger.databaseOperationComplete('findMany', 'tickets', 0, tickets.length, {
        metadata: { total, pages: Math.ceil(total / limit) }
      })

      const result = {
        tickets,
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      }

      timer.end('Tickets retrieved successfully')
      return result

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      ApplicationLogger.databaseOperationError('findMany', 'tickets', err)
      timer.end('Failed to retrieve tickets')
      throw error
    }
  }

  static async getTicketById(id: string) {
    return prisma.tickets.findUnique({
      where: { id },
      include: {
        users_tickets_clientIdTousers: { select: { id: true, name: true, email: true, departmentId: true } },
        users_tickets_assigneeIdTousers: { select: { id: true, name: true, email: true, departmentId: true } },
        categories: {
          select: {
            id: true,
            name: true,
            color: true,
            level: true,
            categories: { select: { name: true } },
          },
        },
        comments: {
          include: {
            users: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          select: { id: true, filename: true, originalName: true, size: true, createdAt: true },
        },
        ticket_history: {
          include: {
            users: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
  }

  static async createTicket(data: CreateTicketData) {
    const timer = ApplicationLogger.timer('create_ticket', {
      component: 'ticket-service',
      metadata: { priority: data.priority, categoryId: data.categoryId }
    })

    try {
      ApplicationLogger.businessOperation('create_ticket', 'ticket', 'new', {
        metadata: { title: data.title, priority: data.priority }
      })

      ApplicationLogger.databaseOperationStart('create', 'tickets')

      const ticket = await prisma.tickets.create({
        data: {
          ...data,
          id: randomUUID(),
          updatedAt: new Date(),
        },
        include: {
          users_tickets_clientIdTousers: { select: { id: true, name: true, email: true } },
          categories: { select: { id: true, name: true, color: true } },
        },
      })

      ApplicationLogger.databaseOperationComplete('create', 'tickets', performance.now(), 1)

      // Crear entrada en el historial
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'created',
          comment: 'Ticket creado',
          ticketId: ticket.id,
          userId: data.clientId,
          createdAt: new Date()
        },
      })

      // Las notificaciones se generan automáticamente por el sistema unificado
      // basado en la creación del ticket y sus propiedades

      ApplicationLogger.businessOperation('ticket_created', 'ticket', ticket.id, {
        userId: data.clientId,
        metadata: { title: ticket.title, priority: ticket.priority }
      })

      timer.end('Ticket created successfully')
      return ticket

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      ApplicationLogger.databaseOperationError('create', 'tickets', err)
      timer.end('Failed to create ticket')
      throw error
    }
  }

  static async updateTicket(id: string, data: UpdateTicketData, userId: string) {
    const timer = ApplicationLogger.timer('update_ticket', {
      component: 'ticket-service',
      metadata: { ticketId: id, updates: Object.keys(data) }
    })

    try {
      ApplicationLogger.businessOperation('update_ticket', 'ticket', id, {
        userId,
        metadata: { updates: Object.keys(data) }
      })

      const currentTicket = await prisma.tickets.findUnique({ where: { id } })
      if (!currentTicket) {
        ApplicationLogger.businessOperation('ticket_not_found', 'ticket', id, { userId })
        throw new Error('Ticket no encontrado')
      }

      ApplicationLogger.databaseOperationStart('update', 'tickets')

      const ticket = await prisma.tickets.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          users_tickets_clientIdTousers: { select: { id: true, name: true, email: true } },
          users_tickets_assigneeIdTousers: { select: { id: true, name: true, email: true } },
          categories: { select: { id: true, name: true, color: true } },
        },
      })

      ApplicationLogger.databaseOperationComplete('update', 'tickets', performance.now(), 1)

      // Crear entradas en el historial para cada cambio
      const changes = []
      if (data.status && data.status !== currentTicket.status) {
        changes.push({
          id: randomUUID(),
          action: 'status_changed',
          field: 'status',
          oldValue: currentTicket.status,
          newValue: data.status,
          comment: `Estado cambiado de ${currentTicket.status} a ${data.status}`,
          ticketId: id,
          userId,
          createdAt: new Date()
        })

        ApplicationLogger.businessOperation('ticket_status_changed', 'ticket', id, {
          userId,
          metadata: { 
            oldStatus: currentTicket.status, 
            newStatus: data.status 
          }
        })

        // Las notificaciones de cambio de estado se generan automáticamente
        // por el sistema unificado basado en los cambios detectados
      }

      if (data.assigneeId && data.assigneeId !== currentTicket.assigneeId) {
        changes.push({
          id: randomUUID(),
          action: 'assigned',
          field: 'assigneeId',
          oldValue: currentTicket.assigneeId || '',
          newValue: data.assigneeId,
          comment: 'Ticket asignado',
          ticketId: id,
          userId,
          createdAt: new Date()
        })

        ApplicationLogger.businessOperation('ticket_assigned', 'ticket', id, {
          userId,
          metadata: { 
            oldAssignee: currentTicket.assigneeId, 
            newAssignee: data.assigneeId 
          }
        })

        // Las notificaciones de asignación se generan automáticamente
        // por el sistema unificado basado en los cambios detectados
      }

      if (data.priority && data.priority !== currentTicket.priority) {
        changes.push({
          id: randomUUID(),
          action: 'priority_changed',
          field: 'priority',
          oldValue: currentTicket.priority,
          newValue: data.priority,
          comment: `Prioridad cambiada de ${currentTicket.priority} a ${data.priority}`,
          ticketId: id,
          userId,
          createdAt: new Date()
        })

        ApplicationLogger.businessOperation('ticket_priority_changed', 'ticket', id, {
          userId,
          metadata: { 
            oldPriority: currentTicket.priority, 
            newPriority: data.priority 
          }
        })
      }

      if (changes.length > 0) {
        await prisma.ticket_history.createMany({ data: changes })
      }

      timer.end('Ticket updated successfully')
      return ticket

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      ApplicationLogger.databaseOperationError('update', 'tickets', err, { 
        metadata: { ticketId: id } 
      })
      timer.end('Failed to update ticket')
      throw error
    }
  }

  static async deleteTicket(id: string) {
    return prisma.tickets.delete({ where: { id } })
  }

  static async getTicketStats(userId?: string, role?: UserRole) {
    const baseWhere: any = {}

    if (role === 'CLIENT' && userId) {
      baseWhere.clientId = userId
    } else if (role === 'TECHNICIAN' && userId) {
      baseWhere.assigneeId = userId
    }

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      urgentTickets,
      todayTickets,
      thisWeekTickets,
    ] = await Promise.all([
      prisma.tickets.count({ where: baseWhere }),
      prisma.tickets.count({ where: { ...baseWhere, status: 'OPEN' } }),
      prisma.tickets.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
      prisma.tickets.count({ where: { ...baseWhere, status: 'RESOLVED' } }),
      prisma.tickets.count({ where: { ...baseWhere, status: 'CLOSED' } }),
      prisma.tickets.count({ where: { ...baseWhere, priority: 'URGENT' } }),
      prisma.tickets.count({
        where: {
          ...baseWhere,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.tickets.count({
        where: {
          ...baseWhere,
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
      }),
    ])

    // Calcular tiempo promedio de resolución
    const resolvedTicketsWithTime = await prisma.tickets.findMany({
      where: {
        ...baseWhere,
        status: 'RESOLVED',
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    })

    let avgResolutionTime = '0h'
    if (resolvedTicketsWithTime.length > 0) {
      const totalMinutes = resolvedTicketsWithTime.reduce((acc, ticket) => {
        const diff = new Date(ticket.resolvedAt!).getTime() - new Date(ticket.createdAt).getTime()
        return acc + diff / (1000 * 60) // convertir a minutos
      }, 0)

      const avgMinutes = totalMinutes / resolvedTicketsWithTime.length
      const hours = Math.floor(avgMinutes / 60)
      const minutes = Math.floor(avgMinutes % 60)
      avgResolutionTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`
    }

    return {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      urgentTickets,
      todayTickets,
      thisWeekTickets,
      avgResolutionTime,
    }
  }

  static async getRecentActivity(limit = 10) {
    const recentHistory = await prisma.ticket_history.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        tickets: { select: { id: true, title: true } },
        users: { select: { id: true, name: true } },
      },
    })

    return recentHistory.map(history => ({
      id: history.id,
      type: history.action,
      title: getActivityTitle(history.action),
      description: `${history.tickets.title} - ${history.comment || ''}`,
      time: getTimeAgo(history.createdAt),
      user: history.users.name,
      ticketId: history.tickets.id,
    }))
  }
}

function getActivityTitle(action: string): string {
  const titles: Record<string, string> = {
    created: 'Ticket creado',
    assigned: 'Ticket asignado',
    status_changed: 'Estado actualizado',
    priority_changed: 'Prioridad cambiada',
    comment_added: 'Comentario agregado',
    resolved: 'Ticket resuelto',
    closed: 'Ticket cerrado',
  }
  return titles[action] || 'Actividad'
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}min`
  return 'Ahora'
}
