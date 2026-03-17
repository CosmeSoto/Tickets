import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConsumableService } from '@/lib/services/consumable.service'

/**
 * GET /api/inventory/consumables/summary
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const summary = await ConsumableService.getConsumableSummary()
    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error en GET /api/inventory/consumables/summary:', error)
    return NextResponse.json({ error: 'Error al obtener resumen' }, { status: 500 })
  }
}
