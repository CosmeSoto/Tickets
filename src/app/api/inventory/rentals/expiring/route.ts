import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { RentalAlertService } from '@/lib/services/rental-alert.service'
import { getSetting } from '@/lib/api-cache'

/**
 * GET /api/inventory/rentals/expiring
 * Obtiene lista de arrendamientos próximos a vencer
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')
    const daysParam = searchParams.get('days')
    let days: number
    if (daysParam != null) {
      days = parseInt(daysParam, 10)
    } else {
      const raw = await getSetting('inventory.contract_alert_days', 600, '30')
      days = Math.max(1, parseInt(raw ?? '30', 10) || 30)
    }

    const rentals = await RentalAlertService.getExpiringRentals(familyId || undefined, days)

    return NextResponse.json(rentals)
  } catch (error) {
    console.error('Error getting expiring rentals:', error)
    return NextResponse.json(
      { error: 'Error al obtener arrendamientos próximos a vencer' },
      { status: 500 }
    )
  }
}
