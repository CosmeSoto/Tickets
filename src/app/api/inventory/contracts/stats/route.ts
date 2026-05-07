import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractAlertService } from '@/lib/services/contract-alert.service'

/**
 * GET /api/inventory/contracts/stats
 * Obtiene estadísticas de contratos
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId') || undefined

    const stats = await ContractAlertService.getExpiringStats(familyId)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error obteniendo estadísticas de contratos:', error)
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 })
  }
}
