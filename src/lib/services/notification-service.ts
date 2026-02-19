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
            isActive: true,
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
          tech._count.tickets_tickets_assigneeIdTousers >= 10
        ).slice(0, 2)

        overloaded.forEach((tech, index) => {
          const ticketCount = tech._count.tickets_tickets_assigneeIdTousers
          alerts.push({
            id: `overloaded-tech-${tech.id}`,
            type: 'WARNING',
            category: 'SYSTEM_STATUS',
            title: `👤 Técnico sobrecargado`,
            message: `${tech.name} tiene ${ticketCount} tickets activos. Considera redistribuir la carga de trabajo.`,
            actionText: 'Ver tickets',
            actionUrl: `/admin/users/${tech.id}?view=tickets`,
            priority: 25 + index,
            isRead: false,
            isDismissed: false,
            createdAt: new Date(now.getTime() - 15 * 60 * 1000),
            count: ticketCount
          })
        })

        // 5. Resumen semanal (solo lunes)
        const today = now.getDay()
        const isMonday = today === 1
        const isMorning = now.getHours() >= 8 && now.getHours() < 12

        if (isMonday && isMorning) {
          const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          
          const weeklyStats = await prisma.tickets.groupBy({
            by: ['status'],
            where: {
              createdAt: {
                gte: weekStart
              }
            },
            _count: true
          })

          const totalWeekly = weeklyStats.reduce((sum, stat) => sum + stat._count, 0)
          const resolved = weeklyStats.find(s => s.status === 'RESOLVED')?._count || 0
          const resolutionRate = totalWeekly > 0 ? Math.round((resolved / totalWeekly) * 100) : 0

          alerts.push({
            id: `weekly-summary-${new Date().toISOString().split('T')[0]}`,
            type: 'INFO',
            category: 'SYSTEM_STATUS',
            title: `📊 Resumen semanal`,
            message: `Última semana: ${totalWeekly} tickets creados, ${resolved} resueltos (${resolutionRate}% tasa de resolución)`,
            actionText: 'Ver reporte completo',
            actionUrl: '/admin/reports?period=week',
            priority: 50,
            isRead: false,
            isDismissed: false,
            createdAt: new Date(now.getTime() - 10 * 60 * 1000),
            count: totalWeekly
          })
        }

        // 4. NUEVO: Técnicos sobrecargados
        const overloadedTechnicians = await prisma.users.findMany({
          where: {
            role: 'TECHNICIAN',
            isActive: true,
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
          },
          orderBy: {
            tickets_tickets_assigneeIdTousers: {
              _count: 'desc'
            }
          },
          take: 3
        })

        overloadedTechnicians.forEach((tech, index) => {
          const activeTickets = tech._count.tickets_tickets_assigneeIdTousers
          if (activeTickets >= 10) {
            alerts.push({
              id: `overloaded-tech-${tech.id}-${new Date().toISOString().split('T')[0]}`,
              type: 'WARNING',
              category: 'SYSTEM_STATUS',
              title: `👥 Técnico sobrecargado`,
              message: `${tech.name} tiene ${activeTickets} tickets activos. Considera redistribuir la carga de trabajo.`,
              actionText: 'Ver tickets',
              actionUrl: `/admin/users/${tech.id}?view=tickets`,
              priority: 25 + index,
              isRead: false,
              isDismissed: false,
              createdAt: new Date(now.getTime() - 45 * 60 * 1000),
              count: activeTickets
            })
          }
        })

        // 5. NUEVO: Resumen semanal (solo lunes)
        const today = new Date()
        const isMonday = today.getDay() === 1
        const isMorning = today.getHours() >= 8 && today.getHours() < 12

        if (isMonday && isMorning) {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          
          const weeklyStats = {
            created: await prisma.tickets.count({
              where: { createdAt: { gte: weekAgo } }
            }),
            resolved: await prisma.tickets.count({
              where: { 
                status: 'RESOLVED',
                resolvedAt: { gte: weekAgo }
              }
            }),
            pending: await prisma.tickets.count({
              where: { 
                status: { in: ['OPEN', 'IN_PROGRESS'] }
              }
            })
          }

          alerts.push({
            id: `weekly-summary-${today.toISOString().split('T')[0]}`,
            type: 'INFO',
            category: 'SYSTEM_STATUS',
            title: `📊 Resumen semanal`,
            message: `Última semana: ${weeklyStats.created} tickets creados, ${weeklyStats.resolved} resueltos. ${weeklyStats.pending} tickets pendientes.`,
            actionText: 'Ver reporte completo',
            actionUrl: '/admin/reports?period=week',
            priority: 50,
            isRead: false,
            isDismissed: false,
            createdAt: new Date(now.getTime() - 60 * 60 * 1000),
            count: weeklyStats.created
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

        // 3. Nuevos tickets asignados (últimas 2 horas)
        const newlyAssigned = await prisma.tickets.findMany({
          where: {
            assigneeId: userId,
            status: 'OPEN',
            updatedAt: {
              gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) // Últimas 2h
            }
          },
          take: 3,
          orderBy: { updatedAt: 'desc' },
          include: {
            users_tickets_clientIdTousers: { select: { name: true } },
            categories: { select: { name: true } }
          }
        })

        newlyAssigned.forEach((ticket, index) => {
          const minutesAgo = Math.floor((now.getTime() - ticket.updatedAt.getTime()) / (1000 * 60))
          alerts.push({
            id: `newly-assigned-${ticket.id}`,
            type: 'INFO',
            category: 'TICKET_UPDATE',
            title: `🎫 Nuevo ticket asignado`,
            message: `"${ticket.title}" de ${ticket.users_tickets_clientIdTousers?.name} te fue asignado hace ${minutesAgo}min. Categoría: ${ticket.categories?.name || 'Sin categoría'}`,
            actionText: 'Ver ticket',
            actionUrl: `/technician/tickets/${ticket.id}`,
            priority: 18 + index,
            isRead: false,
            isDismissed: false,
            createdAt: ticket.updatedAt,
            relatedIds: [ticket.id],
            ticket: { id: ticket.id, title: ticket.title }
          })
        })

        // 4. Cliente respondió en tickets activos
        const ticketsWithClientResponse = await prisma.tickets.findMany({
          where: {
            assigneeId: userId,
            status: { in: ['OPEN', 'IN_PROGRESS'] }
          },
          take: 5,
          include: {
            users_tickets_clientIdTousers: { select: { name: true } },
            comments: {
              where: {
                createdAt: {
                  gte: new Date(now.getTime() - 4 * 60 * 60 * 1000) // Últimas 4h
                },
                users: {
                  role: 'CLIENT'
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

        ticketsWithClientResponse
          .filter(ticket => ticket.comments.length > 0)
          .slice(0, 2)
          .forEach((ticket, index) => {
            const comment = ticket.comments[0]
            const hoursAgo = Math.floor((now.getTime() - comment.createdAt.getTime()) / (1000 * 60 * 60))
            alerts.push({
              id: `client-response-${ticket.id}-${comment.id}`,
              type: 'INFO',
              category: 'TICKET_UPDATE',
              title: `💬 Cliente respondió`,
              message: `${ticket.users_tickets_clientIdTousers?.name} respondió hace ${hoursAgo}h en "${ticket.title}"`,
              actionText: 'Ver respuesta',
              actionUrl: `/technician/tickets/${ticket.id}#comment-${comment.id}`,
              priority: 22 + index,
              isRead: false,
              isDismissed: false,
              createdAt: comment.createdAt,
              relatedIds: [ticket.id, comment.id],
              ticket: { id: ticket.id, title: ticket.title }
            })
          })

        // 5. Nuevas calificaciones recibidas
        const recentRatings = await prisma.ticket_ratings.findMany({
          where: {
            tickets: {
              assigneeId: userId
            },
            createdAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Últimas 24h
            }
          },
          take: 2,
          orderBy: { createdAt: 'desc' },
          include: {
            tickets: {
              select: {
                id: true,
                title: true,
                users_tickets_clientIdTousers: { select: { name: true } }
              }
            }
          }
        })

        recentRatings.forEach((rating, index) => {
          const hoursAgo = Math.floor((now.getTime() - rating.createdAt.getTime()) / (1000 * 60 * 60))
          const ratingEmoji = rating.rating >= 4 ? '⭐⭐⭐⭐⭐' : rating.rating >= 3 ? '⭐⭐⭐' : '⭐⭐'
          const ratingText = rating.rating >= 4 ? 'excelente' : rating.rating >= 3 ? 'buena' : 'necesita mejorar'
          
          alerts.push({
            id: `rating-received-${rating.id}`,
            type: rating.rating >= 4 ? 'SUCCESS' : rating.rating >= 3 ? 'INFO' : 'WARNING',
            category: 'USER_ACTION',
            title: `${ratingEmoji} Nueva calificación`,
            message: `${rating.tickets.users_tickets_clientIdTousers?.name} calificó "${rating.tickets.title}" como ${ratingText} (${rating.rating}/5) hace ${hoursAgo}h`,
            actionText: 'Ver detalles',
            actionUrl: `/technician/tickets/${rating.ticketId}?view=rating`,
            priority: 35 + index,
            isRead: false,
            isDismissed: false,
            createdAt: rating.createdAt,
            relatedIds: [rating.ticketId, rating.id]
          })
        })

        // 3. NUEVO: Nuevo ticket asignado (últimas 2h)
        const newlyAssigned = await prisma.tickets.findMany({
          where: {
            assigneeId: userId,
            status: 'OPEN',
            updatedAt: {
              gte: new Date(now.getTime() - 2 * 60 * 60 * 1000), // Últimas 2h
              gt: new Date(now.getTime() - 3 * 60 * 60 * 1000)   // Pero no muy recientes
            }
          },
          take: 2,
          orderBy: { updatedAt: 'desc' },
          include: {
            users_tickets_clientIdTousers: { select: { name: true } },
            categories: { select: { name: true } }
          }
        })

        newlyAssigned.forEach((ticket, index) => {
          const hoursAgo = Math.floor((now.getTime() - ticket.updatedAt.getTime()) / (1000 * 60 * 60))
          const priorityLabel = ticket.priority === 'URGENT' ? '🔴 Urgente' : 
                               ticket.priority === 'HIGH' ? '🟠 Alta' : 
                               ticket.priority === 'MEDIUM' ? '🟡 Media' : '🟢 Baja'
          
          alerts.push({
            id: `newly-assigned-${ticket.id}`,
            type: 'INFO',
            category: 'TICKET_UPDATE',
            title: `🔔 Nuevo ticket asignado`,
            message: `"${ticket.title}" de ${ticket.users_tickets_clientIdTousers?.name}. Prioridad: ${priorityLabel}. Categoría: ${ticket.categories?.name || 'Sin categoría'}`,
            actionText: 'Ver ticket',
            actionUrl: `/technician/tickets/${ticket.id}`,
            priority: 18 + index,
            isRead: false,
            isDismissed: false,
            createdAt: ticket.updatedAt,
            relatedIds: [ticket.id],
            ticket: { id: ticket.id, title: ticket.title }
          })
        })

        // 4. NUEVO: Cliente respondió (últimas 4h)
        const clientResponses = await prisma.tickets.findMany({
          where: {
            assigneeId: userId,
            status: { in: ['OPEN', 'IN_PROGRESS'] }
          },
          take: 5,
          orderBy: { updatedAt: 'desc' },
          include: {
            users_tickets_clientIdTousers: { select: { name: true } },
            comments: {
              where: {
                createdAt: {
                  gte: new Date(now.getTime() - 4 * 60 * 60 * 1000)
                },
                users: {
                  role: 'CLIENT'
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

        clientResponses.forEach((ticket, index) => {
          if (ticket.comments.length > 0) {
            const comment = ticket.comments[0]
            const hoursAgo = Math.floor((now.getTime() - comment.createdAt.getTime()) / (1000 * 60 * 60))
            
            alerts.push({
              id: `client-response-${ticket.id}-${comment.id}`,
              type: 'INFO',
              category: 'TICKET_UPDATE',
              title: `💬 Cliente respondió`,
              message: `${ticket.users_tickets_clientIdTousers?.name} respondió hace ${hoursAgo}h en "${ticket.title}"`,
              actionText: 'Ver respuesta',
              actionUrl: `/technician/tickets/${ticket.id}#comment-${comment.id}`,
              priority: 22 + index,
              isRead: false,
              isDismissed: false,
              createdAt: comment.createdAt,
              relatedIds: [ticket.id, comment.id],
              ticket: { id: ticket.id, title: ticket.title }
            })
          }
        })

        // 5. NUEVO: Nueva calificación recibida (últimas 24h)
        const recentRatings = await prisma.ticket_ratings.findMany({
          where: {
            createdAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000)
            },
            tickets: {
              assigneeId: userId
            }
          },
          take: 2,
          orderBy: { createdAt: 'desc' },
          include: {
            tickets: {
              select: {
                id: true,
                title: true,
                users_tickets_clientIdTousers: { select: { name: true } }
              }
            }
          }
        })

        recentRatings.forEach((rating, index) => {
          const hoursAgo = Math.floor((now.getTime() - rating.createdAt.getTime()) / (1000 * 60 * 60))
          const ratingEmoji = rating.rating >= 4 ? '⭐⭐⭐⭐⭐' : 
                             rating.rating >= 3 ? '⭐⭐⭐' : '⭐⭐'
          const ratingText = rating.rating >= 4 ? 'excelente' : 
                            rating.rating >= 3 ? 'buena' : 'necesita mejora'
          
          alerts.push({
            id: `new-rating-${rating.id}`,
            type: rating.rating >= 4 ? 'SUCCESS' : rating.rating >= 3 ? 'INFO' : 'WARNING',
            category: 'USER_ACTION',
            title: `⭐ Nueva calificación recibida`,
            message: `${rating.tickets.users_tickets_clientIdTousers?.name} calificó "${rating.tickets.title}" como ${ratingText} (${rating.rating}/5) ${ratingEmoji}`,
            actionText: 'Ver detalles',
            actionUrl: `/technician/tickets/${rating.tickets.id}?view=rating`,
            priority: 35 + index,
            isRead: false,
            isDismissed: false,
            createdAt: rating.createdAt,
            relatedIds: [rating.tickets.id, rating.id],
            ticket: { id: rating.tickets.id, title: rating.tickets.title }
          })
        })

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

        // 4. Ticket asignado a técnico (notificar quién)
        const recentlyAssigned = await prisma.tickets.findMany({
          where: {
            clientId: userId,
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            assigneeId: { not: null },
            updatedAt: {
              gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) // Últimas 6h
            }
          },
          take: 2,
          orderBy: { updatedAt: 'desc' },
          include: {
            users_tickets_assigneeIdTousers: { 
              select: { 
                id: true,
                name: true,
                email: true
              } 
            }
          }
        })

        recentlyAssigned.forEach((ticket, index) => {
          const hoursAgo = Math.floor((now.getTime() - ticket.updatedAt.getTime()) / (1000 * 60 * 60))
          alerts.push({
            id: `ticket-assigned-${ticket.id}`,
            type: 'SUCCESS',
            category: 'TICKET_UPDATE',
            title: `✅ Ticket asignado`,
            message: `Tu ticket "${ticket.title}" fue asignado a ${ticket.users_tickets_assigneeIdTousers?.name} hace ${hoursAgo}h. Pronto recibirás una respuesta.`,
            actionText: 'Ver ticket',
            actionUrl: `/client/tickets/${ticket.id}`,
            priority: 28 + index,
            isRead: false,
            isDismissed: false,
            createdAt: ticket.updatedAt,
            relatedIds: [ticket.id],
            ticket: { id: ticket.id, title: ticket.title }
          })
        })

        // 5. Cambio de estado del ticket
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

        statusChanged.forEach((ticket, index) => {
          const hoursAgo = Math.floor((now.getTime() - ticket.updatedAt.getTime()) / (1000 * 60 * 60))
          const statusText = ticket.status === 'IN_PROGRESS' ? 'En Progreso' : 'Resuelto'
          const statusEmoji = ticket.status === 'IN_PROGRESS' ? '🔧' : '✅'
          
          alerts.push({
            id: `status-changed-${ticket.id}`,
            type: ticket.status === 'RESOLVED' ? 'SUCCESS' : 'INFO',
            category: 'TICKET_UPDATE',
            title: `${statusEmoji} Estado actualizado`,
            message: `Tu ticket "${ticket.title}" cambió a "${statusText}" hace ${hoursAgo}h${ticket.users_tickets_assigneeIdTousers ? ` por ${ticket.users_tickets_assigneeIdTousers.name}` : ''}`,
            actionText: 'Ver ticket',
            actionUrl: `/client/tickets/${ticket.id}`,
            priority: 26 + index,
            isRead: false,
            isDismissed: false,
            createdAt: ticket.updatedAt,
            relatedIds: [ticket.id],
            ticket: { id: ticket.id, title: ticket.title }
          })
        })

        // 6. Ticket resuelto - pedir confirmación
        const recentlyResolved = await prisma.tickets.findMany({
          where: {
            clientId: userId,
            status: 'RESOLVED',
            resolvedAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Últimas 24h
              lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) // Pero no muy reciente
            }
          },
          take: 1,
          orderBy: { resolvedAt: 'desc' },
          include: {
            users_tickets_assigneeIdTousers: { select: { name: true } }
          }
        })

        recentlyResolved.forEach((ticket, index) => {
          const hoursAgo = Math.floor((now.getTime() - (ticket.resolvedAt?.getTime() || 0)) / (1000 * 60 * 60))
          alerts.push({
            id: `ticket-resolved-${ticket.id}`,
            type: 'SUCCESS',
            category: 'USER_ACTION',
            title: `✅ Ticket resuelto`,
            message: `Tu ticket "${ticket.title}" fue marcado como resuelto hace ${hoursAgo}h por ${ticket.users_tickets_assigneeIdTousers?.name}. ¿El problema está solucionado?`,
            actionText: 'Confirmar resolución',
            actionUrl: `/client/tickets/${ticket.id}?action=confirm`,
            priority: 32 + index,
            isRead: false,
            isDismissed: false,
            createdAt: ticket.resolvedAt || ticket.updatedAt,
            relatedIds: [ticket.id],
            ticket: { id: ticket.id, title: ticket.title }
          })
        })

        // 4. NUEVO: Ticket asignado a técnico (últimas 4h)
        const recentlyAssigned = await prisma.tickets.findMany({
          where: {
            clientId: userId,
            assigneeId: { not: null },
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            updatedAt: {
              gte: new Date(now.getTime() - 4 * 60 * 60 * 1000),
              gt: new Date(now.getTime() - 5 * 60 * 60 * 1000)
            }
          },
          take: 2,
          orderBy: { updatedAt: 'desc' },
          include: {
            users_tickets_assigneeIdTousers: { 
              select: { 
                name: true, 
                email: true,
                departments: { select: { name: true } }
              } 
            }
          }
        })

        recentlyAssigned.forEach((ticket, index) => {
          const hoursAgo = Math.floor((now.getTime() - ticket.updatedAt.getTime()) / (1000 * 60 * 60))
          const techName = ticket.users_tickets_assigneeIdTousers?.name || 'un técnico'
          const deptName = ticket.users_tickets_assigneeIdTousers?.departments?.name || 'Soporte'
          
          alerts.push({
            id: `ticket-assigned-${ticket.id}`,
            type: 'SUCCESS',
            category: 'TICKET_UPDATE',
            title: `✅ Ticket asignado`,
            message: `Tu ticket "${ticket.title}" fue asignado a ${techName} del departamento ${deptName} hace ${hoursAgo}h`,
            actionText: 'Ver ticket',
            actionUrl: `/client/tickets/${ticket.id}`,
            priority: 20,
            isRead: false,
            isDismissed: false,
            createdAt: ticket.updatedAt,
            relatedIds: [ticket.id],
            ticket: { id: ticket.id, title: ticket.title }
          })
        })

        // 5. NUEVO: Cambio de estado (últimas 6h)
        const statusChanges = await prisma.tickets.findMany({
          where: {
            clientId: userId,
            updatedAt: {
              gte: new Date(now.getTime() - 6 * 60 * 60 * 1000),
              gt: new Date(now.getTime() - 7 * 60 * 60 * 1000)
            }
          },
          take: 3,
          orderBy: { updatedAt: 'desc' },
          include: {
            users_tickets_assigneeIdTousers: { select: { name: true } }
          }
        })

        statusChanges.forEach((ticket, index) => {
          const hoursAgo = Math.floor((now.getTime() - ticket.updatedAt.getTime()) / (1000 * 60 * 60))
          const statusLabels: Record<string, { emoji: string, text: string, type: 'INFO' | 'SUCCESS' | 'WARNING' }> = {
            'OPEN': { emoji: '🔵', text: 'Abierto', type: 'INFO' },
            'IN_PROGRESS': { emoji: '🟡', text: 'En Progreso', type: 'INFO' },
            'RESOLVED': { emoji: '🟢', text: 'Resuelto', type: 'SUCCESS' },
            'CLOSED': { emoji: '⚫', text: 'Cerrado', type: 'INFO' }
          }
          
          const statusInfo = statusLabels[ticket.status] || { emoji: '🔵', text: ticket.status, type: 'INFO' }
          
          alerts.push({
            id: `status-change-${ticket.id}-${ticket.updatedAt.getTime()}`,
            type: statusInfo.type,
            category: 'TICKET_UPDATE',
            title: `${statusInfo.emoji} Estado actualizado`,
            message: `Tu ticket "${ticket.title}" cambió a ${statusInfo.text} hace ${hoursAgo}h${ticket.users_tickets_assigneeIdTousers ? ` por ${ticket.users_tickets_assigneeIdTousers.name}` : ''}`,
            actionText: 'Ver ticket',
            actionUrl: `/client/tickets/${ticket.id}`,
            priority: 28 + index,
            isRead: false,
            isDismissed: false,
            createdAt: ticket.updatedAt,
            relatedIds: [ticket.id],
            ticket: { id: ticket.id, title: ticket.title }
          })
        })

        // 6. NUEVO: Ticket resuelto - pedir confirmación (últimas 12h)
        const recentlyResolved = await prisma.tickets.findMany({
          where: {
            clientId: userId,
            status: 'RESOLVED',
            resolvedAt: {
              gte: new Date(now.getTime() - 12 * 60 * 60 * 1000),
              lt: new Date(now.getTime() - 1 * 60 * 60 * 1000)
            }
          },
          take: 2,
          orderBy: { resolvedAt: 'desc' },
          include: {
            users_tickets_assigneeIdTousers: { select: { name: true } }
          }
        })

        for (const ticket of recentlyResolved) {
          const hasRating = await prisma.ticket_ratings.findFirst({
            where: { ticketId: ticket.id }
          })

          if (!hasRating) {
            const hoursAgo = Math.floor((now.getTime() - (ticket.resolvedAt?.getTime() || 0)) / (1000 * 60 * 60))
            alerts.push({
              id: `resolved-confirm-${ticket.id}`,
              type: 'SUCCESS',
              category: 'USER_ACTION',
              title: `✅ Ticket resuelto`,
              message: `"${ticket.title}" fue marcado como resuelto hace ${hoursAgo}h por ${ticket.users_tickets_assigneeIdTousers?.name}. ¿Confirmas que tu problema fue solucionado?`,
              actionText: 'Confirmar y calificar',
              actionUrl: `/client/tickets/${ticket.id}?action=rate`,
              priority: 23,
              isRead: false,
              isDismissed: false,
              createdAt: ticket.resolvedAt || ticket.updatedAt,
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

      if (notificationId.startsWith('overloaded-tech-')) {
        // No ocultar automáticamente, requiere acción manual
        return false
      }

      if (notificationId.startsWith('activity-spike-') || notificationId.startsWith('weekly-summary-')) {
        // Notificaciones informativas, no se ocultan automáticamente
        return false
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

      if (notificationId.startsWith('newly-assigned-')) {
        // No ocultar automáticamente, el técnico debe verlo
        return false
      }

      if (notificationId.startsWith('client-response-')) {
        // No ocultar automáticamente, requiere atención del técnico
        return false
      }

      if (notificationId.startsWith('rating-received-')) {
        // No ocultar automáticamente, el técnico debe ver su calificación
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

      if (notificationId.startsWith('ticket-assigned-')) {
        // No ocultar automáticamente, el cliente debe saber quién lo atiende
        return false
      }

      if (notificationId.startsWith('status-changed-')) {
        // No ocultar automáticamente, el cliente debe ver los cambios
        return false
      }

      if (notificationId.startsWith('ticket-resolved-')) {
        // No ocultar automáticamente, requiere confirmación del cliente
        return false
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
      // Admin
      'activity-spike-',
      'critical-unassigned-',
      'sla-warning-',
      'overdue-sla-',
      'overloaded-tech-',
      'weekly-summary-',
      // Technician
      'urgent-assigned-',
      'no-response-',
      'newly-assigned-',
      'client-response-',
      'rating-received-',
      // Client
      'rating-pending-',
      'ticket-update-',
      'stale-ticket-',
      'ticket-assigned-',
      'status-changed-',
      'ticket-resolved-'
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