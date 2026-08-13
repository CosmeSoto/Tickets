import { NextRequest, NextResponse } from 'next/server'
import { checkContractExpiration } from '@/lib/cron/check-contract-expiration'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/contracts
 * Cron job para verificar vencimiento de contratos
 * Requiere secret en query params para seguridad
 */
export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

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
