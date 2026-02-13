import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/services/notification-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const userId = session.user.id
    const userRole = session.user.role

    // Obtener estado de notificaciones dinámicas del cliente (si se proporciona)
    const dynamicStateHeader = request.headers.get('x-dynamic-notifications-state')
    let clientDynamicState = { read: [], dismissed: [] }
    
    if (dynamicStateHeader) {
      try {
        clientDynamicState = JSON.parse(dynamicStateHeader)
      } catch (error) {
        console.warn('Invalid dynamic state header:', error)
      }
    }

    // Obtener todas las notificaciones usando el servicio unificado
    const allNotifications = await NotificationService.getUserNotifications(userId, userRole, limit)

    // Aplicar estado de localStorage para notificaciones dinámicas
    const processedNotifications = NotificationService.applyLocalStorageState(allNotifications, clientDynamicState)

    // Filtrar notificaciones que deben ocultarse (tareas completadas)
    const visibleNotifications = []
    for (const notification of processedNotifications) {
      const shouldHide = await NotificationService.shouldHideNotification(notification.id)
      if (!shouldHide) {
        visibleNotifications.push(notification)
      }
    }

    // Contar notificaciones no leídas
    const unreadCount = visibleNotifications.filter(n => !n.isRead).length

    return NextResponse.json({
      notifications: visibleNotifications,
      unreadCount,
      total: visibleNotifications.length
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
