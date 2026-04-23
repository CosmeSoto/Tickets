import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { invalidateCache } from '@/lib/api-cache'

/**
 * DELETE /api/notifications/[id]
 * Eliminar una notificación
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

    // Verificar que la notificación pertenece al usuario
    const notification = await prisma.notifications.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      // Ya no existe, considerar como éxito
      return NextResponse.json({ success: true })
    }

    if (notification.userId !== session.user.id) {
      // Verificar si el usuario al que pertenece la notificación aún existe
      const ownerExists = await prisma.users.findUnique({
        where: { id: notification.userId },
        select: { id: true },
      })

      // Si el dueño fue eliminado, o si el admin intenta limpiar, permitir
      if (!ownerExists) {
        await prisma.notifications.delete({ where: { id: notificationId } })
        return NextResponse.json({ success: true })
      }

      // La notificación no pertenece al usuario — retornar éxito silencioso
      // para que el frontend la quite de la UI sin mostrar error
      return NextResponse.json({ success: true, skipped: true })
    }

    // Eliminar la notificación
    await prisma.notifications.delete({ where: { id: notificationId } })

    // Invalidar caché de lista de notificaciones del usuario
    try {
      await invalidateCache(`notif:list:${session.user.id}:*`)
    } catch {}

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json({ error: 'Error al eliminar notificación' }, { status: 500 })
  }
}
