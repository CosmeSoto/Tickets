import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationService } from '@/lib/services/notification-service'
import prisma from '@/lib/prisma'
import { invalidateCache } from '@/lib/api-cache'

/**
 * Función compartida para marcar notificación como leída
 */
async function markNotificationAsRead(request: NextRequest, params: Promise<{ id: string }>) {
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
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 })
    }

    if (notification.userId !== session.user.id) {
      // La notificación no pertenece a este usuario — retornar éxito silencioso
      // para evitar errores 403 cuando el componente intenta marcar notificaciones
      // que no son del usuario actual (ej: notificaciones dinámicas mezcladas)
      return NextResponse.json({ success: true, skipped: true })
    }

    const updatedNotification = await NotificationService.markAsRead(notificationId)

    // Invalidar caché de lista
    try {
      await invalidateCache(`notif:list:${session.user.id}:*`)
    } catch {}

    return NextResponse.json(updatedNotification)
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return NextResponse.json({ error: 'Error al marcar como leída' }, { status: 500 })
  }
}

/**
 * POST /api/notifications/[id]/read
 * Marcar una notificación como leída (método POST para compatibilidad)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return markNotificationAsRead(request, params)
}

/**
 * PATCH /api/notifications/[id]/read
 * Marcar una notificación como leída (método PATCH estándar)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return markNotificationAsRead(request, params)
}
