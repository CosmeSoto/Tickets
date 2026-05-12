/**
 * API Routes: Equipment Batch by ID
 * GET /api/inventory/batches/[id] - Get batch details
 * PUT /api/inventory/batches/[id]/status - Update batch status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBatchById, getBatchEquipment } from '@/lib/services/equipment-batches.service'
import { canManageInventory } from '@/lib/inventory-access'

/**
 * GET /api/inventory/batches/[id]
 * Get equipment batch by ID with details
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const batch = await getBatchById(id)
    const equipment = await getBatchEquipment(id)

    return NextResponse.json({
      ...batch,
      equipment,
    })
  } catch (error: any) {
    console.error('Error getting batch:', error)

    if (error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ error: error.message || 'Error al obtener lote' }, { status: 500 })
  }
}
