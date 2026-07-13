import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalesManagerService } from '@/lib/services/sales-manager.service'
import {
  getInventorySessionContext,
  hasInventoryModuleAccess,
} from '@/lib/inventory/inventory-session'
import {
  assertInventoryResourceManage,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

/**
 * POST /api/inventory/sales/batch/[id]/activate
 * Activa lote completo para venta
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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
    const { salePrice, saleCurrency, saleNotes } = body

    // Validaciones
    if (!salePrice || salePrice <= 0) {
      return NextResponse.json({ error: 'El precio de venta debe ser mayor a 0' }, { status: 400 })
    }

    try {
      await assertInventoryResourceManage(toInventoryAccessUser(session.user), 'BATCH', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const result = await SalesManagerService.activateBatchForSale({
      batchId: id,
      salePrice,
      saleCurrency,
      saleNotes,
      userId: session.user.id,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Error activando lote para venta:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al activar lote' },
      { status: 500 }
    )
  }
}
