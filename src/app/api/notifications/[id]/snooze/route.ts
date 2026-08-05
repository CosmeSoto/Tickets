import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { NotificationService } from '@/lib/services/notification-service'
import { resolveMutedUntil, upsertMute, type MuteDuration } from '@/lib/notifications/mute-service'
import { buildEntityKey } from '@/lib/notifications/entity-key'
import prisma from '@/lib/prisma'
import { invalidateCache } from '@/lib/api-cache'

const bodySchema = z.object({
  duration: z.enum(['1h', '8h', '24h']).default('1h'),
  /** Si true, también silencia el hilo (no solo esta notificación) */
  muteThread: z.boolean().optional().default(false),
})

/**
 * POST /api/notifications/[id]/snooze
 * Posponer una notificación (y opcionalmente el hilo completo).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const until = resolveMutedUntil(parsed.data.duration as MuteDuration)
    if (!until) {
      return NextResponse.json({ error: 'Duración inválida para snooze' }, { status: 400 })
    }

    const updated = await NotificationService.snoozeNotification(id, session.user.id, until)
    if (!updated) {
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 })
    }

    if (parsed.data.muteThread) {
      const entityKey = buildEntityKey({
        ticketId: updated.ticketId,
        metadata: (updated.metadata as Record<string, any>) ?? null,
      })
      if (entityKey) {
        await upsertMute(session.user.id, entityKey, until)
      }
    }

    try {
      await invalidateCache(`notif:list:${session.user.id}:*`)
    } catch {}

    // Limpiar snoozes vencidos de otras notificaciones (best-effort)
    prisma.notifications
      .updateMany({
        where: {
          userId: session.user.id,
          snoozedUntil: { lte: new Date() },
        },
        data: { snoozedUntil: null },
      })
      .catch(() => {})

    return NextResponse.json({ success: true, notification: updated, until })
  } catch (error) {
    console.error('[snooze] error:', error)
    return NextResponse.json({ error: 'Error al posponer' }, { status: 500 })
  }
}
