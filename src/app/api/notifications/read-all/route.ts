import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/services/notification-service'
import { invalidateCache } from '@/lib/api-cache'

async function markAllNotificationsAsRead(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const result = await NotificationService.markAllAsRead(session.user.id)

    // Invalidar caché de lista
    try {
      await invalidateCache(`notif:list:${session.user.id}:*`)
    } catch {}

    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    console.error('Error marking all as read:', error)
    return NextResponse.json({ error: 'Error al marcar todas como leídas' }, { status: 500 })
  }
}

/**
 * POST /api/notifications/read-all
 * Marcar todas las notificaciones como leídas (método POST para compatibilidad)
 */
export async function POST(request: NextRequest) {
  return markAllNotificationsAsRead(request)
}

/**
 * PATCH /api/notifications/read-all
 * Marcar todas las notificaciones como leídas (método PATCH estándar)
 */
export async function PATCH(request: NextRequest) {
  return markAllNotificationsAsRead(request)
}
