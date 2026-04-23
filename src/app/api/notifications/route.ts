import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/services/notification-service'
import { withCache } from '@/lib/api-cache'

/**
 * GET /api/notifications
 * Caché de 10 segundos por usuario — absorbe remontajes de componentes
 * sin perder frescura (SSE entrega las nuevas en tiempo real)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const userId = session.user.id

    const notifications = await withCache(
      `notif:list:${userId}:${limit}`,
      10, // 10 segundos — SSE mantiene la frescura real
      () => NotificationService.getUserNotifications(userId, limit)
    )

    return NextResponse.json(notifications)
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 })
  }
}
