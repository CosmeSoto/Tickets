import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalesManagerService } from '@/lib/services/sales-manager.service'
import {
  getInventorySessionContext,
  hasInventoryModuleAccess,
} from '@/lib/inventory/inventory-session'

/**
 * GET /api/inventory/sales/stats
 * Obtiene estadísticas de ventas
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const ctx = await getInventorySessionContext(session.user)
    if (!hasInventoryModuleAccess(ctx)) {
      return NextResponse.json(
        { error: 'No tiene permisos para ver estadísticas de ventas' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId') || undefined

    const stats = await SalesManagerService.getSalesStats(familyId)

    return NextResponse.json(stats, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo estadísticas de ventas:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener estadísticas' },
      { status: 500 }
    )
  }
}
