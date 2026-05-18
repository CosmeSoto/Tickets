/**
 * API Route: Update Batch Status
 * PUT /api/inventory/batches/[id]/status - Update batch status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateBatchStatus } from '@/lib/services/equipment-batches.service'
import { z } from 'zod'
import {
  assertInventoryResourceManage,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

const updateStatusSchema = z.object({
  status: z.string().min(1),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    try {
      await assertInventoryResourceManage(toInventoryAccessUser(session.user), 'BATCH', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const body = await request.json()
    const validationResult = updateStatusSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const batch = await updateBatchStatus(id, validationResult.data.status)
    return NextResponse.json(batch)
  } catch (error: any) {
    console.error('Error updating batch status:', error)
    if (error.message?.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json(
      { error: error.message || 'Error al actualizar estado del lote' },
      { status: 500 }
    )
  }
}
