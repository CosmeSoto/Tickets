// Sistema de notificaciones del navegador
export class NotificationService {
  private static instance: NotificationService
  private permission: NotificationPermission = 'default'

  private constructor() {
    // Solo verificar permisos en el cliente
    if (typeof window !== 'undefined') {
      this.checkPermission()
    }
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  private checkPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permission = Notification.permission
    }
  }

  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.log('Este navegador no soporta notificaciones')
      return false
    }

    if (this.permission === 'granted') {
      return true
    }

    const permission = await Notification.requestPermission()
    this.permission = permission
    return permission === 'granted'
  }

  async show(title: string, options?: NotificationOptions): Promise<void> {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return

    if (this.permission !== 'granted') {
      const granted = await this.requestPermission()
      if (!granted) return
    }

    try {
      const notification = new Notification(title, {
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        ...options,
      })

      // Auto cerrar después de 5 segundos
      setTimeout(() => notification.close(), 5000)

      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    } catch (error) {
      console.error('Error mostrando notificación:', error)
    }
  }

  // Notificaciones específicas del sistema de tickets
  async notifyNewComment(ticketId: string, author: string) {
    await this.show('Nuevo Comentario', {
      body: `${author} ha comentado en tu ticket`,
      tag: `comment-${ticketId}`,
      data: { ticketId, type: 'comment' },
    })
  }

  async notifyStatusChange(ticketId: string, newStatus: string) {
    const statusLabels: Record<string, string> = {
      OPEN: 'Abierto',
      IN_PROGRESS: 'En Progreso',
      RESOLVED: 'Resuelto',
      CLOSED: 'Cerrado',
    }

    await this.show('Estado Actualizado', {
      body: `Tu ticket ahora está: ${statusLabels[newStatus] || newStatus}`,
      tag: `status-${ticketId}`,
      data: { ticketId, type: 'status' },
    })
  }

  async notifyAssignment(ticketId: string, technicianName: string) {
    await this.show('Ticket Asignado', {
      body: `${technicianName} ha sido asignado a tu ticket`,
      tag: `assignment-${ticketId}`,
      data: { ticketId, type: 'assignment' },
    })
  }

  async notifyTaskCompleted(ticketId: string, taskTitle: string) {
    await this.show('Tarea Completada', {
      body: `Tarea completada: ${taskTitle}`,
      tag: `task-${ticketId}`,
      data: { ticketId, type: 'task' },
    })
  }

  async notifyResolved(ticketId: string) {
    await this.show('¡Ticket Resuelto!', {
      body: 'Tu ticket ha sido resuelto. Por favor califica el servicio.',
      tag: `resolved-${ticketId}`,
      data: { ticketId, type: 'resolved' },
    })
  }
}

export const notificationService = NotificationService.getInstance()
