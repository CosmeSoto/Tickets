/**
 * POST /api/push/subscribe — Registra una suscripción push para el usuario autenticado.
 * DELETE /api/push/subscribe — Elimina una suscripción push (desuscripción).
 *
 * El frontend envía la PushSubscription obtenida del Service Worker.
 * Se guarda en BD vinculada al userId para enviar push cuando no tiene SSE activo.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WebPushService } from '@/lib/services/web-push.service'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { subscription } = body

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { error: 'Suscripción inválida: faltan endpoint o keys' },
        { status: 400 }
      )
    }

    const userAgent = request.headers.get('user-agent') ?? undefined

    await WebPushService.subscribe(session.user.id, subscription, userAgent)

    return NextResponse.json({ success: true, message: 'Suscripción push registrada' })
  } catch (error) {
    console.error('[POST /api/push/subscribe] Error:', error)
    return NextResponse.json({ error: 'Error al registrar suscripción' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json({ error: 'Falta el endpoint' }, { status: 400 })
    }

    await WebPushService.unsubscribe(endpoint)

    return NextResponse.json({ success: true, message: 'Suscripción eliminada' })
  } catch (error) {
    console.error('[DELETE /api/push/subscribe] Error:', error)
    return NextResponse.json({ error: 'Error al eliminar suscripción' }, { status: 500 })
  }
}
