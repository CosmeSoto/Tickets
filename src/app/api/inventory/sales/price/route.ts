import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalesManagerService } from '@/lib/services/sales-manager.service'
import {
  getInventorySessionContext,
  hasInventoryModuleAccess,
} from '@/lib/inventory/inventory-session'

/**
 * PATCH /api/inventory/sales/price
 * Actualiza precio de venta de equipos
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const ctx = await getInventorySessionContext(session.user)
    if (!hasInventoryModuleAccess(ctx)) {
      return NextResponse.json(
        { error: 'No tiene permisos para gestionar ventas' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { equipmentIds, newPrice } = body

    // Validaciones
    if (!equipmentIds || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
      return NextResponse.json({ error: 'Debe proporcionar al menos un equipo' }, { status: 400 })
    }

    if (!newPrice || newPrice <= 0) {
      return NextResponse.json({ error: 'El precio debe ser mayor a 0' }, { status: 400 })
    }

    const result = await SalesManagerService.updateSalePrice({
      equipmentIds,
      newPrice,
      userId: session.user.id,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Error actualizando precio de venta:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar precio' },
      { status: 500 }
    )
  }
}
