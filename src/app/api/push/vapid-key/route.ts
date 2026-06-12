/**
 * GET /api/push/vapid-key — Retorna la clave pública VAPID.
 *
 * El frontend la necesita para llamar a pushManager.subscribe().
 * Es pública (no requiere auth) porque se necesita antes del login
 * para registrar el Service Worker.
 */

import { NextResponse } from 'next/server'
import { WebPushService } from '@/lib/services/web-push.service'

export async function GET() {
  const publicKey = WebPushService.getPublicKey()

  if (!publicKey) {
    return NextResponse.json({ error: 'Web Push no configurado en el servidor' }, { status: 503 })
  }

  return NextResponse.json({ publicKey })
}
