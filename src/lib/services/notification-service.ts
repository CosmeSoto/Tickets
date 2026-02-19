import prisma from '@/lib/prisma'

export interface Notification {
  id: string
  type: 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS'
  category: 'SYSTEM_ALERT' | 'TICKET_UPDATE' | 'USER_ACTION' | 'SYSTEM_STATUS'
  title: string
  message: string
  actionText?: string
  actionUrl?: string
  priority: number
  isRead: boolean
  isDismissed: boolean
  createdAt: Date
  expiresAt?: Date
  relatedIds?: string[]
  count?: number
  ticket?: {
    id: string
    title: string
  }
}

export class NotificationService {
  /**
   * Obtiene todas las notificaciones para un usuario (alertas del sistema + notificaciones tradicionales)
   */
  static async getUserNotifications(userId: string, userRole: string, limit: number = 10): Promise<Notification[]> {
    const notifications: Notification[] = []
    const now = new Date()

    try {
      // 1. Obtener notificaciones persistentes de la base de datos
      const persistentNotifications = await this.getPersistentNotifications(userId, Math.floor(limit / 2))
      notifications.push(...persistentNotifications)

      // 2. Generar alertas del sistema dinámicas
      const systemAlerts = await this.generateSystemAlerts(userId, userRole, Math.ceil(limit / 2))
      notifications.push(...systemAlerts)

      // 3. Ordenar por prioridad y fecha
      return notifications
        .sort((a, b) => {
          // Primero por prioridad (mayor prioridad = menor número)
          if (a.priority !== b.priority) return a.priority - b.priority
          // Luego por fecha (más reciente primero)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
        .slice(0, limit)

    } catch (error) {
      console.error('Error getting user notifications:', error)
      return []
    }
  }

  /**
   * Obtiene notificaciones persistentes de la base de datos
   */
  private static async getPersistentNotifications(userId: string, limit: number): Promise<Notification[]> {
    try {
      // Aquí iría la lógica para obtener notificaciones de la base de datos
      // Por ahora retornamos array vacío ya que el sistema actual usa notificaciones dinámicas
      return []
    } catch (error) {
      console.error('Error getting persistent notifications:', error)
      return []
    }
  }

  /**
   * Genera alertas del sistema dinámicas
   */
  private static async generateSystemAlerts(userId: string, userRole: string, limit: number): Promise<Notification[]> {
    const alerts: Notification[] = []
    const now = new Date()

    try {
      if (userRole === 'ADMIN') {
        // 1. Tickets críticos sin asignar
        const criticalUnassigned = await prisma.tickets.findMany({
          where: {
            assigneeId: null,
            priority: 'HIGH',
            status: 'OPEN',
            createdAt: {
              gte: new Date(now.getTime() - 4 * 60 * 60 * 1000) // Últimas 4h
            }
          },
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: {
            users_tickets_clientIdTousers: { select: { name: true, email: true } },
            categories: { select: { name: true } }
          }
        })

        criticalUnassigned.forEach((ticket, index) => {
          const hoursOld = Math.floor((now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60))
          alerts.push({
            id: `critical-unassigned-${ticket.id}`,
            type: 'CRITICAL',
            category: 'SYSTEM_ALERT',
            title: `🚨 Ticket crítico sin asignar`,
            message: `"${ticket.title}" de ${ticket.users_tickets_clientIdTousers?.name} lleva ${hoursOld}h sin asignar. Categoría: ${ticket.categories?.name || 'Sin categoría'}`,
            actionText: 'Asignar técnico',
            actionUrl: `/admin/tickets/${ticket.id}?action=assign`,
            priority: 10 + index,
            isRead: false,
            isDismissed: false,
            createdAt: ticket.createdAt,
            relatedIds: [ticket.id],
            ticket: { id: ticket.id, title: ticket.title }
          })
        })

        // 2. Tickets vencidos por SLA
        const overdueTickets = await prisma.tickets.findMany({
          where: {
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            createdAt: {
              lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Más de 24h
            }
          },
          take: 2,
          orderBy: { createdAt: 'asc' },
          include: {
            users_tickets_assigneeIdTousers: { select: { name: true } },
            users_tickets_clientIdTousers: { select: { name: true } }
          }
        })

        overdueTickets.forEach((ticket, index) => {
          const hoursOverdue = Math.floor((now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60)) - 24
          alerts.push({
            id: `overdue-sla-${ticket.id}`,
            type: 'CRITICAL',
            category: 'SYSTEM_ALERT',
            title: `⏰ SLA vencido`,
            message: `"${ticket.title}" lleva ${hoursOverdue}h vencido. ${ticket.users_tickets_assigneeIdTousers ? `Asignado a: ${ticket.users_tickets_assigneeIdTousers.name}` : 'Sin asignar'}`,
            actionText: 'Revisar ticket',
            actionUrl: `/admin/tickets/${ticket.id}?action=resolve`,
            priority: 5 + index,
            isRead: false,
            isDismissed: false,
            createdAt: ticket.createdAt,
            relatedIds: [ticket.id],
            ticket: { id: ticket.id, title: ticket.title }
          })
        })

        // 3. Pico de actividad
        const todayTickets = await prisma.tickets.count({
          where: {
            createdAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000)
            }
          }
        })

        const avgDailyTickets = await this.getAverageDailyTickets()
        const isActivitySpike = todayTickets > avgDailyTickets * 1.5 && todayTickets >= 5

        if (isActivitySpike) {
          alerts.push({
            id: `activity-spike-${new Date().toISOString().split('T')[0]}`,
            type: 'WARNING',
            category: 'SYSTEM_STATUS',
            title: '📈 Pico de actividad detectado',
            message: `${todayTickets} tickets creados hoy vs ${avgDailyTickets} promedio diario. Considera reforzar el equipo.`,
            actionText: 'Ver análisis',
            actionUrl: '/admin/reports?view=activity&period=today',
            priority: 30,
            isRead: false,
            isDismissed: false,
            createdAt: new Date(now.getTime() - 30 * 60 * 1000),
            count: todayTickets
          })
        }

      } else if (userRole === 'TECHNICIAN') {
        // 1. Tickets urgentes asignados próximos a vencer
        const urgentAssigned = await prisma.tickets.findMany({
          where: {
            assigneeId: userId,
            priority: { in: ['HIGH', 'URGENT'] },
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            createdAt: {
              lt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // Más de 2h
              gte: new Date(now.getTime() - 6 * 60 * 60 * 1000)  // Menos de 6h
            }
          },
          take: 3,
          orderBy: { createdAt: 'asc' },
          include: {
            users_tickets_clientIdTousers: { select: { name: true } },
            categories: { select: { name: true } }
          }
        })

        urgentAssigned.forEach((ticket, index) => {
          const hoursLeft = 6 - Math.floor((now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60))
          alerts.push({
            id: `urgent-assigned-${ticket.id}`,
            type: 'WARNING',
            category: 'SYSTEM_ALERT',
            title: `⚠️ Ticket urgente próximo a vencer`,
            message: `"${ticket.title}" de ${ticket.users_tickets_clientIdTousers?.name} vence en ${hoursLeft}h`,
            actionText: 'Trabajar en ticket',
            actionUrl: `/technician/tickets/${ticket.id}?action=work`,
            priority: 15 + index,
            isRead: false,
            isDismissed: false,
            createdAt: ticket.createdAt,
            relatedIds: [ticket.id],
            ticket: { id: ticket.id, title: ticket.title }
          })
        })

        // 2. Tickets sin respuesta inicial
        const noResponseTickets = await prisma.tickets.findMany({
          where: {
            assigneeId: userId,
            status: 'OPEN',
            createdAt: {
              lt: new Date(now.getTime() - 60 * 60 * 1000) // Más de 1h sin respuesta inicial
            }
          },
          take: 2,
          orderBy: { createdAt: 'asc' },
          include: {
            users_tickets_clientIdTousers: { select: { name: true } }
          }
        })

        for (const ticket of noResponseTickets) {
          const hasResponse = await prisma.comments.findFirst({
            where: { 
              ticketId: ticket.id,
              users: {
                role: { in: ['TECHNICIAN', 'ADMIN'] }
              }
            }
          })

          if (!hasResponse) {
            const hoursWaiting = Math.floor((now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60))
            alerts.push({
              id: `no-response-${ticket.id}`,
              type: 'WARNING',
              category: 'USER_ACTION',
              title: `📞 Cliente esperando respuesta`,
              message: `${ticket.users_tickets_clientIdTousers?.name} lleva ${hoursWaiting}h esperando tu respuesta inicial`,
              actionText: 'Responder ahora',
              actionUrl: `/technician/tickets/${ticket.id}?action=respond`,
              priority: 20,
              isRead: false,
              isDismissed: false,
              createdAt: ticket.createdAt,
              relatedIds: [ticket.id],
              ticket: { id: ticket.id, title: ticket.title }
            })
          }
        }

      } else if (userRole === 'CLIENT') {
        // 1. Tickets resueltos pendientes de calificación
        const pendingRating = await prisma.tickets.findMany({
          where: {
            clientId: userId,
            status: 'RESOLVED',
            resolvedAt: {
              gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // Últimos 7 días
              lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Más de 1 día
            }
          },
          take: 2,
          orderBy: { resolvedAt: 'desc' },
          include: {
            users_tickets_assigneeIdTousers: { select: { name: true } }
          }
        })

        for (const ticket of pendingRating) {
          const hasRating = await prisma.ticket_ratings.findFirst({
            where: { ticketId: ticket.id }
          })

          if (!hasRating) {
            const daysAgo = Math.floor((now.getTime() - (ticket.resolvedAt?.getTime() || 0)) / (1000 * 60 * 60 * 24))
            alerts.push({
              id: `rating-pending-${ticket.id}`,
              type: 'INFO',
              category: 'USER_ACTION',
              title: `⭐ Califica nuestro servicio`,
              message: `Tu ticket "${ticket.title}" fue resuelto hace ${daysAgo} día${daysAgo !== 1 ? 's' : ''} por ${ticket.users_tickets_assigneeIdTousers?.name}`,
              actionText: 'Calificar servicio',
              actionUrl: `/client/tickets/${ticket.id}?action=rate`,
              priority: 40,
              isRead: false,
              isDismissed: false,
              createdAt: ticket.resolvedAt || ticket.updatedAt,
              relatedIds: [ticket.id],
              ticket: { id: ticket.id, title: ticket.title }
            })
          }
        }

        // 2. Tickets con actualizaciones recientes
        const recentUpdates = await prisma.tickets.findMany({
          where: {
            clientId: userId,
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            updatedAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Últimas 24h
              gt: new Date(now.getTime() - 48 * 60 * 60 * 1000)   // Pero no muy antiguas
            }
          },
          take: 2,
          orderBy: { updatedAt: 'desc' },
          include: {
            users_tickets_assigneeIdTousers: { select: { name: true } },
            _count: {
              select: { comments: true }
            }
          }
        })

        for (const ticket of recentUpdates) {
          // Verificar si hay comentarios nuevos del técnico
          const recentComments = await prisma.comments.findMany({
            where: {
              ticketId: ticket.id,
              createdAt: {
                gte: new Date(now.getTime() - 24 * 60 * 60 * 1000)
              },
              users: {
                role: { in: ['TECHNICIAN', 'ADMIN'] }
              }
            },
            take: 1,
            orderBy: { createdAt: 'desc' }
          })

          if (recentComments.length > 0) {
            const hoursAgo = Math.floor((now.getTime() - recentComments[0].createdAt.getTime()) / (1000 * 60 * 60))
            alerts.push({
              id: `ticket-update-${ticket.id}`,
              type: 'INFO',
              category: 'TICKET_UPDATE',
              title: `💬 Nueva respuesta en tu ticket`,
              message: `${ticket.users_tickets_assigneeIdTousers?.name || 'El equipo de soporte'} respondió hace ${hoursAgo}h en "${ticket.title}"`,
              actionText: 'Ver respuesta',
              actionUrl: `/client/tickets/${ticket.id}`,
              priority: 25,
              isRead: false,
              isDismissed: false,
              createdAt: recentComments[0].createdAt,
              relatedIds: [ticket.id],
              ticket: { id: ticket.id, title: ticket.title }
            })
          }
        }

        // 3. Tickets sin respuesta por mucho tiempo
        const staleTickets = await prisma.tickets.findMany({
          where: {
            clientId: userId,
            status: 'OPEN',
            createdAt: {
              lt: new Date(now.getTime() - 48 * 60 * 60 * 1000) // Más de 48h
            }
          },
          take: 1,
          orderBy: { createdAt: 'asc' },
          include: {
            users_tickets_assigneeIdTousers: { select: { name: true } }
          }
        })

        for (const ticket of staleTickets) {
          const hasAnyResponse = await prisma.comments.findFirst({
            where: { 
              ticketId: ticket.id,
              users: {
                role: { in: ['TECHNICIAN', 'ADMIN'] }
              }
            }
          })

          if (!hasAnyResponse) {
            const hoursWaiting = Math.floor((now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60))
            alerts.push({
              id: `stale-ticket-${ticket.id}`,
              type: 'WARNING',
              category: 'SYSTEM_ALERT',
              title: `⏳ Ticket sin respuesta`,
              message: `Tu ticket "${ticket.title}" lleva ${hoursWaiting}h sin respuesta. ${ticket.users_tickets_assigneeIdTousers ? `Asignado a: ${ticket.users_tickets_assigneeIdTousers.name}` : 'Estamos buscando un técnico'}`,
              actionText: 'Ver detalles',
              actionUrl: `/client/tickets/${ticket.id}`,
              priority: 30,
              isRead: false,
              isDismissed: false,
              createdAt: ticket.createdAt,
              relatedIds: [ticket.id],
              ticket: { id: ticket.id, title: ticket.title }
            })
          }
        }
      }

    } catch (error) {
      console.error('Error generating system alerts:', error)
    }

    return alerts.slice(0, limit)
  }

  /**
   * Verifica si una notificación debe ser ocultada (tarea completada)
   */
  static async shouldHideNotification(notificationId: string): Promise<boolean> {
    try {
      // Notificaciones de administrador
      if (notificationId.startsWith('critical-unassigned-')) {
        const ticketId = notificationId.replace('critical-unassigned-', '')
        const ticket = await prisma.tickets.findUnique({
          where: { id: ticketId },
          select: { assigneeId: true }
        })
        return ticket?.assigneeId !== null
      }

      if (notificationId.startsWith('overdue-sla-')) {
        const ticketId = notificationId.replace('overdue-sla-', '')
        const ticket = await prisma.tickets.findUnique({
          where: { id: ticketId },
          select: { status: true }
        })
        return ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED'
      }

      // Notificaciones de técnico
      if (notificationId.startsWith('urgent-assigned-')) {
        const ticketId = notificationId.replace('urgent-assigned-', '')
        const ticket = await prisma.tickets.findUnique({
          where: { id: ticketId },
          select: { status: true }
        })
        return ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED'
      }

      if (notificationId.startsWith('no-response-')) {
        const ticketId = notificationId.replace('no-response-', '')
        const hasResponse = await prisma.comments.findFirst({
          where: { 
            ticketId,
            users: {
              role: { in: ['TECHNICIAN', 'ADMIN'] }
            }
          }
        })
        return hasResponse !== null
      }

      // Notificaciones de cliente
      if (notificationId.startsWith('rating-pending-')) {
        const ticketId = notificationId.replace('rating-pending-', '')
        const hasRating = await prisma.ticket_ratings.findFirst({
          where: { ticketId }
        })
        return hasRating !== null
      }

      if (notificationId.startsWith('ticket-update-')) {
        // Las actualizaciones de tickets no se ocultan automáticamente
        // El usuario debe marcarlas como leídas o descartarlas
        return false
      }

      if (notificationId.startsWith('stale-ticket-')) {
        const ticketId = notificationId.replace('stale-ticket-', '')
        const hasResponse = await prisma.comments.findFirst({
          where: { 
            ticketId,
            users: {
              role: { in: ['TECHNICIAN', 'ADMIN'] }
            }
          }
        })
        return hasResponse !== null
      }

    } catch (error) {
      console.error('Error checking notification visibility:', error)
    }

    return false
  }

  /**
   * Aplica el estado de localStorage a las notificaciones dinámicas
   */
  static applyLocalStorageState(notifications: Notification[], localState: { read: string[], dismissed: string[] }): Notification[] {
    return notifications
      .filter(notification => {
        // Filtrar notificaciones eliminadas
        if (this.isDynamicNotification(notification.id)) {
          return !localState.dismissed.includes(notification.id)
        }
        return true
      })
      .map(notification => {
        // Aplicar estado de leído
        if (this.isDynamicNotification(notification.id) && localState.read.includes(notification.id)) {
          return { ...notification, isRead: true }
        }
        return notification
      })
  }

  /**
   * Verifica si una notificación es dinámica (no persistente en BD)
   */
  private static isDynamicNotification(notificationId: string): boolean {
    const dynamicPrefixes = [
      'activity-spike-',
      'critical-unassigned-',
      'sla-warning-',
      'urgent-assigned-',
      'overdue-sla-',
      'no-response-',
      'rating-pending-',
      'ticket-update-',
      'stale-ticket-'
    ]
    
    return dynamicPrefixes.some(prefix => notificationId.includes(prefix))
  }

  /**
   * Calcula el promedio diario de tickets
   */
  private static async getAverageDailyTickets(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const ticketsLast30Days = await prisma.tickets.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo
          }
        }
      })
      return Math.floor(ticketsLast30Days / 30)
    } catch (error) {
      console.error('Error calculating average daily tickets:', error)
      return 0
    }
  }
}