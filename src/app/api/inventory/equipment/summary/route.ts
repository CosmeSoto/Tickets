import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentService } from '@/lib/services/equipment.service'

/**
 * GET /api/inventory/equipment/summary
 * Obtiene resumen de equipos para el dashboard
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    const summary = await EquipmentService.getEquipmentSummary()

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error en GET /api/inventory/equipment/summary:', error)
    
    return NextResponse.json(
      { error: 'Error al obtener resumen de equipos' },
      { status: 500 }
    )
  }
}
