import { NextRequest, NextResponse } from 'next/server'
import { checkContractExpiration } from '@/lib/cron/check-contract-expiration'

// GET /api/cron/contracts — ejecutado por el scheduler (cron externo o Docker)
// Protegido con CRON_SECRET para evitar ejecuciones no autorizadas
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const result = await checkContractExpiration()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[CRON /api/cron/contracts]', err)
    return NextResponse.json({ error: 'Error en el job' }, { status: 500 })
  }
}
