import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { invalidateCache } from '@/lib/api-cache'

/**
 * DELETE /api/notifications/[id]
 * Eliminar una notificación propia.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: notificationId } = await params

    const notification = await prisma.notifications.findUnique({
      where: { id: notificationId },
      select: { id: true, userId: true },
    })

    if (!notification) {
      // Idempotente: ya no existe
      return NextResponse.json({ success: true })
    }

    if (notification.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.notifications.delete({ where: { id: notificationId } })

    try {
      await invalidateCache(`notif:list:${session.user.id}:*`)
    } catch {}

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json({ error: 'Error al eliminar notificación' }, { status: 500 })
  }
}
