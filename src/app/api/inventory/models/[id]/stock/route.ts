/**
 * API Route: Equipment Model Stock
 * GET /api/inventory/models/[id]/stock - Get model with stock information
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getModelWithStock } from '@/lib/services/equipment-models.service'
import { canManageInventory } from '@/lib/inventory-access'
import { buildCacheKey } from '@/lib/api-cache'

/**
 * GET /api/inventory/models/[id]/stock
 * Get equipment model with stock information (cached)
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Check inventory access
    const hasAccess = await canManageInventory(session.user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const cacheKey = `model:${params.id}:stock`

    // Try cache first
    // const cached = await getCachedData(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Get fresh data
    const modelWithStock = await getModelWithStock(params.id)

    // Cache for 30 seconds
    // await setCachedData(cacheKey, modelWithStock, 30)

    return NextResponse.json(modelWithStock)
  } catch (error: any) {
    console.error('Error getting model stock:', error)

    if (error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: error.message || 'Error al obtener stock del modelo' },
      { status: 500 }
    )
  }
}
