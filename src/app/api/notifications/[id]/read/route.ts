import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/services/notification-service'
import prisma from '@/lib/prisma'
import { invalidateCache } from '@/lib/api-cache'

/**
 * Marcar notificación como leída o no leída.
 * Body opcional: { "isRead": false } → marcar no leída
 * Sin body / isRead true → marcar leída
 */
async function setReadState(request: NextRequest, params: Promise<{ id: string }>) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: notificationId } = await params

    let isRead = true
    try {
      const body = await request.json()
      if (typeof body?.isRead === 'boolean') {
        isRead = body.isRead
      }
    } catch {
      // sin body → marcar leída
    }

    const notification = await prisma.notifications.findUnique({
      where: { id: notificationId },
      select: { id: true, userId: true },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 })
    }

    if (notification.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = isRead
      ? await NotificationService.markAsRead(notificationId)
      : await NotificationService.markAsUnread(notificationId)

    try {
      await invalidateCache(`notif:list:${session.user.id}:*`)
    } catch {}

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating notification read state:', error)
    return NextResponse.json({ error: 'Error al actualizar estado de lectura' }, { status: 500 })
  }
}

/**
 * POST /api/notifications/[id]/read
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return setReadState(request, params)
}

/**
 * PATCH /api/notifications/[id]/read
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return setReadState(request, params)
}
