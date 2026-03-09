import prisma from '@/lib/prisma'
import { NotificationType } from '@prisma/client'
import { randomUUID } from 'crypto'

export interface CreateNotificationData {
  userId: string
  type: NotificationType
  title: string
  message: string
  ticketId?: string
  metadata?: any
}

export class NotificationService {
  /**
   * Crear una notificación in-app
   */
  static async createNotification(data: CreateNotificationData) {
    try {
      const notification = await prisma.notifications.create({
        data: {
          id: randomUUID(),
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          ticketId: data.ticketId,
          metadata: data.metadata,
          isRead: false,
        },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          tickets: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      })

      return notification
    } catch (error) {
      console.error('[NOTIFICATION] Error creating notification:', error)
      throw error
    }
  }
  /**
   * Notificar cuando se crea un ticket
   * - Notifica a todos los admins
   */
  static async notifyTicketCreated(ticketId: string) {
    try {
      const ticket = await prisma.tickets.findUnique({
        where: { id: ticketId },
        include: {
          users_tickets_clientIdTousers: {
            select: { id: true, name: true, email: true },
          },
          categories: {
            select: { name: true },
          },
        },
      })

      if (!ticket) {
        throw new Error('Ticket not found')
      }

      // Obtener todos los admins
      const admins = await prisma.users.findMany({
        where: {
          role: 'ADMIN',
          isActive: true,
        },
        select: { id: true, name: true, email: true },
      })

      if (admins.length === 0) {
        return []
      }

      // Crear notificaciones para todos los admins
      const notifications = await Promise.all(
        admins.map(async (admin) => {
          return await this.createNotification({
            userId: admin.id,
            type: 'INFO',
            title: 'Nuevo ticket creado',
            message: `${ticket.users_tickets_clientIdTousers.name} ha creado el ticket "${ticket.title}"`,
            ticketId: ticket.id,
            metadata: {
              priority: ticket.priority,
              category: ticket.categories.name,
            },
          })
        })
      )

      return notifications
    } catch (error) {
      console.error('[NOTIFICATION] Error en notifyTicketCreated:', error)
      throw error
    }
  }

  /**
   * Notificar cuando se asigna un ticket a un técnico
   * - Notifica al técnico asignado
   * - Notifica al cliente
   */
  static async notifyTicketAssigned(ticketId: string, technicianId: string) {
    try {
      const ticket = await prisma.tickets.findUnique({
        where: { id: ticketId },
        include: {
          users_tickets_clientIdTousers: {
            select: { id: true, name: true, email: true },
          },
          users_tickets_assigneeIdTousers: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      if (!ticket) {
        throw new Error('Ticket not found')
      }

      const notifications = []

      // Notificar al técnico asignado
      if (ticket.users_tickets_assigneeIdTousers) {
        const techNotification = await this.createNotification({
          userId: technicianId,
          type: 'INFO',
          title: 'Nuevo ticket asignado',
          message: `Se te ha asignado el ticket "${ticket.title}"`,
          ticketId: ticket.id,
          metadata: {
            priority: ticket.priority,
            clientName: ticket.users_tickets_clientIdTousers.name,
            link: `/technician/tickets/${ticket.id}`,
          },
        })
        notifications.push(techNotification)
      }

      // Notificar al cliente
      const clientNotification = await this.createNotification({
        userId: ticket.clientId,
        type: 'SUCCESS',
        title: 'Ticket asignado',
        message: `Tu ticket "${ticket.title}" ha sido asignado a ${ticket.users_tickets_assigneeIdTousers?.name || 'un técnico'}`,
        ticketId: ticket.id,
        metadata: {
          link: `/client/tickets/${ticket.id}`,
        },
      })
      notifications.push(clientNotification)

      return notifications
    } catch (error) {
      console.error('[NOTIFICATION] Error en notifyTicketAssigned:', error)
      throw error
    }
  }

  /**
   * Notificar cuando se agrega un comentario
   * - Si el autor es técnico/admin, notifica al cliente
   * - Si el autor es cliente, notifica al técnico asignado
   */
  static async notifyNewComment(commentId: string) {
    try {
      const comment = await prisma.comments.findUnique({
        where: { id: commentId },
        include: {
          users: {
            select: { id: true, name: true, role: true },
          },
          tickets: {
            include: {
              users_tickets_clientIdTousers: {
                select: { id: true, name: true, email: true },
              },
              users_tickets_assigneeIdTousers: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      })

      if (!comment || !comment.tickets) {
        throw new Error('Comment or ticket not found')
      }

      const ticket = comment.tickets
      const author = comment.users
      const isInternalComment = comment.isInternal

      // No notificar si es comentario interno
      if (isInternalComment) {
        return []
      }

      const notifications = []

      // Si el autor es técnico/admin, notificar al cliente
      if (author.role === 'TECHNICIAN' || author.role === 'ADMIN') {
        const clientNotification = await this.createNotification({
          userId: ticket.clientId,
          type: 'INFO',
          title: 'Nueva respuesta en tu ticket',
          message: `${author.name} ha respondido en el ticket "${ticket.title}"`,
          ticketId: ticket.id,
        })
        notifications.push(clientNotification)
      }

      // Si el autor es cliente, notificar al técnico asignado
      if (author.role === 'CLIENT' && ticket.assigneeId) {
        const techNotification = await this.createNotification({
          userId: ticket.assigneeId,
          type: 'INFO',
          title: 'Nueva respuesta del cliente',
          message: `${author.name} ha respondido en el ticket "${ticket.title}"`,
          ticketId: ticket.id,
        })
        notifications.push(techNotification)
      }

      return notifications
    } catch (error) {
      console.error('Error notifying new comment:', error)
      throw error
    }
  }

  /**
   * Notificar cuando se resuelve un ticket
   * - Notifica al cliente
   */
  static async notifyTicketResolved(ticketId: string) {
    try {
      const ticket = await prisma.tickets.findUnique({
        where: { id: ticketId },
        include: {
          users_tickets_clientIdTousers: {
            select: { id: true, name: true, email: true },
          },
          users_tickets_assigneeIdTousers: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      if (!ticket) {
        throw new Error('Ticket not found')
      }

      // Notificar al cliente
      const notification = await this.createNotification({
        userId: ticket.clientId,
        type: 'SUCCESS',
        title: 'Ticket resuelto',
        message: `Tu ticket "${ticket.title}" ha sido marcado como resuelto`,
        ticketId: ticket.id,
      })

      return notification
    } catch (error) {
      console.error('Error notifying ticket resolved:', error)
      throw error
    }
  }

  /**
   * Obtener notificaciones de un usuario
   */
  static async getUserNotifications(userId: string, limit = 50) {
    try {
      const notifications = await prisma.notifications.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          tickets: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      })

      return notifications
    } catch (error) {
      console.error('Error getting user notifications:', error)
      throw error
    }
  }

  /**
   * Obtener contador de notificaciones no leídas
   */
  static async getUnreadCount(userId: string) {
    try {
      const count = await prisma.notifications.count({
        where: {
          userId,
          isRead: false,
        },
      })

      return count
    } catch (error) {
      console.error('Error getting unread count:', error)
      throw error
    }
  }

  /**
   * Marcar notificación como leída
   */
  static async markAsRead(notificationId: string) {
    try {
      const notification = await prisma.notifications.update({
        where: { id: notificationId },
        data: { isRead: true },
      })

      return notification
    } catch (error) {
      console.error('Error marking notification as read:', error)
      throw error
    }
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  static async markAllAsRead(userId: string) {
    try {
      const result = await prisma.notifications.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: { isRead: true },
      })

      return result
    } catch (error) {
      console.error('Error marking all as read:', error)
      throw error
    }
  }
}

// Export del tipo Notification para uso en componentes
export type Notification = {
  id: string
  title: string
  message: string
  type: NotificationType
  userId: string
  ticketId: string | null
  isRead: boolean
  metadata: any
  createdAt: Date
  updatedAt: Date
  actionUrl?: string // Campo virtual para compatibilidad
  actionText?: string // Campo virtual para compatibilidad
  tickets?: {
    id: string
    title: string
    status: string
  } | null
}
