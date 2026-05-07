import { NextRequest, NextResponse } from 'next/server'
import { checkContractExpiration } from '@/lib/cron/check-contract-expiration'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/contracts
 * Cron job para verificar vencimiento de contratos
 * Requiere secret en query params para seguridad
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    // Verificar secret
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const result = await checkContractExpiration()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error en cron de contratos:', error)
    return NextResponse.json({ error: 'Error al verificar contratos' }, { status: 500 })
  }
}
