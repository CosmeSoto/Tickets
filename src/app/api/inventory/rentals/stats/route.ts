import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { RentalAlertService } from '@/lib/services/rental-alert.service'

/**
 * GET /api/inventory/rentals/stats
 * Obtiene estadísticas de arrendamientos
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')

    const stats = await RentalAlertService.getStats(familyId || undefined)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error getting rental stats:', error)
    return NextResponse.json(
      { error: 'Error al obtener estadísticas de arrendamientos' },
      { status: 500 }
    )
  }
}
