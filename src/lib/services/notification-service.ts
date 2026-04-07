import prisma from '@/lib/prisma'
import { NotificationType } from '@prisma/client'
import { randomUUID } from 'crypto'
import { NotificationEvents } from '@/lib/notification-events'

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
   * Verificar si se debe enviar una notificación según las preferencias del usuario
   */
  private static async shouldNotify(
    userId: string,
    notificationType: 'push' | 'email',
    specificType?: 'ticketCreated' | 'ticketAssigned' | 'statusChanged' | 'newComments' | 'ticketUpdates'
  ): Promise<boolean> {
    try {
      const prefs = await prisma.user_settings.findUnique({
        where: { userId },
        select: {
          emailNotifications: true,
          pushNotifications: true,
          ticketCreated: true,
          ticketAssigned: true,
          statusChanged: true,
          newComments: true,
          ticketUpdated: true,
          quietHoursEnabled: true,
          quietHoursStart: true,
          quietHoursEnd: true,
        }
      })

      // Si no hay preferencias, crear defaults y enviar
      if (!prefs) {
        // Crear settings por defecto en background (no bloquear)
        prisma.user_settings.upsert({
          where: { userId },
          update: {},
          create: {
            id: randomUUID(),
            userId,
            emailNotifications: true,
            pushNotifications: true,
            ticketCreated: true,
            ticketAssigned: true,
            statusChanged: true,
            newComments: true,
            ticketUpdated: true,
            ticketUpdates: true,
            systemAlerts: true,
            weeklyReport: false,
            soundEnabled: true,
            quietHoursEnabled: false,
            quietHoursStart: '22:00',
            quietHoursEnd: '08:00',
            autoAssignEnabled: true,
            maxConcurrentTickets: 10,
            theme: 'light',
            language: 'es',
            timezone: 'America/Guayaquil',
            updatedAt: new Date(),
          }
        }).catch(err => console.error('[NOTIFICATION] Error creating default settings:', err))
        return true
      }

      // Verificar horarios silenciosos
      if (prefs.quietHoursEnabled && prefs.quietHoursStart && prefs.quietHoursEnd) {
        const now = new Date()
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        
        // Comparar horarios
        if (prefs.quietHoursStart <= prefs.quietHoursEnd) {
          // Rango normal (ej: 22:00 - 08:00 del día siguiente)
          if (currentTime >= prefs.quietHoursStart && currentTime <= prefs.quietHoursEnd) {
            return false
          }
        } else {
          // Rango que cruza medianoche (ej: 22:00 - 08:00)
          if (currentTime >= prefs.quietHoursStart || currentTime <= prefs.quietHoursEnd) {
            return false
          }
        }
      }

      // Verificar tipo de notificación general
      if (notificationType === 'push' && !prefs.pushNotifications) {
        return false
      }

      if (notificationType === 'email' && !prefs.emailNotifications) {
        return false
      }

      // Verificar tipo específico
      if (specificType) {
        switch (specificType) {
          case 'ticketCreated':
            if (!prefs.ticketCreated) {
              return false
            }
            break
          case 'ticketAssigned':
            if (!prefs.ticketAssigned) {
              return false
            }
            break
          case 'statusChanged':
            if (!prefs.statusChanged) {
              return false
            }
            break
          case 'newComments':
            if (!prefs.newComments) {
              return false
            }
            break
          case 'ticketUpdates':
            if (!prefs.ticketUpdated) {
              return false
            }
            break
        }
      }

      return true
    } catch (error) {
      console.error('[NOTIFICATION] Error checking preferences:', error)
      return true // En caso de error, enviar por defecto para no bloquear notificaciones críticas
    }
  }

  /**
   * Enviar notificación directa sin verificar preferencias (para eventos de sistema:
   * inventario, mantenimiento, actas, etc.). Siempre guarda en BD y emite por SSE.
   */
  static async push(data: CreateNotificationData) {
    try {
      const notification = await prisma.notifications.create({
        data: {
          id: randomUUID(),
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          ticketId: data.ticketId ?? null,
          metadata: data.metadata ?? null,
          isRead: false,
        },
      })

      NotificationEvents.emit(data.userId, {
        type: 'new_notification',
        notification: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          notificationType: notification.type,
          ticketId: notification.ticketId,
          isRead: false,
          createdAt: notification.createdAt,
          metadata: notification.metadata,
        },
      })

      return notification
    } catch (error) {
      console.error('[NOTIFICATION] Error en push:', error)
      return null
    }
  }

  /**
   * Crear una notificación in-app (con verificación de preferencias)
   */
  static async createNotification(data: CreateNotificationData & { specificType?: 'ticketCreated' | 'ticketAssigned' | 'statusChanged' | 'newComments' | 'ticketUpdates' }) {
    try {
      // Verificar si el usuario quiere notificaciones push
      const shouldSend = await this.shouldNotify(data.userId, 'push', data.specificType)
      
      if (!shouldSend) {
        return null
      }

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
            select: { id: true, name: true, email: true },
          },
          tickets: {
            select: { id: true, title: true },
          },
        },
      })

      // Empujar al cliente vía SSE — inmediato, sin polling
      NotificationEvents.emit(data.userId, {
        type: 'new_notification',
        notification: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          notificationType: notification.type,
          ticketId: notification.ticketId,
          isRead: false,
          createdAt: notification.createdAt,
          metadata: notification.metadata,
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
   * - Notifica a técnicos activos asignados a la familia del ticket
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
        where: { role: 'ADMIN', isActive: true },
        select: { id: true, name: true, email: true },
      })

      // Obtener técnicos de la familia del ticket (si aplica)
      const technicianWhere: any = { role: 'TECHNICIAN', isActive: true }
      if (ticket.familyId) {
        technicianWhere.technicianFamilyAssignments = {
          some: { familyId: ticket.familyId, isActive: true },
        }
      }
      const technicians = await prisma.users.findMany({
        where: technicianWhere,
        select: { id: true, name: true, email: true },
      })

      // Deduplicar: excluir al técnico ya asignado (recibirá notificación específica de asignación)
      const assignedTechId = ticket.assigneeId
      const uniqueRecipients = [...admins, ...technicians].filter(
        (r, idx, arr) =>
          arr.findIndex(x => x.id === r.id) === idx && // dedup por id
          r.id !== ticket.clientId && // no notificar al cliente que creó el ticket
          r.id !== assignedTechId // el técnico asignado recibe notif de asignación, no esta
      )

      if (uniqueRecipients.length === 0) return []

      const notifications = await Promise.all(
        uniqueRecipients.map(recipient =>
          this.createNotification({
            userId: recipient.id,
            type: 'INFO',
            title: 'Nuevo ticket creado',
            message: `${ticket.users_tickets_clientIdTousers.name} ha creado el ticket "${ticket.title}"`,
            ticketId: ticket.id,
            specificType: 'ticketCreated',
            metadata: {
              priority: ticket.priority,
              category: ticket.categories.name,
              familyId: ticket.familyId,
            },
          })
        )
      )

      return notifications
    } catch (error) {
      console.error('[NOTIFICATION] Error en notifyTicketCreated:', error)
      throw error
    }
  }

  /**
   * Notificar cuando un ticket cambia de familia
   * - Notifica al cliente del ticket
   * - Notifica al técnico asignado (si existe)
   * - Notifica a todos los admins activos
   */
  static async notifyFamilyChange(
    ticketId: string,
    oldFamilyId: string,
    newFamilyId: string
  ): Promise<void> {
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

      // Obtener nombres de las familias anterior y nueva
      const [oldFamily, newFamily] = await Promise.all([
        prisma.families.findUnique({ where: { id: oldFamilyId }, select: { name: true } }),
        prisma.families.findUnique({ where: { id: newFamilyId }, select: { name: true } }),
      ])

      const oldFamilyName = oldFamily?.name ?? oldFamilyId
      const newFamilyName = newFamily?.name ?? newFamilyId

      const title = 'Familia del ticket actualizada'
      const message = `El ticket "${ticket.title}" ha sido movido de la familia "${oldFamilyName}" a "${newFamilyName}"`

      const recipientIds: string[] = []

      // Cliente del ticket
      recipientIds.push(ticket.clientId)

      // Técnico asignado (si existe y es diferente al cliente)
      if (ticket.assigneeId && ticket.assigneeId !== ticket.clientId) {
        recipientIds.push(ticket.assigneeId)
      }

      // Todos los admins activos
      const admins = await prisma.users.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      })
      for (const admin of admins) {
        if (!recipientIds.includes(admin.id)) {
          recipientIds.push(admin.id)
        }
      }

      await Promise.all(
        recipientIds.map((userId) =>
          this.createNotification({
            userId,
            type: NotificationType.TICKET_FAMILY_CHANGE,
            title,
            message,
            ticketId: ticket.id,
            metadata: {
              oldFamilyId,
              newFamilyId,
              oldFamilyName,
              newFamilyName,
            },
          })
        )
      )
    } catch (error) {
      console.error('[NOTIFICATION] Error en notifyFamilyChange:', error)
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
          specificType: 'ticketAssigned',
          metadata: {
            priority: ticket.priority,
            clientName: ticket.users_tickets_clientIdTousers.name,
            link: `/technician/tickets/${ticket.id}`,
          },
        })
        if (techNotification) {
          notifications.push(techNotification)
        }
      } else {
        // Fallback: usar technicianId directamente si el include no cargó el técnico
        const techNotification = await this.createNotification({
          userId: technicianId,
          type: 'INFO',
          title: 'Nuevo ticket asignado',
          message: `Se te ha asignado el ticket "${ticket.title}"`,
          ticketId: ticket.id,
          specificType: 'ticketAssigned',
          metadata: {
            priority: ticket.priority,
            clientName: ticket.users_tickets_clientIdTousers.name,
            link: `/technician/tickets/${ticket.id}`,
          },
        })
        if (techNotification) {
          notifications.push(techNotification)
        }
      }

      // Notificar al cliente
      const clientNotification = await this.createNotification({
        userId: ticket.clientId,
        type: 'SUCCESS',
        title: 'Ticket asignado',
        message: `Tu ticket "${ticket.title}" ha sido asignado a ${ticket.users_tickets_assigneeIdTousers?.name || 'un técnico'}`,
        ticketId: ticket.id,
        specificType: 'ticketAssigned',
        metadata: {
          link: `/client/tickets/${ticket.id}`,
        },
      })
      if (clientNotification) notifications.push(clientNotification)

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
          specificType: 'newComments',
        })
        if (clientNotification) notifications.push(clientNotification)
      }

      // Si el autor es cliente, notificar al técnico asignado
      if (author.role === 'CLIENT' && ticket.assigneeId) {
        const techNotification = await this.createNotification({
          userId: ticket.assigneeId,
          type: 'INFO',
          title: 'Nueva respuesta del cliente',
          message: `${author.name} ha respondido en el ticket "${ticket.title}"`,
          ticketId: ticket.id,
          specificType: 'newComments',
        })
        if (techNotification) notifications.push(techNotification)
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

      // Notificar al cliente con call-to-action para calificar
      const notification = await this.createNotification({
        userId: ticket.clientId,
        type: 'SUCCESS',
        title: 'Ticket resuelto - Califica el servicio',
        message: `Tu ticket "${ticket.title}" ha sido resuelto. Por favor califica el servicio recibido para cerrar el ticket.`,
        ticketId: ticket.id,
        specificType: 'statusChanged',
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
