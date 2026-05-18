/**
 * API Routes: Equipment Batch by ID
 * GET /api/inventory/batches/[id] - Get batch details
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBatchById, getBatchEquipment } from '@/lib/services/equipment-batches.service'
import {
  assertInventoryResourceRead,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    try {
      await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'BATCH', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const batch = await getBatchById(id)
    const equipment = await getBatchEquipment(id)

    return NextResponse.json({ ...batch, equipment })
  } catch (error: any) {
    console.error('Error getting batch:', error)
    if (error.message?.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json({ error: error.message || 'Error al obtener lote' }, { status: 500 })
  }
}
