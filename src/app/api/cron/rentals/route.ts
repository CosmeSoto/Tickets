import { NextRequest, NextResponse } from 'next/server'
import { checkRentalExpiration } from '@/lib/cron/check-rental-expiration'

/**
 * GET /api/cron/rentals
 * Cron job para verificar vencimientos de arrendamientos
 *
 * Configurar en cron:
 * 0 9 * * * curl https://tu-dominio.com/api/cron/rentals?secret=TU_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar secret para seguridad
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

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
