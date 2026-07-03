import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AssetRequestService } from '@/lib/services/asset-request.service'
import { canManageInventory } from '@/lib/inventory-access'

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
  const canManage =
    session.user.role === 'ADMIN' ||
    (session.user as { canManageInventory?: boolean }).canManageInventory === true
  if (!canRequest && !canManage) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  try {
    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const managesInventory = await canManageInventory(session.user.id, session.user.role)
    const families = await AssetRequestService.getEnabledFamilies(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      managesInventory
    )
    return NextResponse.json({ families })
  } catch (error) {
    console.error('[enabled-families]', error)
    return NextResponse.json({ error: 'Error al cargar familias' }, { status: 500 })
  }
}
