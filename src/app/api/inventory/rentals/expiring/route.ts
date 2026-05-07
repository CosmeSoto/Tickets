import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { RentalAlertService } from '@/lib/services/rental-alert.service'

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
    const days = parseInt(searchParams.get('days') || '30')

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
