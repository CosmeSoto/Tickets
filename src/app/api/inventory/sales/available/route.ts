import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalesManagerService } from '@/lib/services/sales-manager.service'

/**
 * GET /api/inventory/sales/available
 * Obtiene equipos disponibles para activar en venta
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar permisos
    if (!session.user.canManageInventory && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No tiene permisos para ver equipos disponibles' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId') || undefined
    const modelId = searchParams.get('modelId') || undefined
    const warehouseId = searchParams.get('warehouseId') || undefined
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    const result = await SalesManagerService.getAvailableEquipment({
      familyId,
      modelId,
      warehouseId,
      search,
      page,
      pageSize,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Error obteniendo equipos disponibles:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener equipos' },
      { status: 500 }
    )
  }
}
