import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalesManagerService } from '@/lib/services/sales-manager.service'
import {
  getInventorySessionContext,
  hasInventoryModuleAccess,
} from '@/lib/inventory/inventory-session'
import prisma from '@/lib/prisma'
import {
  assertInventoryManageByFamily,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

/**
 * POST /api/inventory/sales/activate
 * Activa equipos para venta
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
    const { equipmentIds, salePrice, saleCurrency, saleNotes } = body

    // Validaciones
    if (!equipmentIds || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
      return NextResponse.json({ error: 'Debe proporcionar al menos un equipo' }, { status: 400 })
    }

    if (!salePrice || salePrice <= 0) {
      return NextResponse.json({ error: 'El precio de venta debe ser mayor a 0' }, { status: 400 })
    }

    const accessUser = toInventoryAccessUser(session.user)
    const equipmentRows = await prisma.equipment.findMany({
      where: { id: { in: equipmentIds } },
      select: { id: true, type: { select: { familyId: true } } },
    })
    if (equipmentRows.length !== equipmentIds.length) {
      return NextResponse.json({ error: 'Algunos equipos no fueron encontrados' }, { status: 404 })
    }
    for (const eq of equipmentRows) {
      try {
        await assertInventoryManageByFamily(accessUser, eq.type?.familyId ?? null)
      } catch (err) {
        if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
        throw err
      }
    }

    const result = await SalesManagerService.activateForSale({
      equipmentIds,
      salePrice,
      saleCurrency,
      saleNotes,
      userId: session.user.id,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Error activando equipos para venta:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al activar equipos' },
      { status: 500 }
    )
  }
}
