import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/services/notification-service'
import { withCache } from '@/lib/api-cache'

/**
 * GET /api/notifications
 * Paginación por cursor + filtros opcionales.
 * Caché corta solo en la primera página sin filtros (SSE mantiene frescura).
 *
 * Query:
 *  - limit (default 20, max 100)
 *  - cursor (id de la última notificación cargada)
 *  - filterRead: all | unread | read
 *  - type: all | SUCCESS | INFO | WARNING | ERROR | INVENTORY | PATROL | TICKET
 *  - q: búsqueda en título/mensaje
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100)
    const cursor = searchParams.get('cursor')
    const filterRead = searchParams.get('filterRead') || 'all'
    const type = searchParams.get('type') || 'all'
    const q = searchParams.get('q')
    const userId = session.user.id

    const isRead = filterRead === 'unread' ? false : filterRead === 'read' ? true : null

    const fetchPage = () =>
      NotificationService.getUserNotifications(userId, {
        limit,
        cursor,
        isRead,
        typeGroup: type === 'all' ? null : type,
        q,
      })

    // Caché solo primera página sin filtros/búsqueda (evita servir resultados stale filtrados)
    const canCache = !cursor && filterRead === 'all' && type === 'all' && !q
    const page = canCache
      ? await withCache(`notif:list:${userId}:${limit}`, 10, fetchPage)
      : await fetchPage()

    return NextResponse.json(page)
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 })
  }
}
