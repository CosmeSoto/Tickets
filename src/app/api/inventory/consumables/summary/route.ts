import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConsumableService } from '@/lib/services/consumable.service'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'

const EMPTY_SUMMARY = {
  total: 0,
  lowStock: 0,
  outOfStock: 0,
  byType: {},
  totalValue: 0,
  recentMovements: 0,
}

/**
 * GET /api/inventory/consumables/summary
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const ctx = await getInventorySessionContext(session.user)
    if (ctx.scope.noAccess) {
      return NextResponse.json(EMPTY_SUMMARY)
    }

    const familyIds = ctx.user.isSuperAdmin ? undefined : ctx.scope.familyIds
    const summary = await ConsumableService.getConsumableSummary(familyIds)
    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error en GET /api/inventory/consumables/summary:', error)
    return NextResponse.json({ error: 'Error al obtener resumen' }, { status: 500 })
  }
}
