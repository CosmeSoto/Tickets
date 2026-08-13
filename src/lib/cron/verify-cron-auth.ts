import { NextResponse } from 'next/server'

/**
 * Autenticación compartida para endpoints /api/cron/*.
 * Acepta `Authorization: Bearer <CRON_SECRET>` o `?secret=<CRON_SECRET>`.
 * Retorna NextResponse 401/503 si falla, o null si está autorizado.
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET no configurado')
    return NextResponse.json(
      { success: false, error: 'CRON_SECRET no configurado' },
      { status: 503 }
    )
  }

  const authHeader = request.headers.get('authorization')
  const querySecret = new URL(request.url).searchParams.get('secret')

  const authorized =
    authHeader === `Bearer ${cronSecret}` ||
    (querySecret !== null && querySecret === cronSecret)

  if (!authorized) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  return null
}
