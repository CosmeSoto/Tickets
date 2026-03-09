/**
 * Servicio de Notificaciones para Planes de Resolución
 * Gestiona notificaciones cuando se crean/actualizan tareas en planes de resolución
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export interface ResolutionTaskNotification {
  taskId: string
  taskTitle: string
  dueDate: Date
  assignedTo: string
  planTitle: string
  ticketId: string
  ticketTitle: string
}

export class ResolutionNotificationService {
  /**
   * Crea notificación cuando se asigna una tarea a un técnico
   */
  static async notifyTaskAssigned(data: ResolutionTaskNotification): Promise<void> {
    try {
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          userId: data.assignedTo,
          type: 'INFO',
          title: '📋 Nueva tarea asignada',
          message: `Se te ha asignado la tarea "${data.taskTitle}" del plan "${data.planTitle}". Fecha límite: ${data.dueDate.toLocaleDateString('es-EC')}`,
          ticketId: data.ticketId,
          metadata: {
            taskId: data.taskId,
            taskTitle: data.taskTitle,
            dueDate: data.dueDate.toISOString(),
            planTitle: data.planTitle,
            actionUrl: `/technician/tickets/${data.ticketId}?tab=resolution`
          },
          isRead: false,
          createdAt: new Date()
        }
      })

      console.log(`✅ Notificación de tarea asignada enviada a usuario ${data.assignedTo}`)
    } catch (error) {
      console.error('❌ Error creando notificación de tarea asignada:', error)
    }
  }

  /**
   * Crea notificación cuando una tarea está próxima a vencer
   */
  static async notifyTaskDueSoon(data: ResolutionTaskNotification): Promise<void> {
    try {
      const hoursUntilDue = Math.floor(
        (data.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60)
      )

      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          userId: data.assignedTo,
          type: 'WARNING',
          title: '⏰ Tarea próxima a vencer',
          message: `La tarea "${data.taskTitle}" vence en ${hoursUntilDue} horas (${data.dueDate.toLocaleString('es-EC')})`,
          ticketId: data.ticketId,
          metadata: {
            taskId: data.taskId,
            taskTitle: data.taskTitle,
            dueDate: data.dueDate.toISOString(),
            hoursUntilDue,
            actionUrl: `/technician/tickets/${data.ticketId}?tab=resolution`
          },
          isRead: false,
          createdAt: new Date()
        }
      })

      console.log(`⏰ Notificación de tarea próxima a vencer enviada a usuario ${data.assignedTo}`)
    } catch (error) {
      console.error('❌ Error creando notificación de tarea próxima a vencer:', error)
    }
  }

  /**
   * Crea notificación cuando una tarea ha vencido
   */
  static async notifyTaskOverdue(data: ResolutionTaskNotification): Promise<void> {
    try {
      const hoursOverdue = Math.floor(
        (new Date().getTime() - data.dueDate.getTime()) / (1000 * 60 * 60)
      )

      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          userId: data.assignedTo,
          type: 'ERROR',
          title: '🚨 Tarea vencida',
          message: `La tarea "${data.taskTitle}" venció hace ${hoursOverdue} horas. Fecha límite era: ${data.dueDate.toLocaleString('es-EC')}`,
          ticketId: data.ticketId,
          metadata: {
            taskId: data.taskId,
            taskTitle: data.taskTitle,
            dueDate: data.dueDate.toISOString(),
            hoursOverdue,
            actionUrl: `/technician/tickets/${data.ticketId}?tab=resolution`
          },
          isRead: false,
          createdAt: new Date()
        }
      })

      console.log(`🚨 Notificación de tarea vencida enviada a usuario ${data.assignedTo}`)
    } catch (error) {
      console.error('❌ Error creando notificación de tarea vencida:', error)
    }
  }

  /**
   * Crea notificación cuando se completa una tarea
   */
  static async notifyTaskCompleted(
    taskId: string,
    taskTitle: string,
    completedBy: string,
    ticketId: string,
    notifyUsers: string[]
  ): Promise<void> {
    try {
      for (const userId of notifyUsers) {
        if (userId === completedBy) continue // No notificar al que completó

        await prisma.notifications.create({
          data: {
            id: randomUUID(),
            userId,
            type: 'SUCCESS',
            title: '✅ Tarea completada',
            message: `La tarea "${taskTitle}" ha sido completada`,
            ticketId,
            metadata: {
              taskId,
              taskTitle,
              completedBy,
              actionUrl: `/admin/tickets/${ticketId}?tab=resolution`
            },
            isRead: false,
            createdAt: new Date()
          }
        })
      }

      console.log(`✅ Notificaciones de tarea completada enviadas`)
    } catch (error) {
      console.error('❌ Error creando notificaciones de tarea completada:', error)
    }
  }

  /**
   * Obtiene tareas próximas a vencer para un usuario
   */
  static async getUpcomingTasks(userId: string, hoursAhead: number = 24) {
    try {
      const now = new Date()
      const futureDate = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)

      const tasks = await prisma.resolution_tasks.findMany({
        where: {
          assignedTo: userId,
          status: { in: ['pending', 'in_progress'] },
          dueDate: {
            gte: now,
            lte: futureDate
          }
        },
        include: {
          plan: {
            include: {
              ticket: {
                select: {
                  id: true,
                  title: true
                }
              }
            }
          }
        },
        orderBy: {
          dueDate: 'asc'
        }
      })

      return tasks
    } catch (error) {
      console.error('❌ Error obteniendo tareas próximas:', error)
      return []
    }
  }

  /**
   * Obtiene tareas vencidas para un usuario
   */
  static async getOverdueTasks(userId: string) {
    try {
      const now = new Date()

      const tasks = await prisma.resolution_tasks.findMany({
        where: {
          assignedTo: userId,
          status: { in: ['pending', 'in_progress'] },
          dueDate: {
            lt: now
          }
        },
        include: {
          plan: {
            include: {
              ticket: {
                select: {
                  id: true,
                  title: true
                }
              }
            }
          }
        },
        orderBy: {
          dueDate: 'asc'
        }
      })

      return tasks
    } catch (error) {
      console.error('❌ Error obteniendo tareas vencidas:', error)
      return []
    }
  }
}
