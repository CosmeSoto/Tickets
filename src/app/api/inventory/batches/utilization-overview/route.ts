import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BatchService } from '@/lib/services/batch-inventory.service'
import { canAccessInventory } from '@/lib/navigation/role-home-path'

/**
 * GET /api/inventory/batches/utilization-overview
 * Panorama de utilización de lotes para dashboard.
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (!canAccessInventory(session.user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  try {
    const overview = await BatchService.getUtilizationOverview()
    return NextResponse.json(overview)
  } catch (error) {
    console.error('[GET /api/inventory/batches/utilization-overview]', error)
    return NextResponse.json({ error: 'Error al obtener panorama de lotes' }, { status: 500 })
  }
}
