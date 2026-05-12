/**
 * API Route: Equipment Model Stock
 * GET /api/inventory/models/[id]/stock - Get model with stock information
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getModelWithStock } from '@/lib/services/equipment-models.service'
import { canManageInventory } from '@/lib/inventory-access'
import { withCache, buildCacheKey } from '@/lib/api-cache'

/**
 * GET /api/inventory/models/[id]/stock
 * Get equipment model with stock information (cached)
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

    const cacheKey = buildCacheKey('model:stock', { id })

    // Get data with cache
    const modelWithStock = await withCache(cacheKey, 30, async () => {
      return await getModelWithStock(id)
    })

    return NextResponse.json(modelWithStock, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
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
