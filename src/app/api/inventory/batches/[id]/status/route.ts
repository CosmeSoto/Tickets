/**
 * API Route: Update Batch Status
 * PUT /api/inventory/batches/[id]/status - Update batch status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateBatchStatus } from '@/lib/services/equipment-batches.service'
import { canManageInventory } from '@/lib/inventory-access'
import { z } from 'zod'

const updateStatusSchema = z.object({
  status: z.string().min(1),
})

/**
 * PUT /api/inventory/batches/[id]/status
 * Update equipment batch status
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Check inventory access
    const hasAccess = await canManageInventory(session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = updateStatusSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const batch = await updateBatchStatus(id, validationResult.data.status)

    return NextResponse.json(batch)
  } catch (error: any) {
    console.error('Error updating batch status:', error)

    if (error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: error.message || 'Error al actualizar estado del lote' },
      { status: 500 }
    )
  }
}
