import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import {
  cleanupExpiredMutes,
  listActiveMutes,
  removeMute,
  resolveMutedUntil,
  upsertMute,
  type MuteDuration,
} from '@/lib/notifications/mute-service'
import { invalidateCache } from '@/lib/api-cache'

const postSchema = z.object({
  entityKey: z.string().min(3).max(200),
  duration: z.enum(['1h', '8h', '24h', 'forever']).default('forever'),
})

/**
 * GET /api/notifications/mutes — listar silencios activos
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await cleanupExpiredMutes(session.user.id).catch(() => {})
    const mutes = await listActiveMutes(session.user.id)
    return NextResponse.json({ mutes })
  } catch (error) {
    console.error('[mutes] GET error:', error)
    return NextResponse.json({ error: 'Error al listar silencios' }, { status: 500 })
  }
}

/**
 * POST /api/notifications/mutes — silenciar / snooze hilo
 * Body: { entityKey, duration: '1h'|'8h'|'24h'|'forever' }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const mutedUntil = resolveMutedUntil(parsed.data.duration as MuteDuration)
    const mute = await upsertMute(session.user.id, parsed.data.entityKey, mutedUntil)

    try {
      await invalidateCache(`notif:list:${session.user.id}:*`)
    } catch {}

    return NextResponse.json({ success: true, mute })
  } catch (error) {
    console.error('[mutes] POST error:', error)
    return NextResponse.json({ error: 'Error al silenciar' }, { status: 500 })
  }
}

/**
 * DELETE /api/notifications/mutes?entityKey=ticket:xxx — reactivar hilo
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const entityKey = new URL(request.url).searchParams.get('entityKey')
    if (!entityKey) {
      return NextResponse.json({ error: 'entityKey requerido' }, { status: 400 })
    }

    await removeMute(session.user.id, entityKey)

    try {
      await invalidateCache(`notif:list:${session.user.id}:*`)
    } catch {}

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[mutes] DELETE error:', error)
    return NextResponse.json({ error: 'Error al quitar silencio' }, { status: 500 })
  }
}
