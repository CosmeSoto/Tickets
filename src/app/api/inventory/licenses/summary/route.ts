import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LicenseService } from '@/lib/services/license.service'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'

const EMPTY_SUMMARY = {
  total: 0,
  active: 0,
  expired: 0,
  expiringThisMonth: 0,
  expiringSoon: 0,
  unassigned: 0,
  byType: {},
  totalCost: 0,
}

/**
 * GET /api/inventory/licenses/summary
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
    const summary = await LicenseService.getLicenseSummary(familyIds)
    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error en GET /api/inventory/licenses/summary:', error)
    return NextResponse.json({ error: 'Error al obtener resumen' }, { status: 500 })
  }
}
