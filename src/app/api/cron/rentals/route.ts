import { NextRequest, NextResponse } from 'next/server'
import { checkRentalExpiration } from '@/lib/cron/check-rental-expiration'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

/**
 * GET /api/cron/rentals
 * Cron job para verificar vencimientos de arrendamientos
 *
 * Configurar en cron:
 * 0 9 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/rentals
 */
export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    const result = await checkRentalExpiration()

    return NextResponse.json({
      success: true,
      alertsSent: result.alertsSent,
      equipmentCodes: result.equipmentCodes,
      contractsExpiring: result.contractsExpiring,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in rental expiration cron:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error al verificar arrendamientos',
      },
      { status: 500 }
    )
  }
}
