import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalesManagerService } from '@/lib/services/sales-manager.service'
import {
  getInventorySessionContext,
  hasInventoryModuleAccess,
} from '@/lib/inventory/inventory-session'
import {
  assertEquipmentIdsManage,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

/**
 * POST /api/inventory/sales/deactivate
 * Desactiva equipos de venta
 */
export async function POST(request: NextRequest) {
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
    const { equipmentIds, reason } = body

    // Validaciones
    if (!equipmentIds || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
      return NextResponse.json({ error: 'Debe proporcionar al menos un equipo' }, { status: 400 })
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: 'Debe proporcionar una razón (mínimo 5 caracteres)' },
        { status: 400 }
      )
    }

    try {
      await assertEquipmentIdsManage(toInventoryAccessUser(session.user), equipmentIds)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const result = await SalesManagerService.deactivateFromSale({
      equipmentIds,
      reason,
      userId: session.user.id,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Error desactivando equipos de venta:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al desactivar equipos' },
      { status: 500 }
    )
  }
}
