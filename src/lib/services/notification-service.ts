import prisma from '@/lib/prisma'
import { NotificationType } from '@prisma/client'
import { randomUUID } from 'crypto'
import { NotificationEvents } from '@/lib/notification-events'
import { WebPushService } from '@/lib/services/web-push.service'
import {
  getFamilyScopedAdmins,
  getFamilyScopedAdminsForFamilies,
} from '@/lib/notifications/family-recipients'
import { evaluateDelivery, type NotificationSpecificType } from '@/lib/notifications/delivery'

export interface CreateNotificationData {
  userId: string
  type: NotificationType
  title: string
  message: string
  ticketId?: string
  metadata?: any
  specificType?: NotificationSpecificType
  /**
   * Ignora preferencias y horas silenciosas (alertas críticas, p. ej. calificar ticket).
   * Usar con moderación.
   */
  force?: boolean
}

export class NotificationService {
  /** Deep-link para Web Push según metadata / ticket / rol del destinatario. */
  private static async resolvePushUrl(data: CreateNotificationData): Promise<string> {
    if (typeof data.metadata?.link === 'string' && data.metadata.link) {
      return data.metadata.link
    }
    if (data.metadata?.ticketId || data.ticketId) {
      const tid = data.ticketId || data.metadata?.ticketId
      const destUser = await prisma.users.findUnique({
        where: { id: data.userId },
        select: { role: true },
      })
      const prefix =
        destUser?.role === 'ADMIN'
          ? 'admin'
          : destUser?.role === 'TECHNICIAN'
            ? 'technician'
            : 'client'
      return `/${prefix}/tickets/${tid}`
    }
    if (data.metadata?.equipmentId) {
      return `/inventory/equipment/${data.metadata.equipmentId}`
    }
    if (data.metadata?.actId) {
      return `/inventory/acts/${data.metadata.actId}`
    }
    if (data.metadata?.maintenanceId) {
      return `/inventory/maintenance/${data.metadata.maintenanceId}`
    }
    if (data.metadata?.patrolId) {
      return `/patrol/${data.metadata.patrolId}`
    }
    if (data.metadata?.scheduleId) {
      return '/patrol'
    }
    return '/'
  }

  /**
   * Pipeline único de entrega:
   * 1) Preferencias (categoría → in-app; push + quiet hours → Web Push)
   * 2) Persistencia
   * 3) SSE
   * 4) Web Push si no hay SSE local y las prefs lo permiten
   */
  private static async deliver(data: CreateNotificationData) {
    const specificType =
      data.specificType ||
      (typeof data.metadata?.specificType === 'string'
        ? (data.metadata.specificType as NotificationSpecificType)
        : undefined)

    const decision = await evaluateDelivery(data.userId, {
      type: data.type,
      specificType,
      force: data.force,
      ticketId: data.ticketId,
      metadata: data.metadata,
    })

    if (!decision.allowInApp) {
      return null
    }

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
      include: {
        users: {
          select: { id: true, name: true, email: true },
        },
        tickets: {
          select: { id: true, title: true },
        },
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

    if (decision.allowWebPush && WebPushService.isConfigured()) {
      // Presencia cluster-wide (Redis) — evita push duplicado o perdido multi-instancia
      const hasActiveSSE = await NotificationEvents.isUserConnected(data.userId)

      if (!hasActiveSSE) {
        const url = await this.resolvePushUrl(data)
        WebPushService.sendToUser(data.userId, {
          title: data.title,
          body: data.message,
          id: notification.id,
          ticketId: data.ticketId ?? undefined,
          url,
          metadata: data.metadata,
        }).catch(err => {
          console.error('[NotificationService] Error enviando Web Push:', err)
        })
      }
    }

    return notification
  }

  /**
   * Notificación de dominio (inventario, rondas, helpers API).
   * Respeta systemAlerts / preferencias; use force: true solo para críticos.
   */
  static async push(data: CreateNotificationData) {
    try {
      return await this.deliver(data)
    } catch (error) {
      console.error('[NOTIFICATION] Error en push:', error)
      return null
    }
  }

  /**
   * Notificación in-app (tickets y flujos con specificType).
   * Mismo pipeline que push: prefs + SSE + Web Push offline.
   */
  static async createNotification(data: CreateNotificationData) {
    try {
      return await this.deliver(data)
    } catch (error) {
      console.error('[NOTIFICATION] Error creating notification:', error)
      throw error
    }
  }
  /**
   * Notificar cuando se crea un ticket
   * - Super admins
   * - Admin cuya familia nativa coincide con la del ticket
   * - El técnico asignado recibe notifyTicketAssigned por separado
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

      const admins = await getFamilyScopedAdmins(ticket.familyId, {
        id: true,
        name: true,
        email: true,
      })

      const uniqueRecipients = admins.filter(
        recipient =>
          recipient.id !== ticket.clientId &&
          recipient.id !== ticket.createdById &&
          recipient.id !== ticket.assigneeId
      )

      if (uniqueRecipients.length === 0) return []

      const isPatrolEscalation = ticket.source === 'PATROL' && ticket.createdById
      const notificationMessage = isPatrolEscalation
        ? `Nueva novedad de ronda escalada: "${ticket.title}"`
        : `${ticket.users_tickets_clientIdTousers.name} ha creado el ticket "${ticket.title}"`

      const notifications = await Promise.all(
        uniqueRecipients.map(recipient =>
          this.createNotification({
            userId: recipient.id,
            type: 'INFO',
            title: 'Nuevo ticket creado',
            message: notificationMessage,
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
      return []
    }
  }

  /**
   * Notificar cuando un ticket cambia de familia
   * - Notifica al cliente del ticket
   * - Notifica al técnico asignado (si existe)
   * - Super admins + admins nativos de la familia anterior y nueva
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

      const admins = await getFamilyScopedAdminsForFamilies([oldFamilyId, newFamilyId], {
        id: true,
      })
      for (const admin of admins) {
        if (!recipientIds.includes(admin.id)) {
          recipientIds.push(admin.id)
        }
      }

      await Promise.all(
        recipientIds.map(userId =>
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
            ticketId: ticket.id,
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
            ticketId: ticket.id,
          },
        })
        if (techNotification) {
          notifications.push(techNotification)
        }
      }

      // Notificar al cliente (solo si es diferente al técnico asignado)
      if (ticket.clientId !== technicianId) {
        const clientNotification = await this.createNotification({
          userId: ticket.clientId,
          type: 'SUCCESS',
          title: 'Ticket asignado',
          message: `Tu ticket "${ticket.title}" ha sido asignado a ${ticket.users_tickets_assigneeIdTousers?.name || 'un técnico'}`,
          ticketId: ticket.id,
          specificType: 'ticketAssigned',
          metadata: {
            ticketId: ticket.id,
          },
        })
        if (clientNotification) notifications.push(clientNotification)
      }

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

      // Comentario interno: notificar solo al equipo (admin ↔ técnico), nunca al cliente
      if (isInternalComment) {
        const notifications = []

        // Si lo escribe el técnico → super admins + admin nativo de la familia del ticket
        if (author.role === 'TECHNICIAN') {
          const admins = await getFamilyScopedAdmins(ticket.familyId, { id: true })
          for (const admin of admins) {
            if (admin.id === author.id) continue
            const n = await this.createNotification({
              userId: admin.id,
              type: 'INFO',
              title: '🔒 Nota interna del técnico',
              message: `${author.name} dejó una nota interna en el ticket "${ticket.title}"`,
              ticketId: ticket.id,
              specificType: 'newComments',
            })
            if (n) notifications.push(n)
          }
        }

        // Si lo escribe el admin → notificar al técnico asignado
        if (author.role === 'ADMIN' && ticket.assigneeId && ticket.assigneeId !== author.id) {
          const n = await this.createNotification({
            userId: ticket.assigneeId,
            type: 'INFO',
            title: '🔒 Nota interna del administrador',
            message: `${author.name} dejó una nota interna en el ticket "${ticket.title}"`,
            ticketId: ticket.id,
            specificType: 'newComments',
          })
          if (n) notifications.push(n)
        }

        return notifications
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
          users_tickets_createdByIdTousers: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      })

      if (!ticket) {
        throw new Error('Ticket not found')
      }

      // Determinar quién debe calificar:
      // - Tickets normales: el clientId
      // - Tickets escalados de rondas (source=PATROL): el createdById (admin/supervisor que escaló)
      const isPatrol = ticket.source === 'PATROL' && !!ticket.createdById
      const raterUserId = isPatrol ? ticket.createdById! : ticket.clientId
      const raterRole = isPatrol
        ? ticket.users_tickets_createdByIdTousers?.role
        : ticket.users_tickets_clientIdTousers
          ? 'CLIENT'
          : null
      const rolePrefix =
        raterRole === 'ADMIN' ? 'admin' : raterRole === 'TECHNICIAN' ? 'technician' : 'client'

      // force: calificación es paso operativo crítico del cierre
      const notification = await this.push({
        userId: raterUserId,
        type: 'SUCCESS',
        title: 'Ticket resuelto - Califica el servicio',
        message: `${isPatrol ? 'El ticket escalado desde rondas' : 'Tu ticket'} "${ticket.title}" ha sido resuelto. Por favor califica el servicio recibido para cerrar el ticket.`,
        ticketId: ticket.id,
        force: true,
        specificType: 'statusChanged',
        metadata: {
          link: `/${rolePrefix}/tickets/${ticket.id}`,
        },
      })

      // Si es ticket de rondas, también notificar al agente que su novedad fue resuelta
      if (isPatrol && ticket.clientId !== raterUserId) {
        await this.push({
          userId: ticket.clientId,
          type: 'SUCCESS',
          title: 'Novedad resuelta',
          message: `La novedad que reportaste ha sido resuelta (ticket "${ticket.title}").`,
          ticketId: ticket.id,
          specificType: 'statusChanged',
          metadata: { link: `/client/tickets/${ticket.id}` },
        }).catch(() => {})
      }

      return notification
    } catch (error) {
      console.error('Error notifying ticket resolved:', error)
      throw error
    }
  }

  /**
   * Obtener notificaciones de un usuario (paginación por cursor).
   * typeGroup: SUCCESS|INFO|WARNING|ERROR|INVENTORY|PATROL|TICKET
   */
  static async getUserNotifications(
    userId: string,
    options: {
      limit?: number
      cursor?: string | null
      isRead?: boolean | null
      typeGroup?: string | null
      q?: string | null
    } = {}
  ) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)
    const typeFilter = this.buildTypeGroupFilter(options.typeGroup)

    const where: Record<string, unknown> = {
      userId,
      // Ocultar snoozed activos del inbox (vuelven solos al vencer)
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
    }
    if (typeof options.isRead === 'boolean') {
      where.isRead = options.isRead
    }
    if (typeFilter) {
      where.type = typeFilter
    }
    if (options.q?.trim()) {
      const q = options.q.trim()
      // Combinar búsqueda con filtro de snooze (AND de grupos OR)
      where.AND = [
        { OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }] },
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { message: { contains: q, mode: 'insensitive' } },
          ],
        },
      ]
      delete where.OR
    }

    try {
      const [rows, total, unread] = await Promise.all([
        prisma.notifications.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
          include: {
            tickets: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        }),
        prisma.notifications.count({ where }),
        prisma.notifications.count({
          where: {
            userId,
            isRead: false,
            OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
          },
        }),
      ])

      const hasMore = rows.length > limit
      const items = hasMore ? rows.slice(0, limit) : rows
      const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

      return { items, nextCursor, hasMore, total, unread }
    } catch (error) {
      console.error('Error getting user notifications:', error)
      throw error
    }
  }

  private static buildTypeGroupFilter(typeGroup?: string | null) {
    if (!typeGroup || typeGroup === 'all') return null
    switch (typeGroup) {
      case 'PATROL':
        return {
          in: [
            NotificationType.PATROL_MISSED,
            NotificationType.PATROL_INCOMPLETE,
            NotificationType.PATROL_ASSIGNED,
            NotificationType.OFFLINE_SYNC_REJECTED,
          ],
        }
      case 'TICKET':
        return { in: [NotificationType.TICKET_FAMILY_CHANGE] }
      case 'INVENTORY':
        return NotificationType.INVENTORY
      case 'SUCCESS':
      case 'INFO':
      case 'WARNING':
      case 'ERROR':
        return typeGroup as NotificationType
      default:
        return typeGroup as NotificationType
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
          OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
        },
      })

      return count
    } catch (error) {
      console.error('Error getting unread count:', error)
      throw error
    }
  }

  /** Posponer una notificación individual hasta `until`. */
  static async snoozeNotification(notificationId: string, userId: string, until: Date) {
    const existing = await prisma.notifications.findUnique({ where: { id: notificationId } })
    if (!existing || existing.userId !== userId) return null
    return prisma.notifications.update({
      where: { id: notificationId },
      data: { snoozedUntil: until },
    })
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
   * Marcar notificación como no leída
   */
  static async markAsUnread(notificationId: string) {
    try {
      return await prisma.notifications.update({
        where: { id: notificationId },
        data: { isRead: false },
      })
    } catch (error) {
      console.error('Error marking notification as unread:', error)
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
