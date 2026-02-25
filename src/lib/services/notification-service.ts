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

        // 4. Técnicos sobrecargados
        const overloadedTechnicians = await prisma.users.findMany({
          where: {
            role: 'TECHNICIAN',
            tickets_tickets_assigneeIdTousers: {
              some: {
                status: { in: ['OPEN', 'IN_PROGRESS'] }
              }
            }
          },
          include: {
            _count: {
              select: {
                tickets_tickets_assigneeIdTousers: {
                  where: {
                    status: { in: ['OPEN', 'IN_PROGRESS'] }
                  }
                }
              }
            }
          }
        })

        const overloaded = overloadedTechnicians.filter(tech => 
          tech._count.tickets_tickets_assigneeIdTousers > 10
        )

        if (overloaded.length > 0) {
          const techNames = overloaded.map(t => t.name).join(', ')
          const maxLoad = Math.max(...overloaded.map(t => t._count.tickets_tickets_assigneeIdTousers))
          
          alerts.push({
            id: `overloaded-techs-${new Date().toISOString().split('T')[0]}`,
            type: 'WARNING',
            category: 'SYSTEM_ALERT',
            title: `⚠️ Técnicos sobrecargados`,
            message: `${overloaded.length} técnico${overloaded.length > 1 ? 's' : ''} con más de 10 tickets: ${techNames}. Máximo: ${maxLoad} tickets.`,
            actionText: 'Redistribuir carga',
            actionUrl: '/admin/technicians?view=workload',
            priority: 25,
            isRead: false,
            isDismissed: false,
            createdAt: new Date(now.getTime() - 15 * 60 * 1000),
            count: overloaded.length
          })
        }

        // 5. Nuevos comentarios en tickets críticos (ADMIN debe estar al tanto)
        const criticalTicketsWithComments = await prisma.tickets.findMany({
          where: {
            priority: 'HIGH',
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            comments: {
              some: {
                createdAt: {
                  gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) // Últimas 2h
                }
              }
            }
          },
          take: 2,
          include: {
            users_tickets_clientIdTousers: { select: { name: true } },
            users_tickets_assigneeIdTousers: { select: { name: true } },
            comments: {
              where: {
                createdAt: {
                  gte: new Date(now.getTime() - 2 * 60 * 60 * 1000)
                }
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                users: { select: { name: true, role: true } }
              }
            }
          }
        })

        for (const ticket of criticalTicketsWithComments) {
          if (ticket.comments.length > 0) {
            const lastComment = ticket.comments[0]
            const minutesAgo = Math.floor((now.getTime() - lastComment.createdAt.getTime()) / (1000 * 60))
            const timeAgo = minutesAgo < 60 
              ? `${minutesAgo} minuto${minutesAgo !== 1 ? 's' : ''}`
              : `${Math.floor(minutesAgo / 60)} hora${Math.floor(minutesAgo / 60) !== 1 ? 's' : ''}`

            alerts.push({
              id: `critical-comment-${ticket.id}-${lastComment.id}`,
              type: 'WARNING',
              category: 'TICKET_UPDATE',
              title: `🔥 Actividad en ticket crítico`,
              message: `${lastComment.users.name} (${lastComment.users.role === 'CLIENT' ? 'Cliente' : 'Técnico'}) comentó hace ${timeAgo} en "${ticket.title}"`,
              actionText: 'Supervisar',
              actionUrl: `/admin/tickets/${ticket.id}`,
              priority: 20,
              isRead: false,
              isDismissed: false,
              createdAt: lastComment.createdAt,
              relatedIds: [ticket.id, lastComment.id],
              ticket: { id: ticket.id, title: ticket.title }
            })
          }
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

        // 2. Nuevos comentarios de clientes (PRIORIDAD ALTA)
        const ticketsWithNewComments = await prisma.tickets.findMany({
          where: {
            assigneeId: userId,
            status: { in: ['OPEN', 'IN_PROGRESS'] }
          },
          include: {
            users_tickets_clientIdTousers: { select: { name: true } },
            comments: {
              where: {
                createdAt: {
                  gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Últimas 24h
                },
                users: {
                  role: 'CLIENT' // Solo comentarios de clientes
                }
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                users: { select: { name: true, role: true } }
              }
            }
          }
        })

        for (const ticket of ticketsWithNewComments) {
          if (ticket.comments.length > 0) {
            const lastComment = ticket.comments[0]
            const minutesAgo = Math.floor((now.getTime() - lastComment.createdAt.getTime()) / (1000 * 60))
            const timeAgo = minutesAgo < 60 
              ? `${minutesAgo} minuto${minutesAgo !== 1 ? 's' : ''}`
              : `${Math.floor(minutesAgo / 60)} hora${Math.floor(minutesAgo / 60) !== 1 ? 's' : ''}`

            alerts.push({
              id: `client-comment-${ticket.id}-${lastComment.id}`,
              type: 'WARNING',
              category: 'TICKET_UPDATE',
              title: `💬 Cliente respondió`,
              message: `${ticket.users_tickets_clientIdTousers?.name} comentó hace ${timeAgo} en "${ticket.title}"`,
              actionText: 'Ver comentario',
              actionUrl: `/technician/tickets/${ticket.id}#comment-${lastComment.id}`,
              priority: 10, // Alta prioridad
              isRead: false,
              isDismissed: false,
              createdAt: lastComment.createdAt,
              relatedIds: [ticket.id, lastComment.id],
              ticket: { id: ticket.id, title: ticket.title }
            })
          }
        }

        // 3. Tickets sin respuesta inicial
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

        // 2. Nuevas respuestas de técnicos/admin (PRIORIDAD ALTA)
        const ticketsWithNewResponses = await prisma.tickets.findMany({
          where: {
            clientId: userId,
            status: { in: ['OPEN', 'IN_PROGRESS', 'RESOLVED'] }
          },
          include: {
            users_tickets_assigneeIdTousers: { select: { name: true } },
            comments: {
              where: {
                createdAt: {
                  gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Últimas 24h
                },
                users: {
                  role: { in: ['TECHNICIAN', 'ADMIN'] } // Solo respuestas del equipo
                }
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                users: { select: { name: true, role: true } }
              }
            }
          }
        })

        for (const ticket of ticketsWithNewResponses) {
          if (ticket.comments.length > 0) {
            const lastComment = ticket.comments[0]
            const minutesAgo = Math.floor((now.getTime() - lastComment.createdAt.getTime()) / (1000 * 60))
            const timeAgo = minutesAgo < 60 
              ? `${minutesAgo} minuto${minutesAgo !== 1 ? 's' : ''}`
              : `${Math.floor(minutesAgo / 60)} hora${Math.floor(minutesAgo / 60) !== 1 ? 's' : ''}`

            alerts.push({
              id: `tech-response-${ticket.id}-${lastComment.id}`,
              type: 'INFO',
              category: 'TICKET_UPDATE',
              title: `💬 Nueva respuesta del equipo`,
              message: `${lastComment.users.name} respondió hace ${timeAgo} en "${ticket.title}"`,
              actionText: 'Ver respuesta',
              actionUrl: `/client/tickets/${ticket.id}#comment-${lastComment.id}`,
              priority: 15, // Alta prioridad para clientes
              isRead: false,
              isDismissed: false,
              createdAt: lastComment.createdAt,
              relatedIds: [ticket.id, lastComment.id],
              ticket: { id: ticket.id, title: ticket.title }
            })
          }
        }

        // 3. Ticket asignado a técnico
        const recentlyAssigned = await prisma.tickets.findMany({
          where: {
            clientId: userId,
            status: 'OPEN',
            assigneeId: { not: null },
            updatedAt: {
              gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) // Últimas 6h
            }
          },
          take: 2,
          orderBy: { updatedAt: 'desc' },
          include: {
            users_tickets_assigneeIdTousers: { select: { name: true } }
          }
        })

        for (const ticket of recentlyAssigned) {
          // Verificar que no tenga comentarios del técnico aún (recién asignado)
          const techComments = await prisma.comments.count({
            where: {
              ticketId: ticket.id,
              users: {
                role: { in: ['TECHNICIAN', 'ADMIN'] }
              }
            }
          })

          if (techComments === 0) {
            const hoursAgo = Math.floor((now.getTime() - ticket.updatedAt.getTime()) / (1000 * 60 * 60))
            alerts.push({
              id: `ticket-assigned-${ticket.id}`,
              type: 'SUCCESS',
              category: 'TICKET_UPDATE',
              title: `✅ Ticket asignado`,
              message: `Tu ticket "${ticket.title}" fue asignado a ${ticket.users_tickets_assigneeIdTousers?.name} hace ${hoursAgo}h`,
              actionText: 'Ver ticket',
              actionUrl: `/client/tickets/${ticket.id}`,
              priority: 30,
              isRead: false,
              isDismissed: false,
              createdAt: ticket.updatedAt,
              relatedIds: [ticket.id],
              ticket: { id: ticket.id, title: ticket.title }
            })
          }
        }

        // 4. Cambio de estado del ticket
        const statusChanged = await prisma.tickets.findMany({
          where: {
            clientId: userId,
            status: { in: ['IN_PROGRESS', 'RESOLVED'] },
            updatedAt: {
              gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) // Últimas 12h
            }
          },
          take: 2,
          orderBy: { updatedAt: 'desc' },
          include: {
            users_tickets_assigneeIdTousers: { select: { name: true } }
          }
        })

        for (const ticket of statusChanged) {
          const hoursAgo = Math.floor((now.getTime() - ticket.updatedAt.getTime()) / (1000 * 60 * 60))
          const statusText = ticket.status === 'IN_PROGRESS' ? 'en progreso' : 'resuelto'
          const icon = ticket.status === 'IN_PROGRESS' ? '🔧' : '✅'
          
          alerts.push({
            id: `status-change-${ticket.id}-${ticket.status}`,
            type: ticket.status === 'RESOLVED' ? 'SUCCESS' : 'INFO',
            category: 'TICKET_UPDATE',
            title: `${icon} Ticket ${statusText}`,
            message: `Tu ticket "${ticket.title}" está ahora ${statusText}${ticket.users_tickets_assigneeIdTousers ? ` por ${ticket.users_tickets_assigneeIdTousers.name}` : ''}`,
            actionText: 'Ver detalles',
            actionUrl: `/client/tickets/${ticket.id}`,
            priority: ticket.status === 'RESOLVED' ? 20 : 35,
            isRead: false,
            isDismissed: false,
            createdAt: ticket.updatedAt,
            relatedIds: [ticket.id],
            ticket: { id: ticket.id, title: ticket.title }
          })
        }

        // 5. Tickets sin respuesta por mucho tiempo
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

      if (notificationId.startsWith('client-comment-')) {
        // Formato: client-comment-{ticketId}-{commentId}
        // No se oculta automáticamente, el técnico debe marcarla como leída
        return false
      }

      if (notificationId.startsWith('critical-comment-')) {
        // No se oculta automáticamente, el admin debe marcarla como leída
        return false
      }

      if (notificationId.startsWith('overloaded-techs-')) {
        // Se oculta al día siguiente
        return false
      }

      if (notificationId.startsWith('tech-response-')) {
        // No se oculta automáticamente, el cliente debe marcarla como leída
        return false
      }

      if (notificationId.startsWith('ticket-assigned-')) {
        const ticketId = notificationId.replace('ticket-assigned-', '')
        // Se oculta cuando el técnico hace el primer comentario
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

      if (notificationId.startsWith('status-change-')) {
        // No se oculta automáticamente, el cliente debe marcarla como leída
        return false
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
      'client-comment-',
      'critical-comment-',
      'overloaded-techs-',
      'tech-response-',
      'ticket-assigned-',
      'status-change-',
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