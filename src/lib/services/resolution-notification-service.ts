/**
 * Servicio de Notificaciones para Planes de Resolución
 */

import { NotificationService } from './notification-service'

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
  static async notifyTaskAssigned(data: ResolutionTaskNotification): Promise<void> {
    await NotificationService.push({
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
        link: `/technician/tickets/${data.ticketId}?tab=resolution`,
      },
    }).catch(err => console.error('❌ Error notifyTaskAssigned:', err))
  }

  static async notifyTaskDueSoon(data: ResolutionTaskNotification): Promise<void> {
    const hoursUntilDue = Math.floor(
      (data.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60)
    )
    await NotificationService.push({
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
        link: `/technician/tickets/${data.ticketId}?tab=resolution`,
      },
    }).catch(err => console.error('❌ Error notifyTaskDueSoon:', err))
  }

  static async notifyTaskOverdue(data: ResolutionTaskNotification): Promise<void> {
    const hoursOverdue = Math.floor(
      (new Date().getTime() - data.dueDate.getTime()) / (1000 * 60 * 60)
    )
    await NotificationService.push({
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
        link: `/technician/tickets/${data.ticketId}?tab=resolution`,
      },
    }).catch(err => console.error('❌ Error notifyTaskOverdue:', err))
  }

  static async notifyTaskCompleted(
    taskId: string,
    taskTitle: string,
    completedBy: string,
    ticketId: string,
    notifyUsers: string[]
  ): Promise<void> {
    await Promise.all(
      notifyUsers
        .filter(userId => userId !== completedBy)
        .map(userId =>
          NotificationService.push({
            userId,
            type: 'SUCCESS',
            title: '✅ Tarea completada',
            message: `La tarea "${taskTitle}" ha sido completada`,
            ticketId,
            metadata: {
              taskId,
              taskTitle,
              completedBy,
              link: `/admin/tickets/${ticketId}?tab=resolution`,
            },
          }).catch(err => console.error('❌ Error notifyTaskCompleted:', err))
        )
    )
  }

  static async getUpcomingTasks(userId: string, hoursAhead = 24) {
    const { default: prisma } = await import('@/lib/prisma')
    const now = new Date()
    const futureDate = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)
    return prisma.resolution_tasks.findMany({
      where: {
        assignedTo: userId,
        status: { in: ['pending', 'in_progress'] },
        dueDate: { gte: now, lte: futureDate },
      },
      include: {
        plan: { include: { ticket: { select: { id: true, title: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    }).catch(() => [])
  }

  static async getOverdueTasks(userId: string) {
    const { default: prisma } = await import('@/lib/prisma')
    return prisma.resolution_tasks.findMany({
      where: {
        assignedTo: userId,
        status: { in: ['pending', 'in_progress'] },
        dueDate: { lt: new Date() },
      },
      include: {
        plan: { include: { ticket: { select: { id: true, title: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    }).catch(() => [])
  }
}
