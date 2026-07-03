import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AssetRequestService } from '@/lib/services/asset-request.service'

/**
 * GET /api/inventory/asset-requests/enabled-families
 * Familias con solicitud de activos habilitada (para formulario de creación).
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const canRequest = session.user.canRequestAssets ?? false
  if (!canRequest && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  try {
    const families = await AssetRequestService.getEnabledFamilies(
      session.user.id,
      session.user.role,
      (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    )
    return NextResponse.json({ families })
  } catch (error) {
    console.error('[enabled-families]', error)
    return NextResponse.json({ error: 'Error al cargar familias' }, { status: 500 })
  }
}
